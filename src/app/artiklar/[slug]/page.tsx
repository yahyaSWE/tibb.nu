import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Sprout } from "lucide-react";
import { TextContent } from "@/components/learning/cards";
import { JsonLd } from "@/components/seo/json-ld";
import {
  buildBreadcrumbSchema,
  createPageMetadata,
  PRIVATE_METADATA,
  seoDescription,
  SITE_NAME,
  toIsoDate,
} from "@/lib/seo";
import { buildArticleSchema } from "@/lib/seo-content";
import { getPublicArticle } from "@/lib/seo-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicArticle(slug);
  if (!article) return { ...PRIVATE_METADATA, title: "Artikeln finns inte" };
  return createPageMetadata({
    title: article.title,
    description: seoDescription(
      article.excerpt.trim() || article.body,
      article.title,
    ),
    path: `/artiklar/${encodeURIComponent(article.slug)}`,
    type: "article",
    modifiedTime: toIsoDate(article.updatedAt),
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublicArticle(slug);
  if (!article) notFound();
  const articleSchema = buildArticleSchema(article);
  const dateCreated = toIsoDate(article.createdAt);
  const dateModified = toIsoDate(article.updatedAt);
  const dateLabel = (date: string) =>
    new Date(date).toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Stockholm",
    });
  return (
    <article className="section container article-detail">
      {articleSchema && <JsonLd id="article-schema" data={articleSchema} />}
      <JsonLd
        id="article-breadcrumbs"
        data={buildBreadcrumbSchema([
          { name: "Start", path: "/" },
          { name: "Artiklar", path: "/artiklar" },
          {
            name: article.title,
            path: `/artiklar/${encodeURIComponent(article.slug)}`,
          },
        ])}
      />
      <Link href="/artiklar" className="back-link">
        <ArrowLeft size={16} /> Alla artiklar
      </Link>
      <nav aria-label="Brödsmulor" className="small muted">
        <Link href="/">Start</Link> <span aria-hidden="true">/</span>{" "}
        <Link href="/artiklar">Artiklar</Link> <span aria-hidden="true">/</span>{" "}
        <span aria-current="page">{article.title}</span>
      </nav>
      <header className="article-detail-header">
        <p className="eyebrow">Tibb journal</p>
        <h1 className="page-title">{article.title}</h1>
        <p className="lead muted">{article.excerpt}</p>
        <p className="small muted">
          Av <Link href="/">{SITE_NAME}</Link>
          {dateCreated && (
            <>
              {" · "}Skapad{" "}
              <time dateTime={dateCreated}>{dateLabel(dateCreated)}</time>
            </>
          )}
          {dateModified && (
            <>
              {" · "}Uppdaterad{" "}
              <time dateTime={dateModified}>{dateLabel(dateModified)}</time>
            </>
          )}
        </p>
      </header>
      <div className="article-detail-art" aria-hidden="true">
        <Sprout size={91} strokeWidth={0.85} />
        <span>Kunskap med rötter. Omsorg med mening.</span>
      </div>
      <TextContent text={article.body} />
      <div className="article-end">
        <span>Tibb.nu</span>
        <Link className="text-link" href="/artiklar">
          Mer från vår journal <ArrowRight size={17} />
        </Link>
      </div>
    </article>
  );
}
