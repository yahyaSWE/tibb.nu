import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import type { ShopProduct } from "@/lib/shop-types";
import { formatMoney } from "@/lib/time";
import { TextContent } from "@/components/learning/cards";
import { AddToCart } from "./shop-cart";
import "./shop.css";

export function ProductImage({
  product,
  large = false,
}: {
  product: Pick<ShopProduct, "name" | "imageId">;
  large?: boolean;
}) {
  return (
    <div
      className={`shop-product-image${large ? " shop-product-image-large" : ""}`}
    >
      {product.imageId ? (
        <img
          src={`/api/shop/images/${product.imageId}`}
          alt={product.name}
          loading={large ? "eager" : "lazy"}
          width={large ? 720 : 420}
          height={large ? 720 : 420}
        />
      ) : (
        <Package size={large ? 86 : 56} strokeWidth={1} aria-hidden="true" />
      )}
    </div>
  );
}

export function ProductCard({
  product,
  preview = false,
}: {
  product: ShopProduct;
  preview?: boolean;
}) {
  const content = (
    <>
      <ProductImage product={product} />
      <div className="shop-product-card-title">
        <h3>{product.name}</h3>
        {!preview && <ArrowUpRight size={20} aria-hidden="true" />}
      </div>
    </>
  );
  return (
    <article className="shop-product-card">
      {preview ? (
        <div>{content}</div>
      ) : (
        <Link href={`/butik/${product.slug}`} className="shop-product-link">
          {content}
        </Link>
      )}
      <div className="shop-product-card-body">
        <p className="shop-price">
          {formatMoney(product.priceOre)} <small>inkl. moms</small>
        </p>
        {product.kind === "bundle" && <p className="shop-offer-note">Produktpaket{(product.bundleOriginalPriceOre??0)>product.priceOre ? ` · spara ${formatMoney(product.bundleOriginalPriceOre!-product.priceOre)} jämfört med delarna var för sig` : ""}</p>}
        <p className="muted">
          {product.stock > 0 ? `${product.stock} i lager` : "Slut i lager"}
        </p>
        {preview ? (
          <>
            <span
              className={`badge ${product.published ? "badge-green" : "badge-amber"}`}
            >
              {product.published ? "Publicerad" : "Utkast"}
            </span>
            <details className="shop-description-preview">
              <summary>Visa produktbeskrivning</summary>
              <TextContent text={product.description} />
            </details>
          </>
        ) : (
          <AddToCart
            product={{
              id: product.id,
              name: product.name,
              stock: product.stock,
            }}
            compact
          />
        )}
      </div>
    </article>
  );
}
