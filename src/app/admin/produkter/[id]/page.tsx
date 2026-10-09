import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAdminShopProduct, getAdminShopProducts, getShopSettings } from "@/lib/shop";
import {
  AdminHeading,
  AdminNotice,
  type AdminSearchParams,
  SectionHeading,
} from "@/components/admin/common";
import { ShopProductForm } from "@/components/admin/shop-forms";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AdminSearchParams;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) notFound();
  const [product, settings, products] = await Promise.all([
    getAdminShopProduct(user.id, productId),
    getShopSettings(),
    getAdminShopProducts(user.id),
  ]);
  if (!product) notFound();
  const catalog = products.map(({id,name,priceOre,vatPercent,stock,weightGrams,kind,published}) => ({id,name,priceOre,vatPercent,stock,weightGrams,kind,published}));
  return (
    <>
      <AdminHeading
        eyebrow="Din butik"
        title={product.name}
        description={`${product.published ? "Publicerad" : "Utkast"} · ${product.stock} tillgängliga exemplar`}
        action={
          <div className="shop-page-actions">
            <Link href="/admin/produkter" className="text-link">
              Alla produkter
            </Link>
            <Link href={`/admin/produkter/${product.id}/forhandsvisa`} className="button button-secondary">
              Förhandsgranska produkt
            </Link>
            {settings.enabled && product.published ? (
              <Link
                href={`/butik/${product.slug}`}
                className="button button-secondary"
              >
                Visa produkt ↗
              </Link>
            ) : null}
          </div>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel form-panel">
        <SectionHeading
          title="Redigera produkt"
          description="Avmarkera publicering för att dölja produkten. Tidigare beställningar och deras produktuppgifter bevaras."
        />
        <ShopProductForm product={product} catalog={catalog} shippingRuleMode={settings.shippingRuleMode ?? false} />
      </section>
    </>
  );
}
