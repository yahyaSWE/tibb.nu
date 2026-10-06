import Link from "next/link";
import { getCourses, getLessons, getEnrollments } from "@/lib/db";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  EmptyState,
  kronor,
  SectionHeading,
} from "@/components/admin/common";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  const [courses, enrollments] = await Promise.all([
    getCourses(),
    getEnrollments(),
  ]);
  const lessonCounts = new Map(
    await Promise.all(
      courses.map(
        async (course) =>
          [course.id, (await getLessons(course.id)).length] as const,
      ),
    ),
  );
  return (
    <>
      <AdminHeading
        title="Kurser"
        description="Bygg kurser med lektioner och ge dina elever tillgång till innehållet."
        action={
          <Link href="/admin/kurser/ny" className="button button-primary">
            Skapa en kurs
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel">
        <SectionHeading title="Dina kurser" />
        {courses.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kurs</th>
                  <th>Lektioner</th>
                  <th>Elever</th>
                  <th>Pris</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Åtgärd</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <strong>{course.title}</strong>
                    </td>
                    <td>{lessonCounts.get(course.id) ?? 0}</td>
                    <td>
                      {
                        enrollments.filter((e) => e.courseId === course.id)
                          .length
                      }
                    </td>
                    <td>{kronor(course.priceOre)}</td>
                    <td>
                      <span
                        className={`badge ${course.published ? "badge-green" : "badge-amber"}`}
                      >
                        {course.published ? "Publicerad" : "Utkast"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="button button-secondary button-small"
                        href={`/admin/kurser/${course.id}`}
                      >
                        Öppna kursbyggaren
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Kunskap som får växa"
            href="/admin/kurser/ny"
            label="Skapa första kursen"
          >
            Börja med ett namn och en beskrivning. Lägg sedan till lektioner,
            material och elever.
          </EmptyState>
        )}
      </section>
    </>
  );
}
