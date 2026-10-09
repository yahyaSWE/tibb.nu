import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, ShoppingBag, Truck, MapPin } from "lucide-react";
import { createPageMetadata, PRIVATE_METADATA } from "@/lib/seo";
import { ProductCard } from "@/components/shop/product-card";
import { ShopCartLink } from "@/components/shop/shop-cart";
import {
  shopSettingsForRender,
  shopProductsForRender,
} from "@/components/shop/server-data";
import { formatMoney } from "@/lib/time";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return (await shopSettingsForRender()).enabled
    ? createPageMetadata({
        title: "Butik",
        description:
          "Utforska Tibb.nu:s aktuella sortiment. Se produktbeskrivningar, priser inklusive moms och tillgänglighet innan du beställer.",
        path: "/butik",
      })
    : PRIVATE_METADATA;
}
export default async function ShopPage() {
  const settings = await shopSettingsForRender();
  if (!settings.enabled) notFound();
  const products = await shopProductsForRender();
  return (
    <div className="shop">
      <section className="section container shop-hero">
        <div>
          <p className="eyebrow">Tibb butik</p>
          <h1 className="page-title">
            Utvalt för <em>din vardag.</em>
          </h1>
          <p className="lead muted">
            Utforska vårt aktuella sortiment. Här ser du beskrivningar, priser
            och tillgänglighet innan du beställer.
          </p>
          <ShopCartLink />
        </div>
        <div className="shop-hero-art" aria-hidden="true">
          <span />
          <ShoppingBag size={128} strokeWidth={0.9} />
          <p>Omsorg i varje val.</p>
        </div>
      </section>
      <section className="section container shop-catalog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vårt sortiment</p>
            <h2>Produkter</h2>
          </div>
          <span className="muted">
            {products.length} {products.length === 1 ? "produkt" : "produkter"}
          </span>
        </div>
        {products.length > 0 ? (
          <div className="shop-product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="shop-empty">
            <Package size={38} aria-hidden="true" />
            <h3>Sortimentet uppdateras.</h3>
            <p className="muted">Här visas våra produkter när de publiceras.</p>
          </div>
        )}
        <div className="shop-service-notes">
          <p>Priser i SEK inklusive moms.</p>
          {settings.shippingEnabled && (
            <p>
              <Truck size={18} aria-hidden="true" />
              {settings.shippingRuleMode?"Frakt beräknas från vikt och postnummer":`Frakt ${formatMoney(settings.shippingPriceOre)}`}
              {settings.freeShippingThresholdOre !== null &&
                ` · fri frakt från ${formatMoney(settings.freeShippingThresholdOre)}`}
            </p>
          )}
          {settings.pickupEnabled && (
            <p>
              <MapPin size={18} aria-hidden="true" />
              Hämtning utan fraktkostnad
            </p>
          )}
          <Link href="/butik/villkor" className="inline-link">
            Köpvillkor
          </Link>
        </div>
      </section>
    </div>
  );
}
