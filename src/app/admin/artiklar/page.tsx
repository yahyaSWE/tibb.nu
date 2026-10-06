import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getArticles } from "@/lib/db";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  EmptyState,
  SectionHeading,
} from "@/components/admin/common";

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const articles = await getArticles();
  return (
    <>
      <AdminHeading
        title="Artiklar"
        description="Dela kunskap, reflektioner och inspiration med dina besökare."
        action={
          <Link href="/admin/artiklar/ny" className="button button-primary">
            Skriv en artikel
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel">
        <SectionHeading title="Dina artiklar" />
        {articles.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artikel</th>
                  <th>Status</th>
                  <th>Adress</th>
                  <th>
                    <span className="sr-only">Åtgärd</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <strong>{article.title}</strong>
                      <small className="table-description">
                        {article.excerpt}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${article.published ? "badge-green" : "badge-amber"}`}
                      >
                        {article.published ? "Publicerad" : "Utkast"}
                      </span>
                    </td>
                    <td>
                      {article.published ? (
                        <Link
                          className="text-link"
                          href={`/artiklar/${article.slug}`}
                        >
                          Visa artikel ↗
                        </Link>
                      ) : (
                        <span className="muted">Inte publicerad</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/artiklar/${article.id}`}
                        className="button button-secondary button-small"
                      >
                        Redigera
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Plats för dina ord"
            href="/admin/artiklar/ny"
            label="Skriv första artikeln"
          >
            Skapa en artikel, spara den som utkast och publicera när du är redo.
          </EmptyState>
        )}
      </section>
    </>
  );
}
