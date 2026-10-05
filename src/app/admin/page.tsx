import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileText,
  Sprout,
} from "lucide-react";
import {
  getArticles,
  getBookings,
  getCourses,
  getEnrollments,
  getSettings,
  getSlots,
} from "@/lib/db";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  dateTime,
  EmptyState,
  kronor,
  SectionHeading,
  StatusBadge,
} from "@/components/admin/common";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  const [bookings, allSlots, courses, articles, enrollments, settings] =
    await Promise.all([
      getBookings(),
      getSlots({ futureOnly: true }),
      getCourses(),
      getArticles(),
      getEnrollments(),
      getSettings(),
    ]);
  const now = new Date().toISOString();
  const upcoming = bookings
    .filter((b) => b.start > now && ["confirmed", "pending"].includes(b.status))
    .sort((a, b) => a.start.localeCompare(b.start));
  const slots = allSlots.filter((slot) => !slot.booked);
  const stats = [
    {
      label: "Kommande bokningar",
      value: upcoming.length,
      href: "/admin/bokningar",
      icon: CalendarDays,
    },
    {
      label: "Lediga tider",
      value: slots.length,
      href: "/admin/tider",
      icon: Sprout,
    },
    {
      label: "Publicerade kurser",
      value: courses.filter((c) => c.published).length,
      href: "/admin/kurser",
      icon: BookOpen,
    },
    {
      label: "Publicerade artiklar",
      value: articles.filter((a) => a.published).length,
      href: "/admin/artiklar",
      icon: FileText,
    },
  ];
  return (
    <>
      <AdminHeading
        eyebrow="Välkommen tillbaka"
        title="Översikt"
        description={`Här tar du hand om ${settings.siteName} – dina bokningar, din kunskap och dina elever.`}
        action={
          <Link href="/admin/tider" className="button button-primary">
            Lägg till en tid
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <div className="stats-grid">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link href={href} className="stat-card" key={label}>
            <div className="stat-card-top">
              <span>{label}</span>
              <Icon size={20} aria-hidden="true" />
            </div>
            <strong className="stat-value">{value}</strong>
            <small>
              Visa översikt <ArrowRight size={14} aria-hidden="true" />
            </small>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading-with-action">
            <SectionHeading title="Nästa besök" />
            <Link href="/admin/bokningar" className="text-link">
              Alla bokningar <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {upcoming.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kund</th>
                    <th>Behandling</th>
                    <th>Tid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.slice(0, 5).map((booking) => (
                    <tr key={booking.id}>
                      <td>
                        <Link
                          className="text-link"
                          href={`/admin/bokningar/${booking.id}`}
                        >
                          {booking.name}
                        </Link>
                      </td>
                      <td>
                        {booking.treatmentName}
                        <small className="table-description">
                          {kronor(booking.priceOre)}
                        </small>
                      </td>
                      <td>{dateTime(booking.start)}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="En ny början">
              Dina kommande besök visas här så snart den första kunden bokar.
            </EmptyState>
          )}
        </section>
        <section className="panel quick-actions">
          <SectionHeading
            title="Låt verksamheten växa"
            description="Dina nästa steg, samlade på ett ställe."
          />
          <Link href="/admin/behandlingar">
            <Sprout size={21} aria-hidden="true" />
            <span>
              <strong>Hantera behandlingar</strong>
              <small>Längder, priser och beskrivningar</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/artiklar/ny">
            <FileText size={21} aria-hidden="true" />
            <span>
              <strong>Skriv en artikel</strong>
              <small>Dela dina tankar och din kunskap</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/kurser/ny">
            <BookOpen size={21} aria-hidden="true" />
            <span>
              <strong>Bygg en ny kurs</strong>
              <small>Lektioner, video och kursmaterial</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/elever">
            <CalendarDays size={21} aria-hidden="true" />
            <span>
              <strong>Hantera elever</strong>
              <small>{enrollments.length} tilldelade kurstillgångar</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>
      <div className="admin-tip">
        <Sprout size={22} aria-hidden="true" />
        <div>
          <strong>En sak i taget.</strong>
          <p>
            Börja med dina behandlingar och bokningsbara tider. Dina artiklar
            och kurser kan växa fram i sin egen takt.
          </p>
        </div>
      </div>
    </>
  );
}
