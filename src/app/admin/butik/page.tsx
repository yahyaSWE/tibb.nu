import Link from "next/link";
import { Eye } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getShopSettings, shopStripeReady } from "@/lib/shop";
import { shopPaymentProvider, kustomReady } from "@/lib/shop-payment-config";
import { AdminHeading, SectionHeading } from "@/components/admin/common";
import { ShopSettingsForm } from "@/components/admin/shop-forms";

export default async function ShopSettingsPage() {
  await requireAdmin();
  const settings = await getShopSettings();
  const provider = shopPaymentProvider();
  const stripeReady = provider === "kustom" ? kustomReady() : shopStripeReady();
  return (
    <>
      <AdminHeading
        sections={[["butik-betalning", "Betalning"], ["butik-leverans", "Butik och leverans"]]}
        title="Butiksinställningar"
        description="Välj när butiken ska öppna, hur kunderna får sina varor och vilka köpvillkor som gäller."
        action={
          <Link
            href="/admin/butik/forhandsvisa"
            className="button button-secondary"
          >
            <Eye size={18} aria-hidden="true" />
            Förhandsgranska
          </Link>
        }
      />
      <div className="stack">
        <div className={`notice ${settings.enabled ? "notice-success" : ""}`}>
          <strong>
            {settings.enabled
              ? "Butiken är öppen."
              : "Butiken är stängd för besökare."}
          </strong>{" "}
          {settings.enabled
            ? "Publicerade produkter visas på hemsidan."
            : "Du kan lägga in produkter och förhandsgranska innan du öppnar."}
        </div>
        {settings.enabled && <Link href="/butik" className="text-link">Visa butiken på hemsidan</Link>}
        <section id="butik-betalning" tabIndex={-1} className="panel admin-section-target">
          <SectionHeading title="Betalning" />
          <p className="muted">
            {stripeReady
              ? `${provider === "kustom" ? "Kustom Checkout" : "Stripe"}-konfiguration finns. Kontrollera anslutning och betalningsbekräftelser i testmiljön innan skarp användning.`
              : `Butikens ${provider === "kustom" ? "Kustom Checkout" : "Stripe"}-anslutning behöver konfigureras innan du kan öppna. Du kan spara inställningar och produkter under tiden.`}
          </p>
          <span
            className={`badge ${stripeReady ? "badge-green" : "badge-amber"}`}
          >
            {stripeReady ? "Konfiguration finns" : "Konfiguration saknas"}
          </span>
          <p className="small muted">
            För att öppna behöver du också ange köpvillkor, minst ett
            leveranssätt och verksamhetens e-postadress i{" "}
            <Link href="/admin/installningar" className="text-link">
              Inställningar
            </Link>
            .
          </p>
        </section>
        <section id="butik-leverans" tabIndex={-1} className="panel form-panel admin-section-target">
          <SectionHeading
            title="Butik och leverans"
            description="Ange dina egna priser, hämtningsuppgifter och villkor. Ändrade villkor påverkar nya beställningar."
          />
          <ShopSettingsForm settings={settings} />
        </section>
      </div>
    </>
  );
}
