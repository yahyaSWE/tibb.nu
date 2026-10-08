import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  articleFields,
  courseFields,
  lessonFields,
} from "../src/lib/content-action-state";
import {
  contentBlocks,
  courseIntroduction,
  safeContentHref,
} from "../src/lib/content-text";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css"))
      return { format: "module", source: "", shortCircuit: true };
    return nextLoad(url, context);
  },
});

test("article sections render semantic headings, internal and web links, and escaped HTML", async () => {
  const { TextContent } = await import("../src/components/learning/cards");
  const html = renderToStaticMarkup(
    createElement(TextContent, {
      text: "En vanlig text.\n\n## Källor och vidare läsning\nSe [Kontakt](/kontakt) och [Källan](https://example.org/source?a=1&b=2).\n\n<script>alert(1)</script> [Osäker](javascript:alert(1)) [Data](data:text/html,x) [Extern](//evil.test/x)",
    }),
  );
  assert.match(html, /<h2>Källor och vidare läsning<\/h2>/);
  assert.match(html, /<a href="\/kontakt">Kontakt<\/a>/);
  assert.match(
    html,
    /<a href="https:\/\/example.org\/source\?a=1&amp;b=2">Källan<\/a>/,
  );
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(
    html,
    /<script|href="javascript:|href="data:|href="\/\/evil/,
  );
  assert.match(html, /\[Osäker\]\(javascript:/);
});

test("safe links accept HTTP, HTTPS and local paths but reject dangerous or disguised schemes", () => {
  assert.equal(
    safeContentHref("http://example.org/source"),
    "http://example.org/source",
  );
  assert.equal(
    safeContentHref("/artiklar/test#avsnitt"),
    "/artiklar/test#avsnitt",
  );
  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,x",
    "//evil.test",
    "/\\evil.test",
    "https://user:secret@example.org",
    "java\nscript:alert(1)",
    "https://example.org/\u0000",
  ])
    assert.equal(safeContentHref(unsafe), undefined, unsafe);
});

test("existing plain paragraphs and line breaks remain intact", () => {
  assert.deepEqual(
    contentBlocks("Första raden.\r\nNästa raden.\r\n\r\nAndra stycket."),
    [
      { kind: "paragraph", text: "Första raden.\nNästa raden." },
      { kind: "paragraph", text: "Andra stycket." },
    ],
  );
});

test("course card introduction is short, respects whole words and leaves full description untouched", async () => {
  const { CourseCard, TextContent } = await import(
    "../src/components/learning/cards"
  );
  const description =
    Array.from({ length: 65 }, (_, index) => `kunskapsområde${index + 1}`).join(
      " ",
    ) + "\n\nFullständig fördjupning.";
  const summary = courseIntroduction(description);
  assert.equal(
    summary,
    Array.from({ length: 32 }, (_, index) => `kunskapsområde${index + 1}`).join(
      " ",
    ) + "…",
  );
  const card = renderToStaticMarkup(
    createElement(CourseCard, {
      course: {
        id: 1,
        slug: "test",
        title: "Test",
        description,
        priceOre: 9950,
      },
    }),
  );
  assert.ok(card.includes("kunskapsområde32…"));
  assert.ok(!card.includes("kunskapsområde33"));
  const full = renderToStaticMarkup(
    createElement(TextContent, { text: description }),
  );
  assert.ok(full.includes("kunskapsområde65"));
  assert.ok(full.includes("Fullständig fördjupning."));
});

test("course prices preserve whole kronor and every öre", async () => {
  const { formatPrice } = await import("../src/components/learning/cards");
  const normalize = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");
  assert.equal(normalize(formatPrice(499000)), "4 990 kr");
  assert.equal(normalize(formatPrice(9950)), "99,50 kr");
  assert.equal(normalize(formatPrice(9999)), "99,99 kr");
});

test("failed-save snapshots retain exact text, slug, checkbox, decimal price and every material ID", () => {
  const form = new FormData();
  const longText = "  Lång text med radbrytning.\n\n".repeat(200);
  form.set("title", "  Min nya rubrik  ");
  form.set("slug", "redan-upptaget");
  form.set("excerpt", "Ingress");
  form.set("description", longText);
  form.set("body", longText);
  form.set("published", "on");
  form.set("price", "99.50");
  form.set("position", "42");
  form.set("videoUrl", "http://example.org/invalid-video");
  form.set("materialUrl", "https://example.org/worksheet");
  form.set("materialUploadIdsPresent", "1");
  form.append("materialUploadIds", "07cf9f34-0571-46dd-8498-5fc5adb93785");
  form.append("materialUploadIds", "a18caa04-a3bb-4497-8a78-af1208769804");
  assert.equal(articleFields(form).body, longText);
  assert.equal(articleFields(form).title, "  Min nya rubrik  ");
  assert.equal(articleFields(form).slug, "redan-upptaget");
  assert.equal(articleFields(form).published, true);
  assert.equal(courseFields(form).description, longText);
  assert.equal(courseFields(form).price, "99.50");
  assert.deepEqual(
    lessonFields(form).materialUploadIds,
    form.getAll("materialUploadIds"),
  );
  assert.equal(lessonFields(form).body, longText);
  assert.equal(lessonFields(form).videoUrl, "http://example.org/invalid-video");
  form.delete("published");
  form.delete("materialUploadIds");
  assert.equal(articleFields(form).published, false);
  assert.deepEqual(lessonFields(form).materialUploadIds, []);
});
