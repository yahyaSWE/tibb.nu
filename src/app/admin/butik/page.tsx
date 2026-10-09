import Link from "next/link";
import { Eye, Package, ShoppingBag } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getShopSettings, shopStripeReady } from "@/lib/shop";
import { AdminHeading, SectionHeading } from "@/components/admin/common";
import { ShopSettingsForm } from "@/components/admin/shop-forms";

export default async function ShopSettingsPage() {
  await requireAdmin();
  const settings = await getShopSettings();
  const stripeReady = shopStripeReady();
  return (
    <>
      <AdminHeading
        eyebrow="Din butik"
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
        <div className="shop-page-actions">
          <Link href="/admin/rabatter" className="button button-secondary">Rabatter</Link>
          <Link href="/admin/frakt" className="button button-secondary">Fraktregler</Link>
          <Link href="/admin/produkter" className="button button-secondary">
            <Package size={18} aria-hidden="true" />
            Produkter
          </Link>
          <Link href="/admin/bestallningar" className="button button-secondary">
            <ShoppingBag size={18} aria-hidden="true" />
            Beställningar
          </Link>
          {settings.enabled && (
            <Link href="/butik" className="text-link">
              Visa butiken på hemsidan ↗
            </Link>
          )}
        </div>
        <section className="panel">
          <SectionHeading title="Betalning" />
          <p className="muted">
            {stripeReady
              ? "Stripe-konfiguration finns för butikens kortbetalningar. Anslutningen och webhooken behöver vara korrekt inställda hos Stripe för att betalningar ska bekräftas."
              : "Butikens Stripe-anslutning behöver konfigureras innan du kan öppna. Du kan spara inställningar och produkter under tiden."}
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
        <section className="panel form-panel">
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
