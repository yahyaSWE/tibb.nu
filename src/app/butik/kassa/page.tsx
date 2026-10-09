import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PRIVATE_METADATA } from "@/lib/seo";
import { CheckoutForm } from "@/components/shop/checkout-form";
import {
  shopProductsForRender,
  shopSettingsForRender,
} from "@/components/shop/server-data";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Kassa" };
export default async function CheckoutPage() {
  const settings = await shopSettingsForRender();
  if (!settings.enabled) notFound();
  const products = await shopProductsForRender();
  return (
    <section className="shop section container">
      <Link href="/butik/varukorg" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Till varukorgen
      </Link>
      <div className="page-heading">
        <p className="eyebrow">Nästa steg</p>
        <h1 className="page-title">Kassa.</h1>
        <p className="muted">
          Välj leverans och se ditt totalbelopp innan du betalar.
        </p>
      </div>
      <CheckoutForm products={products.map(({ richDescription: _content, ...product }) => product)} settings={settings} />
    </section>
  );
}
