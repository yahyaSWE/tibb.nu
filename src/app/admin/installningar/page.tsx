import { requireAdmin } from "@/lib/auth";
import { Check, Circle, CreditCard, Wallet } from "lucide-react";
import { getSiteSettings } from "@/lib/site-data";
import { saveSettingsAction } from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  Field,
  ReturnTo,
  SectionHeading,
} from "@/components/admin/common";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const settings = await getSiteSettings();
  const stripeChecks = [
    { label: "Stripe-anslutning", ready: !!process.env.STRIPE_SECRET_KEY },
    {
      label: "Verifiering av betalningshändelser",
      ready: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    { label: "Hemsidans adress", ready: !!process.env.APP_URL },
  ];
  const stripeReady = stripeChecks.every((item) => item.ready);
  return (
    <>
      <AdminHeading
        title="Inställningar"
        description="Uppdatera verksamhetens kontaktuppgifter och välj hur kunder kan betala."
      />
      <AdminNotice searchParams={searchParams} />
      <form action={saveSettingsAction} className="stack">
        <ReturnTo path="/admin/installningar" />
        <section className="panel form-panel">
          <SectionHeading title="Din verksamhet" />
          <div className="stack">
            <Field label="Verksamhetens namn" name="siteName">
              <input
                id="siteName"
                name="siteName"
                required
                maxLength={100}
                defaultValue={settings.siteName}
              />
            </Field>
            <div className="form-grid">
              <Field label="E-post" name="email">
                <input
                  id="email"
                  name="email"
                  type="email"
                  maxLength={254}
                  defaultValue={settings.email}
                  placeholder="kontakt@tibb.nu"
                />
              </Field>
              <Field label="Telefon" name="phone">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  maxLength={40}
                  defaultValue={settings.phone}
                  placeholder="Ditt telefonnummer"
                />
              </Field>
            </div>
            <Field label="Besöksadress" name="address">
              <input
                id="address"
                name="address"
                maxLength={250}
                defaultValue={settings.address}
                placeholder="Gatuadress, postnummer och ort"
              />
            </Field>
            <Field
              label="Plats eller besöksform"
              name="location"
              help="Visas på bokningssidan, till exempel mottagningens namn eller besök online."
            >
              <input
                id="location"
                name="location"
                required
                maxLength={150}
                defaultValue={settings.location}
              />
            </Field>
          </div>
        </section>
        <section className="panel form-panel">
          <SectionHeading
            title="Betalningar"
            description="Aktivera de betalningssätt som dina kunder ska kunna välja."
          />
          <div className="payment-option">
            <Wallet size={23} aria-hidden="true" />
            <div>
              <h3>Betalning vid besöket</h3>
              <p className="muted">
                Bokningen bekräftas direkt. Markera betalningen som mottagen i
                bokningen.
              </p>
              <label className="form-check">
                <input
                  type="checkbox"
                  name="payOnSite"
                  defaultChecked={settings.payOnSite}
                />
                <span>Tillåt betalning vid besöket</span>
              </label>
            </div>
          </div>
          <div className="payment-option">
            <CreditCard size={23} aria-hidden="true" />
            <div>
              <h3>
                Kortbetalning via Stripe{" "}
                <span
                  className={`badge ${stripeReady ? "badge-green" : "badge-amber"}`}
                >
                  {stripeReady ? "Ansluten" : "Anslutning saknas"}
                </span>
              </h3>
              <p className="muted">
                Kunden betalar tryggt i Stripe. Bokningen bekräftas när
                betalningen har verifierats.
              </p>
              <ul className="credential-status">
                {stripeChecks.map((item) => (
                  <li key={item.label}>
                    {item.ready ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Circle size={16} aria-hidden="true" />
                    )}
                    <span>
                      {item.label}: {item.ready ? "klar" : "saknas"}
                    </span>
                  </li>
                ))}
              </ul>
              {!stripeReady ? (
                <div className="notice">
                  Anslut Stripe i serverns konfiguration innan du aktiverar
                  kortbetalning. Följ betalningsguiden i projektets README.
                </div>
              ) : null}
              <label className="form-check">
                <input
                  type="checkbox"
                  name="stripeEnabled"
                  disabled={!stripeReady}
                  defaultChecked={settings.stripeEnabled && stripeReady}
                />
                <span>Aktivera kortbetalning</span>
              </label>
            </div>
          </div>
        </section>
        <div>
          <button className="button button-primary" type="submit">
            Spara inställningar
          </button>
        </div>
      </form>
    </>
  );
}
