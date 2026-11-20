import { getPractitioners, getSlots, getTreatments } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-data";
import { stripeReady } from "@/lib/stripe";
import { kustomBookingReady, shopPaymentProvider } from "@/lib/shop-payment-config";
import { createPageMetadata } from "@/lib/seo";
import { BookingForm } from "@/components/booking-form";
import { getBusinessSettings } from "@/lib/business-settings";
import { cancellationText } from "@/lib/business-config";
import "./booking.css";

export const metadata = createPageMetadata({
  title: "Behandlingar och bokning",
  description:
    "Boka en behandling hos Tibb.nu. Välj behandling, behandlare och en ledig tid. Se längd, pris och betalningsalternativ innan du bekräftar din bokning.",
  path: "/boka",
});
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; behandling?: string; behandlare?: string }>;
}) {
  const params = await searchParams;
  const [treatments, practitioners, publishedSlots, settings, business] =
    await Promise.all([
      getTreatments({ activeOnly: true }),
      getPractitioners({ activeOnly: true }),
      getSlots({ futureOnly: true }),
      getSiteSettings(),
      getBusinessSettings(),
    ]);
  const ids = new Set(treatments.map((t) => t.id));
  const practitionerIds = new Set(practitioners.map((p) => p.id));
  const onlineProvider = shopPaymentProvider();
  const slots = publishedSlots.filter(
    (s) =>
      !s.booked &&
      ids.has(s.treatmentId) &&
      practitionerIds.has(s.practitionerId),
  );
  return (
    <section className="section container booking-page">
      <header className="booking-heading">
        <h1>
          Boka en <em>behandling</em>
        </h1>
      </header>
      {params.error && (
        <div className="notice notice-error" role="alert">
          {params.error}
        </div>
      )}
      <BookingForm
        treatments={treatments}
        practitioners={practitioners}
        slots={slots}
        initialTreatment={Number(params.behandling) || undefined}
        initialPractitioner={Number(params.behandlare) || undefined}
        payOnSite={onlineProvider !== "kustom" && settings.payOnSite}
        onlineEnabled={onlineProvider === "kustom" ? settings.kustomBookingEnabled && kustomBookingReady() : settings.stripeEnabled && stripeReady()}
        onlineProvider={onlineProvider}
        location={[settings.location, settings.address].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" · ")}
        contactEmail={settings.email}
        cancellationNotice={cancellationText(business.cancellationHours)}
      />
    </section>
  );
}
