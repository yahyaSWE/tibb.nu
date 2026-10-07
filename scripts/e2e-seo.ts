import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const base = new URL(process.argv[2] || "http://127.0.0.1:3001");
const canonical = new URL(process.argv[3] || "https://tibbnu.vercel.app");
if (!["localhost", "127.0.0.1"].includes(base.hostname) || base.protocol !== "http:") throw new Error("Run this read-only check against a local test server only.");
const indexable = process.argv.includes("--indexable");
const paths = ["/", "/boka", "/kurser", "/artiklar", "/sjalvtest", "/om", "/kontakt", "/vanliga-fragor", "/integritet", "/artiklar/qa-public-article", "/kurser/qa-public-course"];
const results: { path: string; title: string; schemas: string[] }[] = [];

async function get(path: string, agent = "Googlebot") {
  const response = await fetch(new URL(path, base), { headers: { "User-Agent": agent }, redirect: "manual" });
  return { response, html: await response.text() };
}
function schemas(html: string) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)]
    .flatMap((match) => { const data: unknown = JSON.parse(match[1]); return Array.isArray(data) ? data : [data]; }) as Record<string, unknown>[];
}

async function main() {
  for (const path of paths) {
    const { response, html } = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(html, /<html[^>]+lang="sv"/);
    assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length, 1, `${path}: one H1`);
    const pageCanonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(pageCanonical, `${path}: has canonical`);
    assert.equal(new URL(pageCanonical).href, new URL(path, canonical).href, `${path}: own canonical`);
    assert.match(html, /name="description" content="[^\"]+/);
    assert.match(html, /property="og:image" content="https:\/\//);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, indexable ? /name="robots" content="index, follow/ : /name="robots" content="noindex, nofollow/);
    assert.ok(!/QA_PROTECTED_LESSON_BODY|QA_PRIVATE_LESSON_BODY|PRIVATE ARTICLE|example\.com\/material\.pdf/.test(html), path);
    const graph = schemas(html);
    results.push({ path, title: /<title>(.*?)<\/title>/.exec(html)?.[1] || "", schemas: graph.map((item) => String(item["@type"])) });
    if (path === "/") assert.ok(graph.some((item) => item["@type"] === "WebSite"));
    if (path === "/om") { assert.ok(graph.some((item) => item["@type"] === "Person" && item.name === "Johan Yahya Blomdahl")); assert.match(html, /Hijamautbildning i Egypten/); }
    if (path.startsWith("/artiklar/")) { assert.ok(graph.some((item) => item["@type"] === "BlogPosting")); assert.ok(!graph.some((item) => Object.hasOwn(item, "datePublished"))); }
    if (path.startsWith("/kurser/")) assert.ok(graph.some((item) => item["@type"] === "Course"));
  }
  for (const path of ["/logga-in", "/registrera", "/setup", "/installation", "/bokning/bekraftelse", "/api/bookings"]) {
    const { response, html } = await get(path);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex/, `${path}: header`);
    assert.ok(!html.includes('<link rel="canonical"'), `${path}: no public canonical`);
  }
  for (const path of ["/artiklar/qa-private-article", "/kurser/qa-private-course", "/artiklar/does-not-exist"]) {
    const { response, html } = await get(path);
    // Next's loading boundary can already have streamed a 200 response before
    // notFound(). In that case it must still emit noindex and no content graph.
    assert.ok(response.status === 404 || response.status === 200, `${path}: not-found response`);
    assert.match(html, /noindex/);
    assert.equal(schemas(html).length, 0);
  }
  for (const agent of ["OAI-SearchBot", "PerplexityBot"]) {
    const { response, html } = await get("/om", agent);
    assert.equal(response.status, 200);
    assert.match(html, /Johan Yahya Blomdahl/);
    assert.match(html, /rel="canonical"/);
  }
  const robots = await get("/robots.txt");
  assert.match(robots.response.headers.get("content-type") || "", /text\/plain/);
  if (indexable) {
    assert.match(robots.html, /User-Agent: OAI-SearchBot/i);
    assert.match(robots.html, /Sitemap: https:\/\//);
    const sitemap = await get("/sitemap.xml");
    assert.match(sitemap.response.headers.get("content-type") || "", /xml/);
    assert.match(sitemap.html, /qa-public-article/);
    assert.ok(!/qa-private|elevportal|admin|token=/.test(sitemap.html));
    const map = await get("/llms.txt");
    assert.equal(map.response.status, 200);
    assert.match(map.html, /vanliga-fragor/);
  } else { assert.match(robots.html, /Disallow: \/\s/); }
  const og = await fetch(new URL("/opengraph-image", base));
  assert.equal(og.status, 200);
  assert.match(og.headers.get("content-type") || "", /image\/png/);
  const image = Buffer.from(await og.arrayBuffer());
  const dimensions = await sharp(image).metadata();
  assert.equal(dimensions.width, 1200);
  assert.equal(dimensions.height, 630);
  await mkdir(resolve(".test-data/seo"), { recursive: true });
  await writeFile(resolve(".test-data/seo/share-image.png"), image);
  await writeFile(resolve(".test-data/seo/http-checks.json"), JSON.stringify({ indexable, results }, null, 2));
  console.log(`SEO HTTP checks passed: ${paths.length} public routes, private headers, drafts, AI search agents, discovery and 1200x630 share image. Indexable mode: ${indexable}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
