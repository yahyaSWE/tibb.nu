import Link from "next/link";
import { WithdrawalForm } from "@/components/shop/withdrawal-form";
import { getSiteSettings } from "@/lib/site-data";
import { PRIVATE_METADATA } from "@/lib/seo";
import { withdrawalFormPath } from "@/lib/withdrawal-form-text";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Ångra köp av friskvård", referrer: "no-referrer" as const };

export default async function WithdrawWellnessPage() {
  const settings = await getSiteSettings();
  return (
    <section className="shop section container narrow">
      <div className="shop-order-panel stack">
        <Link className="back-link" href="/friskvard">Till friskvård</Link>
        <h1 className="page-title">Ångra köp</h1>
        <p>Använd formuläret för att meddela oss att du ångrar ditt friskvårdsköp. Du får ett mottagningsbevis med datum och klockslag.</p>
        <WithdrawalForm />
        <p className="muted">Du kan också <a className="inline-link" href={withdrawalFormPath}>ladda ner ångerblanketten</a> eller {settings.email ? <a className="inline-link" href={`mailto:${settings.email}`}>mejla oss</a> : <Link className="inline-link" href="/kontakt">kontakta oss</Link>}.</p>
      </div>
    </section>
  );
}
