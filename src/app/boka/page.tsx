import type { Metadata } from "next";
import { getSettings, getSlots, getTreatments } from "@/lib/db";
import { stripeReady } from "@/lib/stripe";
import { BookingForm } from "@/components/booking-form";
export const metadata: Metadata = { title: "Behandlingar & bokning" };
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; behandling?: string }>;
}) {
  const params = await searchParams;
  const treatments = await getTreatments({ activeOnly: true });
  const ids = new Set(treatments.map((t) => t.id));
  const slots = (await getSlots({ futureOnly: true })).filter(
    (s) => !s.booked && ids.has(s.treatmentId),
  );
  const settings = await getSettings();
  return (
    <section className="section container">
      <div className="page-heading booking-heading">
        <span className="eyebrow">ETT PERSONLIGT MÖTE</span>
        <h1>
          En tid för <em>dig.</em>
        </h1>
        <p>
          Välj en behandling och en ledig tid. Längd och pris visas innan du
          bekräftar din bokning.
        </p>
      </div>
      {params.error && (
        <div className="notice notice-error" role="alert">
          {params.error}
        </div>
      )}
      <BookingForm
        treatments={treatments}
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
