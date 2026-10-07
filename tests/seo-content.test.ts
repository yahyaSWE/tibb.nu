import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArticleSchema, buildCourseSchema } from "../src/lib/seo-content";
import {
  absoluteUrl,
  organizationId,
  SITE_NAME,
  websiteId,
} from "../src/lib/seo";
import type { Article, Course } from "../src/lib/types";

const article: Article = {
  id: 21,
  title: "En artikel om tradition och reflektion",
  slug: "tradition-och-reflektion",
  excerpt: "En verklig sammanfattning av artikelns innehåll.",
  body: "Artikelns publicerade brödtext.",
  published: true,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-07T10:30:00.000Z",
};

const course: Course = {
  id: 37,
  title: "Introduktion till de fem faserna",
  slug: "de-fem-faserna",
  description: "Kursens synliga introduktion och ämnen.",
  priceOre: 120_000,
  published: true,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-07T10:30:00.000Z",
};

test("published article schema describes its visible title, organization author and actual creation and modification dates", () => {
  const schema = buildArticleSchema(article);
  assert.ok(schema);
  const url = absoluteUrl(`/artiklar/${article.slug}`);
  assert.equal(schema["@context"], "https://schema.org");
  assert.equal(schema["@type"], "BlogPosting");
  assert.equal(schema["@id"], `${url}#article`);
  assert.equal(schema.url, url);
  assert.equal(schema.headline, article.title);
  assert.equal(schema.description, article.excerpt);
  assert.equal(schema.inLanguage, "sv-SE");
  assert.deepEqual(schema.mainEntityOfPage, { "@type": "WebPage", "@id": url });
  assert.deepEqual(schema.isPartOf, { "@id": websiteId() });
  assert.deepEqual(schema.author, {
    "@type": "Organization",
    "@id": organizationId(),
    name: SITE_NAME,
    url: absoluteUrl("/"),
  });
  assert.deepEqual(schema.publisher, schema.author);
  assert.equal(schema.dateCreated, article.createdAt);
  assert.equal(schema.dateModified, article.updatedAt);
  assert.ok(!("datePublished" in schema));
  assert.ok(!("reviewedBy" in schema));
  assert.ok(!("articleBody" in schema));
});

test("article schema omits invalid dates and falls back to the public body when the excerpt is blank", () => {
  const schema = buildArticleSchema({
    ...article,
    excerpt: "   ",
    createdAt: "unknown",
    updatedAt: "not a date",
  });
  assert.ok(schema);
  assert.equal(schema.description, article.body);
  assert.ok(!("dateCreated" in schema));
  assert.ok(!("dateModified" in schema));
  assert.ok(!("datePublished" in schema));
});

test("unpublished courses and articles never produce public schemas", () => {
  assert.equal(buildArticleSchema({ ...article, published: false }), null);
  assert.equal(buildCourseSchema({ ...course, published: false }), null);
});

test("course schema describes its actual provider without inventing checkout, reviews, certification or free access", () => {
  const schema = buildCourseSchema(course);
  assert.ok(schema);
  const url = absoluteUrl(`/kurser/${course.slug}`);
  assert.equal(schema["@context"], "https://schema.org");
  assert.equal(schema["@type"], "Course");
  assert.equal(schema["@id"], `${url}#course`);
  assert.equal(schema.url, url);
  assert.equal(schema.name, course.title);
  assert.equal(schema.description, course.description);
  assert.equal(schema.inLanguage, "sv-SE");
  assert.deepEqual(schema.provider, {
    "@type": "Organization",
    "@id": organizationId(),
    name: SITE_NAME,
    url: absoluteUrl("/"),
  });
  for (const property of [
    "offers",
    "price",
    "isAccessibleForFree",
    "review",
    "aggregateRating",
    "hasCourseInstance",
    "educationalCredentialAwarded",
    "hasCertification",
  ]) {
    assert.ok(!(property in schema), `unverified course claim: ${property}`);
  }
});

test("course schemas cannot expose lesson bodies, protected assets or enrollment data from expanded records", () => {
  const expandedCourse = {
    ...course,
    lessons: [
      {
        body: "PRIVATE_LESSON_BODY",
        videoUrl: "https://example.test/PRIVATE_VIDEO",
        materials: [{ url: "/api/uploads/PRIVATE_ASSET" }],
      },
    ],
    enrollments: [{ email: "PRIVATE_STUDENT@example.test" }],
  };
  const schema = buildCourseSchema(expandedCourse);
  assert.ok(schema);
  assert.ok(!JSON.stringify(schema).includes("PRIVATE_"));
  assert.ok(!("lessons" in schema));
  assert.ok(!("enrollments" in schema));
  assert.ok(!("priceOre" in schema));
});

test("public canonical schema URLs encode a slug as one path segment", () => {
  const unusualSlug = "reflektion å/?#";
  const articleSchema = buildArticleSchema({ ...article, slug: unusualSlug });
  const courseSchema = buildCourseSchema({ ...course, slug: unusualSlug });
  assert.ok(articleSchema && courseSchema);
  assert.equal(
    articleSchema.url,
    absoluteUrl(`/artiklar/${encodeURIComponent(unusualSlug)}`),
  );
  assert.equal(
    courseSchema.url,
    absoluteUrl(`/kurser/${encodeURIComponent(unusualSlug)}`),
  );
  assert.equal(new URL(articleSchema.url).search, "");
  assert.equal(new URL(courseSchema.url).hash, "");
});
