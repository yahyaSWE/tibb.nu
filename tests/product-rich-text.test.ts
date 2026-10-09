import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseProductRichText,
  productRichTextImageIds,
  productRichTextText,
  type ProductRichTextDocument,
} from "../src/lib/product-rich-text";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css"))
      return { format: "module", source: "", shortCircuit: true };
    return nextLoad(url, context);
  },
});

const imageId = "07cf9f34-0571-46dd-8498-5fc5adb93785";
const secondImageId = "a18caa04-a3bb-4497-8a78-af1208769804";
const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const image = (id = imageId) => ({
  type: "image",
  attrs: { src: `/api/shop/images/${id}`, alt: "Produktens delar", title: "Alla delar i paketet", width: null, height: null },
});

test("optional empty descriptions and Tiptap's empty paragraph become null", () => {
  for (const input of [undefined, null, "", "  \n  ", "null", { type: "doc" }, doc(), doc({ type: "paragraph" }), doc(paragraph("  "))])
    assert.equal(parseProductRichText(input), null);
  assert.equal(productRichTextText(null), "");
  assert.deepEqual(productRichTextImageIds(null), []);
});

test("supported Tiptap nodes and current link/image/list defaults round-trip without mutation", () => {
  const input = doc(
    { type: "heading", attrs: { level: 2 }, content: [text("Fördjupning")] },
    {
      type: "paragraph",
      content: [
        { ...text("Alla format"), marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "strike" }] },
        { type: "hardBreak", marks: [{ type: "bold" }] },
        {
          ...text("Läs mer"),
          marks: [{ type: "link", attrs: { href: "https://example.org/produkt?a=1&b=2", target: "_blank", rel: "noopener noreferrer nofollow", class: null, title: null } }],
        },
      ],
    },
    { type: "heading", attrs: { level: 3 }, content: [text("Innehåll")] },
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [paragraph("En del"), { type: "orderedList", attrs: { start: 3, type: null }, content: [{ type: "listItem", content: [paragraph("Nästa del")] }] }] }],
    },
    { type: "blockquote", content: [paragraph("Ett citat")] },
    { type: "horizontalRule" },
    image(),
  );
  const original = JSON.stringify(input);
  const parsed = parseProductRichText(input);
  assert.deepEqual(parsed, input);
  assert.notEqual(parsed, input);
  assert.deepEqual(parseProductRichText(JSON.stringify(parsed)), parsed);
  assert.equal(JSON.stringify(input), original);
});

test("plain searchable text keeps words together, separates blocks and includes image descriptions", () => {
  const parsed = parseProductRichText(doc(
    { type: "paragraph", content: [text("En "), { ...text("fin"), marks: [{ type: "bold" }] }, text(" produkt"), { type: "hardBreak" }, text("med fler delar.")] },
    { type: "bulletList", content: [{ type: "listItem", content: [paragraph("Punkt ett")] }, { type: "listItem", content: [paragraph("Punkt två")] }] },
    image(),
  ));
  assert.equal(productRichTextText(parsed), "En fin produkt\nmed fler delar.\nPunkt ett\nPunkt två\nProduktens delar\nAlla delar i paketet");
  assert.deepEqual(productRichTextImageIds(parsed), [imageId]);
});

test("uploaded images are deduplicated in document order, including images nested in lists and quotes", () => {
  const parsed = parseProductRichText(doc(
    image(secondImageId),
    { type: "blockquote", content: [image()] },
    { type: "bulletList", content: [{ type: "listItem", content: [paragraph("Delar"), image(secondImageId)] }] },
  ));
  assert.deepEqual(productRichTextImageIds(parsed), [secondImageId, imageId]);
  assert.ok(parseProductRichText(doc({ type: "image", attrs: { src: `/api/shop/images/${imageId}`, alt: null, title: null } })));
  assert.deepEqual(parseProductRichText(doc(image(imageId.toUpperCase()))), doc(image()));
});

test("HTML strings, malformed JSON and unsupported document types fail with Swedish messages", () => {
  for (const input of ["<p>HTML</p>", "{", "[]", "true", 42, {}, [], { type: "paragraph" }])
    assert.throws(() => parseProductRichText(input), /^Error: Produktbeskrivningen /);
  const circular: Record<string, unknown> = { type: "doc" };
  circular.content = [circular];
  assert.throws(() => parseProductRichText(circular), /JSON-format/);
});

