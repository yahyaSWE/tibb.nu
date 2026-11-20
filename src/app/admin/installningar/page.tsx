import { requireAdmin } from "@/lib/auth";
import { CreditCard } from "lucide-react";
import { getSiteSettings } from "@/lib/site-data";
import { saveSettingsAction } from "@/lib/actions";
import { getBusinessSettings } from "@/lib/business-settings";
import { BusinessSettingsForm } from "@/components/admin/business-settings-form";
import { emailConfigurationStatus } from "@/lib/email-provider";
import { bookingVatPercent, kustomBookingReady } from "@/lib/shop-payment-config";
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
  const [settings, business] = await Promise.all([getSiteSettings(), getBusinessSettings()]);
  const paymentReady = kustomBookingReady();
  const paymentEnabled = paymentReady && settings.kustomBookingEnabled;
  const email = emailConfigurationStatus();
  return (
    <>
      <AdminHeading
        sections={[["kontakt", "Kontaktuppgifter"], ["betalningar", "Betalningar"], ["villkor", "Verksamhet och villkor"], ["epost", "E-poststatus"]]}
        title="Inställningar"
        description="Uppdatera verksamhetens kontaktuppgifter och välj hur kunder kan betala."
      />
      <AdminNotice searchParams={searchParams} />
      <div className="stack">
        <form action={saveSettingsAction} className="stack">
          <ReturnTo path="/admin/installningar" />
          <section id="kontakt" tabIndex={-1} className="panel form-panel admin-section-target">
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
          <section id="betalningar" tabIndex={-1} className="panel form-panel admin-section-target">
            <SectionHeading
              title="Betalningar"
              description="Styr betalning för nya behandlingsbokningar på webbplatsen och via MCP."
            />
            <div className="payment-option">
              <CreditCard size={23} aria-hidden="true" />
              <div>
                <h3>
                  Kustom Checkout{" "}
                  <span
                    className={`badge ${paymentEnabled ? "badge-green" : "badge-amber"}`}
                  >
                    {paymentEnabled ? "Aktiverad" : paymentReady ? "Pausad" : "Konfiguration saknas"}
                  </span>
                </h3>
                <p className="muted">
                  Kunden betalar hos Kustom. Bokningen bekräftas när
                  betalningen har verifierats.
                </p>
                {paymentReady ? <p className="muted">Behandlingspriserna inkluderar {bookingVatPercent()} % moms.</p> : (
                  <div className="notice">
                    Komplettera Kustoms serverinställningar innan kassan kan öppnas.
                  </div>
                )}
                <label className="form-check">
                  <input
                    type="checkbox"
                    name="kustomBookingEnabled"
                    defaultChecked={settings.kustomBookingEnabled}
                  />
                  <span>Aktivera Kustom för behandlingsbokningar</span>
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
        <BusinessSettingsForm settings={business} />
        <section id="epost" tabIndex={-1} className="panel form-panel admin-section-target">
          <SectionHeading title="E-post" description="Resend används för verifiering av elevkonton, återställning av lösenord och bokningsbekräftelser." />
          <p className={`badge ${email.configured ? "badge-green" : "badge-amber"}`}>{email.configured ? "Konfiguration finns" : "Anslutning saknas"}</p>
          <p className="muted">{email.configured ? "Verifiera avsändardomänen och kontrollera ett testutskick i Resend innan kundlansering." : email.reason}</p>
          <p className="muted">Utskickens status visas i varje bokning. Leverans och studsar kontrolleras i Resend.</p>
        </section>
      </div>
    </>
  );
}
