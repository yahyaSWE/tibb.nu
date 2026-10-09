import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminShopProducts, getShopSettings } from "@/lib/shop";
import { PRIVATE_METADATA } from "@/lib/seo";
import { ProductCard } from "@/components/shop/product-card";
import { AdminHeading } from "@/components/admin/common";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Förhandsvisa butik" };
export default async function ShopPreviewPage() {
  const user = await requireAdmin();
  const [products, settings] = await Promise.all([
    getAdminShopProducts(user.id),
    getShopSettings(),
  ]);
  return (
    <div className="shop shop-admin-preview">
      <AdminHeading
        title="Förhandsvisa butiken"
        description="Granska produkternas kort och beskrivningar innan du öppnar butiken."
      />
      <p className="notice" role="status">
        Administratörsvy · Butiken är {settings.enabled ? "öppen" : "avstängd"}.
        Utkast visas här. Förhandsvisningen kan inte användas för köp.
      </p>
      <div className="shop-page-top">
        <Link href="/admin/butik" className="button button-secondary">
          Till butiksadministrationen
        </Link>
      </div>
      <h2 className="shop-preview-heading">Produkter</h2>
      {products.length ? (
        <div className="shop-product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} preview />
          ))}
        </div>
      ) : (
        <div className="shop-empty">
          <h3>Inga produkter ännu.</h3>
          <p>
            Skapa en produkt i butiksadministrationen för att förhandsvisa den
            här.
          </p>
        </div>
      )}
    </div>
  );
}
