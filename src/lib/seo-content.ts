import type { Article, Course } from "./types";
import {
  absoluteUrl,
  organizationId,
  seoDescription,
  SITE_NAME,
  toIsoDate,
  websiteId,
} from "./seo";

function organizationReference() {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: SITE_NAME,
    url: absoluteUrl("/"),
  };
}

export function buildArticleSchema(article: Article) {
  if (!article.published) return null;
  const url = absoluteUrl(`/artiklar/${encodeURIComponent(article.slug)}`);
  const dateCreated = toIsoDate(article.createdAt);
  const dateModified = toIsoDate(article.updatedAt);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    url,
    headline: article.title,
    description: seoDescription(
      article.excerpt.trim() || article.body,
      article.title,
    ),
    inLanguage: "sv-SE",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": websiteId() },
    author: organizationReference(),
    publisher: organizationReference(),
    ...(dateCreated ? { dateCreated } : {}),
    ...(dateModified ? { dateModified } : {}),
    // createdAt records creation, not the first publication. Do not invent a
    // datePublished until a separate publication timestamp is available.
  };
}

export function buildCourseSchema(course: Course) {
  if (!course.published) return null;
  const url = absoluteUrl(`/kurser/${encodeURIComponent(course.slug)}`);
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: course.title,
    description: seoDescription(course.description, course.title),
    url,
    inLanguage: "sv-SE",
    provider: organizationReference(),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@id": websiteId() },
  };
}
