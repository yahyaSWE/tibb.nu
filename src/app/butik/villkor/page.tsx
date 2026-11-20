import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopSettings, wellnessCheckoutReady } from "@/lib/shop";
import { getBusinessSettings } from "@/lib/business-settings";
import { getSiteSettings } from "@/lib/site-data";
import { createPageMetadata, PRIVATE_METADATA } from "@/lib/seo";
import { TextContent } from "@/components/learning/cards";
import { getWellnessSeller } from "@/lib/wellness";
import { withdrawalFormPath, withdrawalPath } from "@/lib/withdrawal-form-text";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return (await getShopSettings()).enabled
    ? createPageMetadata({
        title: "Butikens köp- och returvillkor",
        description:
          "Köp- och returvillkor för produkter som beställs i Tibb.nu:s butik.",
        path: "/butik/villkor",
      })
    : PRIVATE_METADATA;
}
export default async function ShopTermsPage() {
  const shop = await getShopSettings();
  if (!shop.enabled && !await wellnessCheckoutReady(shop)) notFound();
  const [business, site, seller] = await Promise.all([
    getBusinessSettings(),
    getSiteSettings(),
    getWellnessSeller(),
  ]);
  return (
    <section className="section container narrow prose">
      <h1>{shop.enabled ? "Butikens köp- och returvillkor" : "Köpvillkor för friskvård"}</h1>
      <p>
        Tibb.nu drivs av {shop.enabled ? business.legalName : seller.legalName}, organisationsnummer{" "}
        {shop.enabled ? business.organizationNumber : seller.organizationNumber}.
      </p>
      <TextContent text={shop.terms} />
      <p><Link href={withdrawalPath}>Ångra ett friskvårdsköp</Link> · <a href={withdrawalFormPath}>Ladda ner ångerblanketten</a></p>
      <h2>Kontakt</h2>
      {!shop.enabled && <p>{seller.address}</p>}
      {site.email && (
        <p>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
      )}
      {(shop.enabled ? site.phone : seller.phone) && (
        <p>
          <a href={`tel:${shop.enabled ? site.phone : seller.phone}`}>{shop.enabled ? site.phone : seller.phone}</a>
        </p>
      )}
      <p>
        <Link href={shop.enabled ? "/butik" : "/friskvard"}>{shop.enabled ? "Till butiken" : "Till friskvård"}</Link> ·{" "}
        <Link href="/integritet">Integritet och personuppgifter</Link>
      </p>
    </section>
  );
}
