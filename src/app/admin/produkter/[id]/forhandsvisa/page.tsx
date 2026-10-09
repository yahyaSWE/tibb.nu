import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAdminShopProduct, getAdminShopProducts, getShopSettings } from "@/lib/shop";
import { PRIVATE_METADATA } from "@/lib/seo";
import { formatMoney } from "@/lib/time";
import { AdminHeading } from "@/components/admin/common";
import { TextContent } from "@/components/learning/cards";
import { ProductImage } from "@/components/shop/product-card";
import { ProductRichText } from "@/components/shop/product-rich-text";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Förhandsvisa produkt" };

export default async function ProductPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const productId = Number((await params).id);
  if (!Number.isSafeInteger(productId) || productId < 1) notFound();
  const [product, products, settings] = await Promise.all([
    getAdminShopProduct(user.id, productId),
    getAdminShopProducts(user.id),
    getShopSettings(),
  ]);
  if (!product) notFound();
  return (
    <div className="shop shop-admin-preview">
      <AdminHeading
        title="Förhandsvisa produkten"
        description="Granska den sparade produktbeskrivningen och bilderna."
        action={<Link href={`/admin/produkter/${product.id}`} className="button button-secondary">Tillbaka till redigering</Link>}
      />
      <p className="notice" role="status">
        Administratörsvy · Produkten är {product.published ? "publicerad" : "ett utkast"} och butiken är {settings.enabled ? "öppen" : "avstängd"}. Förhandsvisningen kan inte användas för köp.
      </p>
      <div className="shop-product-detail">
        <ProductImage product={product} large />
        <div className="shop-product-copy">
          <h2 className="page-title">{product.name}</h2>
          <p className="shop-price shop-detail-price">{formatMoney(product.priceOre)} <small>inklusive {product.vatPercent}% moms</small></p>
          <p className="shop-stock">{product.stock > 0 ? `${product.stock} i lager` : "Slut i lager"}</p>
          <TextContent text={product.description} />
          {product.kind === "bundle" && (
            <section className="shop-bundle-contents">
              <h3>Ingår i paketet</h3>
              <ul>{product.bundleItems?.map(part => <li key={part.productId}>{part.quantity} × {products.find(item => item.id === part.productId)?.name}</li>)}</ul>
              {(product.bundleOriginalPriceOre ?? 0) > product.priceOre && <p>Delarna var för sig: {formatMoney(product.bundleOriginalPriceOre!)}. Du sparar {formatMoney(product.bundleOriginalPriceOre! - product.priceOre)} med paketet.</p>}
            </section>
          )}
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
