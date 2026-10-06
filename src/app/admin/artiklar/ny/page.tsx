import Link from "next/link";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
} from "@/components/admin/common";
import { ArticleForm } from "@/components/admin/article-form";

export default function NewArticlePage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
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
