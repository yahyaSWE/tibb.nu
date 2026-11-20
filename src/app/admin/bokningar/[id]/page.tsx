import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingById } from "@/lib/db";
import { handleCancelledBookingPaymentAction, updateBookingAction, saveBookingMeetingLinkAction } from "@/lib/actions";
import { getBookingEmailStatus, type BookingEmailState } from "@/lib/email-outbox";
import { retryBookingEmailsAction } from "@/lib/account-actions";
import { SubmitButton } from "@/components/admin/submit-button";
import { getBookingCancellation, getBookingCancellationHours } from "@/lib/booking-cancellations";
import { bookingCancellationDecision, bookingCancellationStatusText, bookingCancellationText } from "@/lib/booking-cancellation-policy";
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
  const [email, cancellation] = await Promise.all([getBookingEmailStatus(booking.id), getBookingCancellation(booking.id)]);
  const cancellationEmail = cancellation ? await getBookingEmailStatus(booking.id, "cancellation") : null;
  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const decision = canCancel ? bookingCancellationDecision(booking, await getBookingCancellationHours(booking.reference), Date.now()) : null;
  const paymentAction = cancellation?.decision === "refund" && booking.paymentStatus === "paid"
    ? booking.paymentMethod === "onsite" ? "refunded" : "check"
    : cancellation?.decision === "collect" && booking.paymentMethod === "onsite" && booking.paymentStatus === "pending" ? "paid" : null;
  const emailLabel: Record<BookingEmailState, string> = {
    pending: "Väntar på utskick", sending: "Utskick pågår", sent: "Accepterat av Resend",
    failed: "Utskicket kunde inte slutföras", skipped: "Utskicket stoppades",
  };
  const waitingForPayment =
    booking.paymentMethod !== "onsite" && booking.paymentStatus !== "paid";
  return (
    <>
      <AdminHeading
        sections={[
          ["bokningsuppgifter", "Bokningsuppgifter"],
          ["hantera-bokning", "Hantera bokningen"],
          ...(booking.deliveryMode === "remote" ? [["distansmote", "Distansmöte"]] as const : []),
          ["bokningsmejl", "Bokningsmejl"],
        ]}
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
        <section id="bokningsuppgifter" tabIndex={-1} className="panel admin-section-target">
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
            <div><dt>Besöksform</dt><dd>{booking.deliveryMode === "remote" ? "Distans · digitalt möte" : "På plats"}</dd></div>
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
            {booking.discount && <div>
              <dt>Rabattkod {booking.discount.code}</dt>
              <dd>−{kronor(booking.discount.amountOre)}</dd>
            </div>}
            <div>
              <dt>Pris</dt>
              <dd>{kronor(booking.priceOre)}</dd>
            </div>
            <div>
              <dt>Betalningssätt</dt>
              <dd>
                {booking.paymentMethod === "onsite"
                  ? "Betalning vid besöket"
                  : booking.paymentMethod === "kustom" ? "Via Kustom" : "Kort via Stripe"}
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
        <section id="hantera-bokning" tabIndex={-1} className="panel admin-section-target">
          <SectionHeading title="Hantera bokningen" />
          {booking.status === "cancelled" ? <>
            <p className="notice">
              {cancellation ? bookingCancellationStatusText(cancellation.decision, booking) : "Bokningen är avbokad."}
            </p>
            {paymentAction && <form action={handleCancelledBookingPaymentAction} className="stack">
              <ReturnTo path={`/admin/bokningar/${id}`} />
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="paymentAction" value={paymentAction} />
              {paymentAction === "refunded" && <p>Återbetala till kunden via det ursprungliga betalningssättet innan du markerar det som klart här.</p>}
              {paymentAction === "paid" && <p>Registrera betalningen när du har tagit emot den.</p>}
              <div><SubmitButton className="button button-secondary">
                {paymentAction === "check" ? "Kontrollera återbetalning" : paymentAction === "paid" ? "Markera som betald" : "Registrera genomförd återbetalning"}
              </SubmitButton></div>
            </form>}
          </> : waitingForPayment ? (
            <p className="notice">Bokningen bekräftas automatiskt när betalningen har verifierats.</p>
          ) : (
            <form action={updateBookingAction} className="stack">
              <ReturnTo path={`/admin/bokningar/${id}`} />
              <input type="hidden" name="id" value={booking.id} />
              {booking.paymentMethod !== "onsite" ? (
                <input
                  type="hidden"
                  name="paymentStatus"
                  value={booking.paymentStatus}
                />
              ) : null}
                <Field label="Bokningsstatus" name="status">
                  <select
                    id="status"
                    name="status"
                    defaultValue={booking.status}
                    required
                  >
                    <option value="confirmed">Bekräftad</option>
                    <option value="completed">Genomförd</option>
                  </select>
                </Field>
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
                  Betalningsstatus uppdateras när betalningsleverantören bekräftar betalningen eller återbetalningen.
                </p>
              )}
              <div>
                <button
                  className="button button-primary"
                  type="submit"
                >
                  Spara bokning
                </button>
              </div>
            </form>
          )}
          {decision && <details className="notice">
            <summary>Avboka bokningen</summary>
            <form action={updateBookingAction} className="stack">
              <ReturnTo path={`/admin/bokningar/${id}`} />
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="status" value="cancelled" />
              <input type="hidden" name="decision" value={decision} />
              <p>{bookingCancellationText(decision, booking.priceOre)}</p>
              <div><SubmitButton pendingLabel="Avbokar…" className="button button-danger">Bekräfta avbokning</SubmitButton></div>
            </form>
          </details>}
        </section>
      </div>
      {booking.deliveryMode === "remote" && <section id="distansmote" tabIndex={-1} className="panel form-panel admin-section-target">
        <SectionHeading title="Distansmöte" description="Lägg till länken från till exempel Google Meet, Zoom eller Teams. Kunden hittar den på sin privata bokningssida via länken i bokningsbekräftelsen." />
        {booking.status === "pending" || booking.status === "confirmed" ? <form action={saveBookingMeetingLinkAction} className="stack">
          <ReturnTo path={`/admin/bokningar/${id}`} />
          <input type="hidden" name="id" value={booking.id} />
          <Field label="Möteslänk" name="meetingUrl" help="Länken visas för kunden först när bokningen är bekräftad. Lämna fältet tomt för att ta bort länken.">
            <input id="meetingUrl" name="meetingUrl" type="url" maxLength={2000} defaultValue={booking.meetingUrl} placeholder="https://meet.google.com/…" autoComplete="off" />
          </Field>
          <div><SubmitButton>Spara möteslänk</SubmitButton></div>
          <p className="muted">Den sparade länken visas på bokningssidan. Inget nytt mejl skickas när du ändrar den.</p>
        </form> : <p className="muted">Bokningen är {booking.status === "cancelled" ? "avbokad" : "genomförd"}. Möteslänken visas inte längre för kunden.</p>}
      </section>}
      <section id="bokningsmejl" tabIndex={-1} className="panel form-panel admin-section-target">
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
        {cancellationEmail && <dl className="detail-list">
          <div><dt>Avbokningsmejl till kunden</dt><dd>{cancellationEmail.customer ? emailLabel[cancellationEmail.customer.status] : "Inget utskick registrerat"}</dd></div>
          <div><dt>Avbokningsmejl till verksamheten</dt><dd>{cancellationEmail.admin ? emailLabel[cancellationEmail.admin.status] : "Inget utskick registrerat"}</dd></div>
        </dl>}
        {cancellationEmail?.configured && <form action={retryBookingEmailsAction}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="event" value="cancellation" />
          <button className="button button-secondary" type="submit">Behandla avbokningsmejl</button>
        </form>}
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
