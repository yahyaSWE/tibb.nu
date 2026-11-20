import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PRIVATE_METADATA } from "@/lib/seo";
import { CartPageContent } from "@/components/shop/shop-cart";
import { purchaseDataForRender } from "@/components/shop/server-data";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Varukorg" };
export default async function CartPage() {
  const { products, wellnessOnly } = await purchaseDataForRender();
  return (
    <section className="shop shop-purchase section container">
      <Link href={wellnessOnly ? "/friskvard" : "/butik"} className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> {wellnessOnly ? "Till friskvård" : "Till butiken"}
      </Link>
      <header className="shop-purchase-heading">
        <h1 className="page-title">Varukorg</h1>
      </header>
      <CartPageContent products={products.map(({ richDescription: _content, ...product }) => product)} wellnessOnly={wellnessOnly} />
    </section>
  );
}