test("unknown nodes, executable properties, CSS and HTML attributes are rejected", () => {
  for (const content of [
    { type: "iframe", attrs: { src: "https://evil.test" } },
    { type: "codeBlock", content: [text("alert(1)")] },
    { type: "html", text: "<script>alert(1)</script>" },
    { ...paragraph("Text"), attrs: { style: "position:fixed" } },
    { ...paragraph("Text"), onClick: "alert(1)" },
    { ...image(), attrs: { ...image().attrs, onerror: "alert(1)" } },
    { type: "paragraph", content: [{ ...text("Text"), marks: [{ type: "textStyle", attrs: { color: "red" } }] }] },
    { type: "paragraph", content: [{ ...text("Text"), marks: [{ type: "bold", attrs: { style: "color:red" } }] }] },
  ])
    assert.throws(() => parseProductRichText(doc(content)), /otillåt/);
  assert.throws(() => parseProductRichText(JSON.parse('{"type":"doc","__proto__":{},"content":[]}')), /otillåt/);
});

test("unsafe, disguised or credential-bearing links and uncontrolled link attributes are rejected", () => {
  for (const href of [
    "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.test", "/\\evil.test", "https://example.org\\@evil.test", "java\nscript:alert(1)", "https://example.org/\u0000", "https://example.org/\u0085", " https://example.org", "https://user:password@example.org", "ftp://example.org", "mailto:test@example.org", "https://", "relative/path",
  ]) {
    assert.throws(() => parseProductRichText(doc({ type: "paragraph", content: [{ ...text("Länk"), marks: [{ type: "link", attrs: { href } }] }] })), /osäker länk/, href);
  }
  for (const extra of [{ target: "popup" }, { class: "fixed-overlay" }, { rel: "opener" }, { download: "Otillåtet" }, { style: "color:red" }])
    assert.throws(() => parseProductRichText(doc({ type: "paragraph", content: [{ ...text("Länk"), marks: [{ type: "link", attrs: { href: "/kontakt", ...extra } }] }] })), /otillåt/);
});

test("HTTP, HTTPS, local paths and local fragments are supported without changing destinations", () => {
  for (const href of ["http://example.org/info", "https://example.org/info?a=1&b=2", "/butik/produkt#innehall", "#innehall"])
    assert.deepEqual(parseProductRichText(doc({ type: "paragraph", content: [{ ...text("Länk"), marks: [{ type: "link", attrs: { href } }] }] })), doc({ type: "paragraph", content: [{ ...text("Länk"), marks: [{ type: "link", attrs: { href } }] }] }));
});

test("only uploaded UUIDv4 images are accepted; external, base64, malformed and extra image fields fail", () => {
  for (const src of ["https://example.org/image.jpg", "data:image/png;base64,AAAA", "//example.org/image.jpg", `/api/shop/images/${imageId}?external=1`, `/api/shop/images/${imageId}/../other`, `/api/shop/images/${imageId}\n`, "/api/shop/images/07cf9f34-0571-16dd-8498-5fc5adb93785", "/api/shop/images/not-an-id"])
    assert.throws(() => parseProductRichText(doc({ type: "image", attrs: { src } })), /otillåten bild/);
  for (const attrs of [{ ...image().attrs, width: 500 }, { ...image().attrs, height: "100%" }, { ...image().attrs, title: {} }, { ...image().attrs, alt: 42 }])
    assert.throws(() => parseProductRichText(doc({ type: "image", attrs })), /Produktbeskrivningen/);
});

test("bad nesting, wrong value types, invalid headings and list numbering are rejected", () => {
  for (const content of [
    text("Fristående text"),
    { type: "paragraph", content: [image()] },
    { type: "heading", attrs: { level: 1 }, content: [text("Rubrik")] },
    { type: "heading", attrs: { level: "2" }, content: [text("Rubrik")] },
    { type: "heading", attrs: { level: 2 }, content: [paragraph("Rubrik")] },
    { type: "paragraph", content: "Text" },
    { type: "paragraph", content: [{ type: "text", text: "" }] },
    { type: "paragraph", content: [{ type: "text", text: 42 }] },
    { type: "paragraph", content: [{ type: "hardBreak", content: [] }] },
    { type: "bulletList", content: [paragraph("Punkt")] },
    { type: "bulletList", content: [] },
    { type: "listItem", content: [paragraph("Punkt")] },
    { type: "blockquote", content: [text("Citat")] },
    { type: "blockquote", content: [] },
    { type: "orderedList", attrs: { start: 0 }, content: [{ type: "listItem", content: [paragraph("Punkt")] }] },
    { type: "orderedList", attrs: { start: 1.5 }, content: [{ type: "listItem", content: [paragraph("Punkt")] }] },
    { type: "orderedList", content: [{ type: "listItem", content: [image()] }] },
    { type: "paragraph", content: [{ ...text("Text"), marks: [{ type: "bold" }, { type: "bold" }] }] },
  ])
    assert.throws(() => parseProductRichText(doc(content)), /Produktbeskrivningen/);
  assert.throws(() => parseProductRichText({ type: "doc", content: {} }), /dokumentinnehåll/);
});

