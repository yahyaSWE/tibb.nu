import { getPractitioners, getSlots, getTreatments } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-data";
import { stripeReady } from "@/lib/stripe";
import { createPageMetadata } from "@/lib/seo";
import { BookingForm } from "@/components/booking-form";

export const metadata = createPageMetadata({
  title: "Behandlingar och bokning",
  description:
    "Boka en behandling hos Tibb.nu. Välj behandling, behandlare och en ledig tid. Se längd, pris och betalningsalternativ innan du bekräftar din bokning.",
  path: "/boka",
});
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; behandling?: string }>;
}) {
  const params = await searchParams;
  const [treatments, practitioners, publishedSlots, settings] =
    await Promise.all([
      getTreatments({ activeOnly: true }),
      getPractitioners({ activeOnly: true }),
      getSlots({ futureOnly: true }),
      getSiteSettings(),
    ]);
  const ids = new Set(treatments.map((t) => t.id));
  const practitionerIds = new Set(practitioners.map((p) => p.id));
  const slots = publishedSlots.filter(
    (s) =>
      !s.booked &&
      ids.has(s.treatmentId) &&
      practitionerIds.has(s.practitionerId),
  );
  return (
    <section className="section container">
      <div className="page-heading booking-heading">
        <h1>
          Boka en <em>behandling</em>
        </h1>
        <p>
          Välj behandling, behandlare och en ledig tid. Längd och pris visas
          innan du bekräftar din bokning.
        </p>
      </div>
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
        payOnSite={settings.payOnSite}
        stripeEnabled={settings.stripeEnabled && stripeReady()}
        location={settings.location}
        contactEmail={settings.email}
      />
    </section>
  );
}
