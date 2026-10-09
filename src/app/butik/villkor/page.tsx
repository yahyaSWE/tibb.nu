import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopSettings } from "@/lib/shop";
import { getBusinessSettings } from "@/lib/business-settings";
import { getSiteSettings } from "@/lib/site-data";
import { createPageMetadata, PRIVATE_METADATA } from "@/lib/seo";
import { TextContent } from "@/components/learning/cards";

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
  if (!shop.enabled) notFound();
  const [business, site] = await Promise.all([
    getBusinessSettings(),
    getSiteSettings(),
  ]);
  return (
    <section className="section container narrow prose">
      <h1>Butikens köp- och returvillkor</h1>
      <p>
        Tibb.nu drivs av {business.legalName}, organisationsnummer{" "}
        {business.organizationNumber}.
      </p>
      <TextContent text={shop.terms} />
      <h2>Kontakt</h2>
      {site.email && (
        <p>
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
      )}
      {site.phone && (
        <p>
          <a href={`tel:${site.phone}`}>{site.phone}</a>
        </p>
      )}
      <p>
        <Link href="/butik">Till butiken</Link> ·{" "}
        <Link href="/integritet">Integritet och personuppgifter</Link>
      </p>
    </section>
  );
}