test("JSON byte, text, node, nesting and unique image limits are enforced", () => {
  assert.ok(parseProductRichText(doc(paragraph("a".repeat(50_000)))));
  assert.throws(() => parseProductRichText(doc(paragraph("a".repeat(50_001)))), /50 000/);
  assert.throws(() => parseProductRichText(JSON.stringify(doc(paragraph("å".repeat(60_000))))), /120 000/);
  assert.throws(() => parseProductRichText(doc(paragraph("å".repeat(60_000)))), /120 000/);
  assert.throws(() => parseProductRichText(doc(...Array.from({ length: 2_000 }, () => ({ type: "paragraph" })))), /2 000/);
  let nested: unknown = paragraph("Djupt innehåll");
  for (let index = 0; index < 11; index++) nested = { type: "blockquote", content: [nested] };
  assert.throws(() => parseProductRichText(doc(nested)), /12 nivåer/);
  const images = Array.from({ length: 21 }, (_, index) => image(`${index.toString(16).padStart(8, "0")}-0571-46dd-8498-5fc5adb93785`));
  assert.ok(parseProductRichText(doc(...images.slice(0, 20))));
  assert.throws(() => parseProductRichText(doc(...images)), /20 olika bilder/);
  assert.ok(parseProductRichText(doc(...Array.from({ length: 30 }, () => image()))));
});

test("server renderer escapes hostile text, image metadata and caption strings as React content", async () => {
  const { ProductRichText } = await import("../src/components/shop/product-rich-text");
  const parsed = parseProductRichText(doc(
    { type: "heading", attrs: { level: 2 }, content: [text("Innehåll <script>alert(1)</script>")] },
    paragraph('<img src=x onerror="alert(1)"> & text'),
    { type: "image", attrs: { src: `/api/shop/images/${imageId}`, alt: '\" onerror=\"alert(1)', title: "<script>bildtext</script>" } },
  ));
  const html = renderToStaticMarkup(createElement(ProductRichText, { document: parsed }));
  assert.match(html, /<h2>Innehåll &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h2>/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; text/);
  assert.match(html, /alt="&quot; onerror=&quot;alert\(1\)"/);
  assert.match(html, /<figcaption>&lt;script&gt;bildtext&lt;\/script&gt;<\/figcaption>/);
  assert.match(html, /loading="lazy" decoding="async"/);
  assert.doesNotMatch(html, /<script|<iframe|<img src="x"| onerror="/);
});

test("server renderer uses semantic lists, headings and marks, controlled links, and empty output", async () => {
  const { ProductRichText } = await import("../src/components/shop/product-rich-text");
  const parsed = parseProductRichText(doc(
    { type: "heading", attrs: { level: 3 }, content: [text("Rubrik")] },
    { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [paragraph("Tredje punkten")] }] },
    { type: "paragraph", content: [{ ...text("Format"), marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "strike" }] }, { type: "hardBreak" }, { ...text("Länk"), marks: [{ type: "link", attrs: { href: "https://example.org/?a=1&b=2", target: "_blank", rel: "nofollow", class: null } }] }] },
    { type: "blockquote", content: [paragraph("Citat")] },
    { type: "horizontalRule" },
  ));
  const html = renderToStaticMarkup(createElement(ProductRichText, { document: parsed }));
  assert.match(html, /<h3>Rubrik<\/h3>/);
  assert.match(html, /<ol start="3"><li><p>Tredje punkten<\/p><\/li><\/ol>/);
  assert.match(html, /<s><u><em><strong>Format<\/strong><\/em><\/u><\/s><br\/>/);
  assert.match(html, /href="https:\/\/example.org\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow"/);
  assert.match(html, /<blockquote><p>Citat<\/p><\/blockquote><hr\/>/);
  assert.equal(renderToStaticMarkup(createElement(ProductRichText, { document: null })), "");
  assert.throws(() => renderToStaticMarkup(createElement(ProductRichText, { document: doc({ type: "image", attrs: { src: "data:image/png;base64,AAAA" } }) as ProductRichTextDocument })), /otillåten bild/);
});
