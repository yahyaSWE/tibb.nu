import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
} from "@/components/admin/common";
import { ArticleForm } from "@/components/admin/article-form";

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  return (
    <>
      <AdminHeading
        title="Skriv en artikel"
        description="Låt din kunskap ta form. Du väljer själv när texten blir synlig."
        action={
          <Link href="/admin/artiklar" className="button button-secondary">
            Alla artiklar
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel form-panel">
        <ArticleForm returnTo="/admin/artiklar" />
      </section>
    </>
  );
}
