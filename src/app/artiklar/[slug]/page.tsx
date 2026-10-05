import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Sprout } from "lucide-react";
import { getArticle } from "@/lib/db";
import { TextContent } from "@/components/learning/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug, { publishedOnly: true });
  return {
    title: article ? article.title : "Artikeln finns inte",
    description: article?.excerpt.slice(0, 160),
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug, { publishedOnly: true });
  if (!article) notFound();
  return (
    <article className="section container article-detail">
      <Link href="/artiklar" className="back-link">
        <ArrowLeft size={16} /> Alla artiklar
      </Link>
      <header className="article-detail-header">
        <p className="eyebrow">
          Tibb journal ·{" "}
          {new Date(article.createdAt).toLocaleDateString("sv-SE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="page-title">{article.title}</h1>
        <p className="lead muted">{article.excerpt}</p>
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
