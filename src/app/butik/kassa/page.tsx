import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PRIVATE_METADATA } from "@/lib/seo";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { getKustomElementsConfig, shopPaymentProvider } from "@/lib/shop-payment-config";
import { purchaseDataForRender } from "@/components/shop/server-data";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Kassa" };
export default async function CheckoutPage() {
  const { settings, products, wellnessOnly } = await purchaseDataForRender();
  return (
    <section className="shop shop-purchase section container">
      <Link href="/butik/varukorg" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Till varukorgen
      </Link>
      <header className="shop-purchase-heading">
        <h1 className="page-title">Kassa</h1>
      </header>
      <CheckoutForm
        products={products.map(({ richDescription: _content, ...product }) => product)}
        settings={settings}
        paymentProvider={shopPaymentProvider()}
        showKustomPaymentMethods={!!getKustomElementsConfig()}
        wellnessOnly={wellnessOnly}
      />
    </section>
  );
}
