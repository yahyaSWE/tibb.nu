import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
} from "@/components/admin/common";
import { CourseForm } from "@/components/admin/course-form";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  return (
    <>
      <AdminHeading
        title="Skapa en kurs"
        description="Börja med kursens grunduppgifter. Öppna sedan kursbyggaren för att lägga till lektioner."
        action={
          <Link href="/admin/kurser" className="button button-secondary">
            Alla kurser
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel form-panel">
        <CourseForm returnTo="/admin/kurser" />
      </section>
    </>
  );
}
