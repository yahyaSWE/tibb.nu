import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock3 } from "lucide-react";
import { getBookingByReference, getSettings } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/time";
import { PRIVATE_METADATA } from "@/lib/seo";
import { getBookingTerms } from "@/lib/business-settings";
import { TextContent } from "@/components/learning/cards";
import { cancellationText } from "@/lib/business-config";
import { getBookingEmailStatus } from "@/lib/email-outbox";

export const metadata = {
  ...PRIVATE_METADATA,
  title: "Din bokning",
};
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (!ref || !/^[a-f0-9]{32}$/.test(ref)) notFound();
  const booking = await getBookingByReference(ref);
  if (!booking) notFound();
  const [settings, email, terms] = await Promise.all([
    getSettings(), getBookingEmailStatus(booking.id), getBookingTerms(ref),
  ]);
  const pending = booking.status === "pending";
  const cancelled = booking.status === "cancelled";
  return (
    <section className="section container narrow">
      <div className="panel confirmation-panel">
        <span className="confirm-icon">
          {pending ? (
            <Clock3 size={29} />
          ) : cancelled ? (
            <Clock3 size={29} />
          ) : (
            <Check size={30} />
          )}
        </span>
        <span className="eyebrow">
          {pending
            ? "INVÄNTAR BETALNING"
            : cancelled
              ? "BOKNINGEN ÄR AVBOKAD"
              : "VI SER FRAM EMOT DITT BESÖK"}
        </span>
        <h1>
          {pending
            ? "Din betalning behandlas."
            : cancelled
              ? "Din tid är inte reserverad."
              : "Du har en tid bokad."}
        </h1>
        <p>
          {pending
            ? "Bokningen bekräftas när Stripe har bekräftat betalningen. Uppdatera sidan om en stund."
            : cancelled
              ? "Bokningen har avbokats eller betalningstiden har löpt ut."
              : "Spara den här sidan så att du har alla uppgifter inför ditt besök."}
        </p>
        <dl className="detail-list">
          <div>
            <dt>Behandling</dt>
            <dd>{booking.treatmentName}</dd>
          </div>
          <div>
            <dt>Behandlare</dt>
            <dd>{booking.practitionerName}</dd>
          </div>
          <div>
            <dt>Tid</dt>
            <dd>{formatDateTime(booking.start)}</dd>
          </div>
          <div>
            <dt>Längd</dt>
            <dd>{booking.durationMinutes} minuter</dd>
          </div>
          <div>
            <dt>Pris</dt>
            <dd>{formatMoney(booking.priceOre)}</dd>
          </div>
          <div>
            <dt>Betalning</dt>
            <dd>
              {booking.paymentStatus === "paid"
                ? "Betald"
                : booking.paymentStatus === "refunded"
                  ? "Återbetald"
                  : booking.paymentMethod === "onsite"
                    ? "Vid besöket"
                    : "Inväntar bekräftelse"}
            </dd>
          </div>
          <div>
            <dt>Plats</dt>
            <dd>
              {settings.address || settings.location || "Kontakta mottagningen"}
            </dd>
          </div>
        </dl>
        <p className="booking-reference">
          Bokningsreferens: {booking.reference}
        </p>
        {!pending && !cancelled && (
          <p className="muted">
            {email.customer?.status === "sent"
              ? "E-posttjänsten har accepterat din bekräftelse. Kontrollera inkorg och skräppost. Spara även den här sidan."
              : email.configured && (email.customer?.status === "pending" || email.customer?.status === "sending")
                ? "Din tid är bokad. E-postbekräftelsen väntar på utskick; spara den här sidan."
                : "Din tid är bokad. Spara den här sidan som bekräftelse; någon e-postbekräftelse är ännu inte skickad."}
          </p>
        )}
        {settings.email && (
          <p style={{ fontSize: 12, marginTop: 18 }}>
            För frågor eller avbokning, skriv till{" "}
            <a
              className="text-link"
              href={`mailto:${settings.email}?subject=${encodeURIComponent("Bokning " + booking.reference)}`}
            >
              {settings.email}
            </a>
            .
          </p>
        )}
        {terms ? <>
          <p>{cancellationText(terms.cancellationHours)}</p>
          {terms.cancellationDetails && <TextContent text={terms.cancellationDetails} />}
        </> : <p>Se <Link href="/villkor">aktuella allmänna bokningsvillkor</Link> eller kontakta verksamheten om villkoren för denna bokning.</p>}
        {terms && <p><Link href="/villkor">Aktuella allmänna villkor</Link></p>}
        <div className="form-actions">
          {pending && (
            <a
              className="button button-primary"
              href={`/bokning/bekraftelse?ref=${ref}`}
            >
              Uppdatera status
            </a>
          )}
          <Link
            href={cancelled ? "/boka" : "/"}
            className="button button-secondary"
          >
            {cancelled ? "Välj en ny tid" : "Till startsidan"}
          </Link>
        </div>
      </div>
    </section>
  );
}
