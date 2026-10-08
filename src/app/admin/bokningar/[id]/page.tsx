import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingById } from "@/lib/db";
import { updateBookingAction } from "@/lib/actions";
import { getBookingEmailStatus, type BookingEmailState } from "@/lib/email-outbox";
import { retryBookingEmailsAction } from "@/lib/account-actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  dateTime,
  Field,
  kronor,
  ReturnTo,
  SectionHeading,
  StatusBadge,
} from "@/components/admin/common";

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const { id } = await params;
  const booking = await getBookingById(Number(id));
  if (!booking) notFound();
  const email = await getBookingEmailStatus(booking.id);
  const emailLabel: Record<BookingEmailState, string> = {
    pending: "Väntar på utskick", sending: "Utskick pågår", sent: "Accepterat av Resend",
    failed: "Utskicket kunde inte slutföras", skipped: "Utskicket stoppades",
  };
  const waitingForStripe =
    booking.paymentMethod === "stripe" && booking.paymentStatus !== "paid";
  return (
    <>
      <AdminHeading
        title={booking.name}
        description={`${booking.treatmentName} · ${dateTime(booking.start)}`}
        action={
          <Link href="/admin/bokningar" className="button button-secondary">
            Alla bokningar
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <div className="split-grid">
        <section className="panel">
          <SectionHeading title="Bokningsuppgifter" />
          <dl className="detail-list">
            <div>
              <dt>Kund</dt>
              <dd>{booking.name}</dd>
            </div>
            <div>
              <dt>E-post</dt>
              <dd>
                <a className="text-link" href={`mailto:${booking.email}`}>
                  {booking.email}
                </a>
              </dd>
            </div>
            <div>
              <dt>Telefon</dt>
              <dd>
                {booking.phone ? (
                  <a className="text-link" href={`tel:${booking.phone}`}>
                    {booking.phone}
                  </a>
                ) : (
                  "Ej angivet"
                )}
              </dd>
            </div>
            <div>
              <dt>Behandling</dt>
              <dd>{booking.treatmentName}</dd>
            </div>
            <div>
              <dt>Behandlare</dt>
              <dd>{booking.practitionerName}</dd>
            </div>
            <div>
              <dt>Start</dt>
              <dd>{dateTime(booking.start)}</dd>
            </div>
            <div>
              <dt>Slut</dt>
              <dd>{dateTime(booking.end)}</dd>
            </div>
            <div>
              <dt>Längd</dt>
              <dd>{booking.durationMinutes} minuter</dd>
            </div>
            <div>
              <dt>Pris</dt>
              <dd>{kronor(booking.priceOre)}</dd>
            </div>
            <div>
              <dt>Betalningssätt</dt>
              <dd>
                {booking.paymentMethod === "onsite"
                  ? "Betalning vid besöket"
                  : "Kort via Stripe"}
              </dd>
            </div>
            <div>
              <dt>Betalningsstatus</dt>
              <dd>
                <StatusBadge status={booking.paymentStatus} />
              </dd>
            </div>
            <div>
              <dt>Bokningsstatus</dt>
              <dd>
                <StatusBadge status={booking.status} />
              </dd>
            </div>
            <div>
              <dt>Skapad</dt>
              <dd>{dateTime(booking.createdAt)}</dd>
            </div>
          </dl>
        </section>
        <section className="panel">
          <SectionHeading title="Hantera bokningen" />
          {booking.status === "cancelled" ? (
            <div className="notice">
              Bokningen är avbokad och kan inte återaktiveras. Kunden kan göra
              en ny bokning.
            </div>
          ) : (
            <form action={updateBookingAction} className="stack">
              <ReturnTo path={`/admin/bokningar/${id}`} />
              <input type="hidden" name="id" value={booking.id} />
              {booking.paymentMethod === "stripe" ? (
                <input
                  type="hidden"
                  name="paymentStatus"
                  value={booking.paymentStatus}
                />
              ) : null}
              {waitingForStripe ? (
                <>
                  <div className="notice">
                    Kortbetalningen har ännu inte bekräftats. Bokningen
                    bekräftas automatiskt när betalningen är klar.
                  </div>
                  <input type="hidden" name="status" value="cancelled" />
                </>
              ) : (
                <Field label="Bokningsstatus" name="status">
                  <select
                    id="status"
                    name="status"
                    defaultValue={booking.status}
                    required
                  >
                    <option value="confirmed">Bekräftad</option>
                    <option value="completed">Genomförd</option>
                    <option value="cancelled">Avbokad</option>
                  </select>
                </Field>
              )}
              {booking.paymentMethod === "onsite" ? (
                <Field
                  label="Betalningsstatus"
                  name="paymentStatus"
                  help="Markera som betald när du har tagit emot betalningen."
                >
                  <select
                    id="paymentStatus"
                    name="paymentStatus"
                    defaultValue={booking.paymentStatus}
                    required
                  >
                    <option value="pending">Obetald</option>
                    <option value="paid">Betald</option>
                  </select>
                </Field>
              ) : (
                <p className="muted">
                  Stripe uppdaterar betalningsstatus automatiskt. En eventuell
                  återbetalning hanteras i Stripe.
                </p>
              )}
              <div>
                <button
                  className={`button ${waitingForStripe ? "button-secondary delete-button" : "button-primary"}`}
                  type="submit"
                >
                  {waitingForStripe ? "Avboka reservation" : "Spara bokning"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <section className="panel form-panel">
        <SectionHeading title="Bokningsmejl" description="Accepterat betyder att Resend har tagit emot meddelandet. Kontrollera faktisk leverans och eventuella studsar i Resend." />
        {!email.configured && <p className="notice">E-posttjänsten är inte ansluten. Bokningen finns kvar; bekräftelser kan skickas när Resend är konfigurerat.</p>}
        <dl className="detail-list">
          {(["customer", "admin"] as const).map((recipient) => (
            <div key={recipient}>
              <dt>{recipient === "customer" ? "Kundbekräftelse" : "Avisering till verksamheten"}</dt>
              <dd>{email[recipient] ? emailLabel[email[recipient].status] : "Inget utskick registrerat"}
                {email[recipient]?.sentAt && <> · {dateTime(email[recipient].sentAt)}</>}
              </dd>
            </div>
          ))}
        </dl>
        {email.configured && booking.status === "confirmed" && Date.parse(booking.start) > Date.now() && (
          <form action={retryBookingEmailsAction}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button className="button button-secondary" type="submit">Behandla väntande utskick</button>
          </form>
        )}
      </section>
    </>
  );
}
