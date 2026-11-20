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
    <section className="shop shop-purchase section container">
      <Link href="/butik" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Till butiken
      </Link>
      <header className="shop-purchase-heading">
        <h1 className="page-title">Varukorg</h1>
      </header>
      <CartPageContent products={products.map(({ richDescription: _content, ...product }) => product)} />
    </section>
  );
}
