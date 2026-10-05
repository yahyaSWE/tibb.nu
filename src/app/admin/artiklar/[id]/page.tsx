import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticles } from "@/lib/db";
import { deleteArticleAction } from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  ReturnTo,
} from "@/components/admin/common";
import { ArticleForm } from "@/components/admin/article-form";

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AdminSearchParams;
}) {
  const { id } = await params;
  const article = (await getArticles()).find(
    (article) => article.id === Number(id),
  );
  if (!article) notFound();
  return (
    <>
      <AdminHeading
        title="Redigera artikel"
        description={article.title}
        action={
          <Link href="/admin/artiklar" className="button button-secondary">
            Alla artiklar
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel form-panel">
        <ArticleForm article={article} returnTo={`/admin/artiklar/${id}`} />
      </section>
      <section className="panel danger-panel">
        <h2>Ta bort artikel</h2>
        <p className="muted">
          Artikeln och dess innehåll tas bort från hemsidan.
        </p>
        <form action={deleteArticleAction}>
          <input type="hidden" name="id" value={id} />
          <ReturnTo path="/admin/artiklar" />
          <button
            className="button button-secondary delete-button"
            type="submit"
          >
            Ta bort artikel
          </button>
        </form>
      </section>
    </>
  );
}
