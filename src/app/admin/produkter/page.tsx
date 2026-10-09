import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminShopProducts, getShopSettings } from "@/lib/shop";
import {
  AdminHeading,
  EmptyState,
  SectionHeading,
} from "@/components/admin/common";
import { ShopProductsTable } from "@/components/admin/shop-tables";

export default async function ProductsPage() {
  const user = await requireAdmin();
  const [products, settings] = await Promise.all([
    getAdminShopProducts(user.id),
    getShopSettings(),
  ]);
  const published = products.filter((product) => product.published).length;
  return (
    <>
      <AdminHeading
        eyebrow="Din butik"
        title="Produkter"
        description={`${products.length} produkter · ${published} publicerade · ${products.length - published} utkast`}
        action={
          <Link href="/admin/produkter/ny" className="button button-primary">
            <Plus size={18} aria-hidden="true" />
            Ny produkt
          </Link>
        }
      />
      {!settings.enabled && (
        <div className="notice">
          Butiken är stängd. Dina produkter kan fortfarande redigeras och{" "}
          <Link href="/admin/butik/forhandsvisa" className="text-link">
            förhandsgranskas
          </Link>
          .
        </div>
      )}
      <section className="panel">
        <SectionHeading
          title="Dina produkter"
          description="Priserna inkluderar den moms du anger. Lagersaldot visar tillgängliga exemplar efter reservationer."
        />
        {products.length ? (
          <ShopProductsTable
            products={products.map(
              ({
                id,
                name,
                slug,
                priceOre,
                vatPercent,
                stock,
                published,
                imageId,
              }) => ({
                id,
                name,
                slug,
                priceOre,
                vatPercent,
                stock,
                published,
                imageId,
              }),
            )}
          />
        ) : (
          <EmptyState
            title="Lägg till din första produkt"
            href="/admin/produkter/ny"
            label="Skapa en produkt"
          >
            Spara den som utkast och lägg in en bild, beskrivning, pris och
            lagersaldo innan publicering.
          </EmptyState>
        )}
      </section>
    </>
  );
}
