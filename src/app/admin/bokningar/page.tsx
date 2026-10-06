import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getBookings } from "@/lib/db";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  dateTime,
  EmptyState,
  kronor,
  StatusBadge,
} from "@/components/admin/common";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const query = await searchParams;
  const bookings = await getBookings();
  const selected = typeof query.status === "string" ? query.status : "all";
  const filtered =
    selected === "all"
      ? bookings
      : bookings.filter((b) => b.status === selected);
  const filters = [
    { value: "all", label: "Alla" },
    { value: "confirmed", label: "Bekräftade" },
    { value: "pending", label: "Väntar på betalning" },
    { value: "completed", label: "Genomförda" },
    { value: "cancelled", label: "Avbokade" },
  ];
  return (
    <>
      <AdminHeading
        title="Bokningar"
        description="Se dina bokningar, kunduppgifter och betalningar på ett och samma ställe."
      />
      <AdminNotice searchParams={searchParams} />
      <nav className="admin-filter-tabs" aria-label="Filtrera bokningar">
        {filters.map((f) => (
          <Link
            key={f.value}
            className={`button button-small ${selected === f.value ? "button-primary" : "button-secondary"}`}
            href={
              f.value === "all"
                ? "/admin/bokningar"
                : `/admin/bokningar?status=${f.value}`
            }
            aria-current={selected === f.value ? "page" : undefined}
          >
            {f.label}{" "}
            <span>
              (
              {f.value === "all"
                ? bookings.length
                : bookings.filter((b) => b.status === f.value).length}
              )
            </span>
          </Link>
        ))}
      </nav>
      <section className="panel">
        {filtered.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kund</th>
                  <th>Datum och tid</th>
                  <th>Behandling</th>
                  <th>Behandlare</th>
                  <th>Betalning</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Åtgärd</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <strong>{booking.name}</strong>
                      <small className="table-description">
                        {booking.email}
                      </small>
                    </td>
                    <td>{dateTime(booking.start)}</td>
                    <td>
                      {booking.treatmentName}
                      <small className="table-description">
                        {booking.durationMinutes} minuter
                      </small>
                    </td>
                    <td>{booking.practitionerName}</td>
                    <td>
                      <strong>{kronor(booking.priceOre)}</strong>
                      <small className="table-description">
                        <StatusBadge status={booking.paymentStatus} />
                      </small>
                    </td>
                    <td>
                      <StatusBadge status={booking.status} />
                    </td>
                    <td>
                      <Link
                        href={`/admin/bokningar/${booking.id}`}
                        className="button button-secondary button-small"
                      >
                        Visa bokning
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              bookings.length
                ? "Inga bokningar i den här vyn"
                : "Redo för dina första bokningar"
            }
            href={bookings.length ? "/admin/bokningar" : "/admin/tider"}
            label={
              bookings.length
                ? "Visa alla bokningar"
                : "Publicera bokningsbara tider"
            }
          >
            {bookings.length
              ? "Välj ett annat filter för att se fler bokningar."
              : "Lägg upp tillgängliga tider så kan kunder boka på hemsidan."}
          </EmptyState>
        )}
      </section>
    </>
  );
}
