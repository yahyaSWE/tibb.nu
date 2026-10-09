import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminShopProducts, getShopSettings } from "@/lib/shop";
import { AdminHeading, SectionHeading } from "@/components/admin/common";
import { ShopProductForm } from "@/components/admin/shop-forms";

export default async function NewProductPage() {
  const user = await requireAdmin();
  const [products, settings] = await Promise.all([getAdminShopProducts(user.id), getShopSettings()]);
  const catalog = products.map(({id,name,priceOre,vatPercent,stock,weightGrams,kind,published}) => ({id,name,priceOre,vatPercent,stock,weightGrams,kind,published}));
  return (
    <>
      <AdminHeading
        eyebrow="Din butik"
        title="Ny produkt"
        description="Lägg in produktens uppgifter och spara som utkast eller välj att publicera den."
        action={
          <Link href="/admin/produkter" className="text-link">
            Alla produkter
          </Link>
        }
      />
      <section className="panel form-panel">
        <SectionHeading title="Produktens uppgifter" />
        <ShopProductForm catalog={catalog} shippingRuleMode={settings.shippingRuleMode ?? false} />
      </section>
    </>
  );
}
