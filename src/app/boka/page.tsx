import type { Metadata } from "next";
import {
  getPractitioners,
  getSettings,
  getSlots,
  getTreatments,
} from "@/lib/db";
import { stripeReady } from "@/lib/stripe";
import { BookingForm } from "@/components/booking-form";
export const metadata: Metadata = { title: "Behandlingar & bokning" };
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
      getSettings(),
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
        <span className="eyebrow">ETT PERSONLIGT MÖTE</span>
        <h1>
          En tid för <em>dig.</em>
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
