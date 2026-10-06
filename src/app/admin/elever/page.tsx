import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getUsers, getEnrollments, getCourses } from "@/lib/db";
import { enrollStudentAction, removeEnrollmentAction } from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  dateOnly,
  EmptyState,
  Field,
  ReturnTo,
  SectionHeading,
} from "@/components/admin/common";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const [users, enrollments, courses] = await Promise.all([
    getUsers(),
    getEnrollments(),
    getCourses(),
  ]);
  const students = users.filter((user) => user.role === "student");
  return (
    <>
      <AdminHeading
        title="Elever"
        description="Se registrerade elever och styr vilka kurser de har tillgång till."
      />
      <AdminNotice searchParams={searchParams} />
      <div className="stack">
        <section className="panel">
          <SectionHeading title="Registrerade elever" />
          {students.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Namn</th>
                    <th>E-post</th>
                    <th>Kurser</th>
                    <th>Registrerad</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.name}</strong>
                      </td>
                      <td>{student.email}</td>
                      <td>
                        {
                          enrollments.filter((e) => e.userId === student.id)
                            .length
                        }
                      </td>
                      <td>{dateOnly(student.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Välkomna din första elev"
              href="/registrera"
              label="Visa registreringssidan"
            >
              Elever kan skapa ett konto på hemsidan. Därefter kan du ge dem
              tillgång till en kurs.
            </EmptyState>
          )}
        </section>
        <section className="panel form-panel">
          <SectionHeading title="Tilldela en kurs" />
          {courses.length ? (
            <form action={enrollStudentAction} className="stack">
              <ReturnTo path="/admin/elever" />
              <Field label="Elevens e-postadress" name="email">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  placeholder="elev@exempel.se"
                  list="registered-students"
                />
                <datalist id="registered-students">
                  {students.map((s) => (
                    <option key={s.id} value={s.email}>
                      {s.name}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Kurs" name="courseId">
                <select id="courseId" name="courseId" required>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {!c.published ? " (utkast)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="muted">
                Tillgång till en kurs i utkast börjar gälla när kursen
                publiceras.
              </p>
              <div>
                <button type="submit" className="button button-primary">
                  Tilldela tillgång
                </button>
              </div>
            </form>
          ) : (
            <EmptyState
              title="Skapa en kurs först"
              href="/admin/kurser/ny"
              label="Skapa kurs"
            >
              När du har skapat en kurs kan du koppla dina elever till den.
            </EmptyState>
          )}
        </section>
        <section className="panel">
          <SectionHeading title="Tilldelade kurser" />
          {enrollments.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Elev</th>
                    <th>Kurs</th>
                    <th>Tilldelad</th>
                    <th>
                      <span className="sr-only">Åtgärd</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.name}</strong>
                        <small className="table-description">{e.email}</small>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/admin/kurser/${e.courseId}`}
                        >
                          {e.courseTitle}
                        </Link>
                      </td>
                      <td>{dateOnly(e.createdAt)}</td>
                      <td>
                        <form action={removeEnrollmentAction}>
                          <input type="hidden" name="id" value={e.id} />
                          <ReturnTo path="/admin/elever" />
                          <button
                            type="submit"
                            className="button button-secondary button-small delete-button"
                          >
                            Ta bort tillgång
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Ingen kurstillgång tilldelad">
              Använd formuläret ovan för att koppla en elev till en kurs.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
