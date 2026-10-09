import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Truck, MapPin } from "lucide-react";
import {
  createPageMetadata,
  PRIVATE_METADATA,
  seoDescription,
} from "@/lib/seo";
import { TextContent } from "@/components/learning/cards";
import { ProductImage } from "@/components/shop/product-card";
import { ProductRichText } from "@/components/shop/product-rich-text";
import { productRichTextText } from "@/lib/product-rich-text";
import { AddToCart, ShopCartLink } from "@/components/shop/shop-cart";
import {
  shopProductForRender,
  shopSettingsForRender,
} from "@/components/shop/server-data";
import { formatMoney } from "@/lib/time";
import {getPublicShopOffers} from "@/lib/shop";
import {shopProductsForRender} from "@/components/shop/server-data";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const product = await shopProductForRender((await params).slug);
  return product
    ? createPageMetadata({
        title: product.name,
        description: seoDescription(
          product.description || productRichTextText(product.richDescription ?? null),
          `Se pris och information om ${product.name} hos Tibb.nu.`,
        ),
        path: `/butik/${product.slug}`,
      })
    : PRIVATE_METADATA;
}
export default async function ProductPage({ params }: Props) {
  const product = await shopProductForRender((await params).slug);
  if (!product) notFound();
  const settings = await shopSettingsForRender();
  if (!settings.enabled) notFound();
  const [offers,catalog]=await Promise.all([getPublicShopOffers(),shopProductsForRender()]);
  const matchingOffers=product.kind === "bundle"?[]:offers.filter(offer=>!offer.productIds.length||offer.productIds.includes(product.id));
  return (
    <div className="shop section container">
      <div className="shop-page-top">
        <Link href="/butik" className="back-link">
          <ArrowLeft size={17} aria-hidden="true" /> Till butiken
        </Link>
        <ShopCartLink />
      </div>
      <div className="shop-product-detail">
        <ProductImage product={product} large />
        <div className="shop-product-copy">
          <p className="eyebrow">Tibb butik</p>
          <h1 className="page-title">{product.name}</h1>
          <p className="shop-price shop-detail-price">
            {formatMoney(product.priceOre)}{" "}
            <small>inklusive {product.vatPercent}% moms</small>
          </p>
          <p className="shop-stock">
            <Package size={18} aria-hidden="true" />
            {product.stock > 0 ? `${product.stock} i lager` : "Slut i lager"}
          </p>
          <TextContent text={product.description} />
          {product.kind === "bundle" && <section className="shop-bundle-contents"><h2>Ingår i paketet</h2><ul>{product.bundleItems?.map(part=><li key={part.productId}>{part.quantity} × {catalog.find(item=>item.id===part.productId)?.name}</li>)}</ul>{(product.bundleOriginalPriceOre??0)>product.priceOre&&<p>Delarna var för sig: {formatMoney(product.bundleOriginalPriceOre!)}. Du sparar {formatMoney(product.bundleOriginalPriceOre!-product.priceOre)} med paketet.</p>}</section>}
          {matchingOffers.length>0&&<section className="shop-offer-note"><h2>Mängdrabatt</h2><ul>{matchingOffers.map(offer=><li key={offer.id}>{offer.name}: {offer.percent} % vid minst {offer.minQuantity} {offer.scope==="per_product"?"av denna produkt":"produkter inom erbjudandet"}.</li>)}</ul><p className="small muted">Den bästa mängdrabatten beräknas automatiskt i varukorgen.</p></section>}
          <AddToCart
            product={{
              id: product.id,
              name: product.name,
              stock: product.stock,
            }}
          />
          <div className="shop-service-notes">
            {settings.shippingEnabled && (
              <p>
                <Truck size={18} aria-hidden="true" />
                {settings.shippingRuleMode?"Frakt beräknas från vikt och postnummer i kassan":`Frakt ${formatMoney(settings.shippingPriceOre)}`}
                {settings.freeShippingThresholdOre !== null &&
                  ` · fri frakt från ${formatMoney(settings.freeShippingThresholdOre)}`}
              </p>
            )}
            {settings.pickupEnabled && (
              <p>
                <MapPin size={18} aria-hidden="true" />
                Kan hämtas utan fraktkostnad
              </p>
            )}
          </div>
          <p className="muted">
            Priser anges i svenska kronor. Leveransval och totalbelopp visas i
            kassan.
          </p>
        </div>
      </div>
      {product.richDescription && (
        <section className="shop-product-long-description" aria-label="Fördjupad produktbeskrivning">
          <ProductRichText document={product.richDescription} />
        </section>
      )}
    </div>
  );
}
