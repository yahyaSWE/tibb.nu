import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileText,
  ShoppingBag,
  Sprout,
  TicketPercent,
  Users,
} from "lucide-react";
import {
  getArticles,
  getBookings,
  getCourses,
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
  await requireAdmin();
  const [bookings, allSlots, courses, articles] =
    await Promise.all([
      getBookings(),
      getSlots({ futureOnly: true }),
      getCourses(),
      getArticles(),
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
        title="Översikt"
        description="Se kommande besök och gå direkt till vanliga uppgifter."
        action={
          <Link href="/admin/tider#skapa-tider" className="button button-primary">
            Lägg till en tid
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <ul className="admin-summary" aria-label="Verksamheten i siffror">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <li key={label}>
            <Link href={href}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </Link>
          </li>
        ))}
      </ul>
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
            <EmptyState title="Inga kommande besök">
              Nya bokningar visas här när de kommer in.
            </EmptyState>
          )}
        </section>
        <section className="panel quick-actions">
          <SectionHeading title="Genvägar" />
          <Link href="/admin/bestallningar">
            <ShoppingBag size={20} aria-hidden="true" />
            <strong>Hantera beställningar</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/friskvard#manuellt-kop">
            <TicketPercent size={20} aria-hidden="true" />
            <strong>Registrera friskvårdsköp</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/artiklar/ny">
            <FileText size={20} aria-hidden="true" />
            <strong>Skriv en artikel</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/kurser/ny">
            <BookOpen size={20} aria-hidden="true" />
            <strong>Skapa en kurs</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/admin/elever#tilldela-kurs">
            <Users size={20} aria-hidden="true" />
            <strong>Tilldela en kurs</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </>
  );
}
