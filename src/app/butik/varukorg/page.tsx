import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PRIVATE_METADATA } from "@/lib/seo";
import { CartPageContent } from "@/components/shop/shop-cart";
import {
  shopProductsForRender,
  shopSettingsForRender,
} from "@/components/shop/server-data";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Varukorg" };
export default async function CartPage() {
  const settings=await shopSettingsForRender();
  if (!settings.enabled) notFound();
  const products = await shopProductsForRender();
  return (
    <section className="shop section container">
      <Link href="/butik" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Till butiken
      </Link>
      <div className="page-heading">
        <p className="eyebrow">Din beställning</p>
        <h1 className="page-title">Varukorg.</h1>
        <p className="muted">
          Kontrollera varor och antal innan du fortsätter.
        </p>
      </div>
      <CartPageContent products={products} settings={settings} />
    </section>
  );
}
