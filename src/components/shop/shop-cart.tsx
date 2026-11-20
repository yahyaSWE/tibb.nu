"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, Check, ShoppingBag, Trash2 } from "lucide-react";
import type { ShopProduct } from "@/lib/shop-types";
import { formatMoney } from "@/lib/time";
import { cartSummary, MAX_CART_QUANTITY } from "./cart-data";
import { useShopCart } from "./cart-store";
import "./shop.css";

export function ShopCartLink() {
  const cart = useShopCart();
  const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Link href="/butik/varukorg" className="button button-secondary">
      <ShoppingBag size={17} aria-hidden="true" /> Varukorg
      {cart.ready && count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

export function AddToCart({
  product,
  compact = false,
}: {
  product: Pick<ShopProduct, "id" | "name" | "stock">;
  compact?: boolean;
}) {
  const cart = useShopCart();
  const id = useId();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<{
    error?: string;
    success?: string;
  }>({});
  return (
    <div className="shop-add-to-cart">
      {!compact && product.stock > 0 && (
        <label className="field" htmlFor={id}>
          Antal
          <select
            id={id}
            value={quantity}
            onChange={(event) => {
              setQuantity(Number(event.target.value));
              setFeedback({});
            }}
          >
            {Array.from(
              { length: Math.min(product.stock, MAX_CART_QUANTITY) },
              (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ),
            )}
          </select>
        </label>
      )}
      <button
        type="button"
        className="button button-primary"
        aria-label={`Lägg i varukorg: ${product.name}`}
        disabled={!cart.ready || product.stock < 1}
        onClick={() => {
          const error = cart.add(
            product.id,
            compact ? 1 : quantity,
            product.stock,
          );
          setFeedback(
            error
              ? { error }
              : { success: `${product.name} har lagts i varukorgen.` },
          );
        }}
      >
        <ShoppingBag size={17} aria-hidden="true" />
        {product.stock < 1 ? "Slut i lager" : "Lägg i varukorg"}
      </button>
      {feedback.error && (
        <p className="notice notice-error" role="alert">
          {feedback.error}
        </p>
      )}
      {feedback.success && (
        <p className="shop-add-feedback" role="status">
          <Check size={15} aria-hidden="true" />
          {feedback.success}{" "}
          <Link href="/butik/varukorg" className="inline-link">
            Visa varukorgen
          </Link>
        </p>
      )}
      {cart.persistenceError && (
        <p className="notice">
          Webbläsaren kan inte spara varukorgen mellan besök. Varorna finns kvar
          under detta sidbesök.
        </p>
      )}
    </div>
  );
}

export function CartPageContent({ products, wellnessOnly = false }: { products: ShopProduct[]; wellnessOnly?: boolean }) {
  const cart = useShopCart();
  const summary = cartSummary(cart.lines, products);
  const digital = summary.rows.every(row => row.product?.isService);
  if (!cart.ready)
    return (
      <p role="status" className="notice">
        Läser varukorgen…
      </p>
    );
  if (!cart.lines.length)
    return (
      <div className="shop-empty">
        <ShoppingBag size={38} strokeWidth={1.3} aria-hidden="true" />
        <h2>Din varukorg är tom.</h2>
        <p className="muted">
          Utforska sortimentet och lägg till det du vill beställa.
        </p>
        <Link href={wellnessOnly ? "/friskvard" : "/butik"} className="button button-primary">
          {wellnessOnly ? "Till friskvård" : "Till butiken"} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    );
  return (
    <>
      {cart.persistenceError && (
        <p className="notice">
          Varukorgen kan inte sparas i denna webbläsare. Den finns kvar under
          detta sidbesök.
        </p>
      )}
      <div className="shop-cart-layout">
        <div className="shop-cart-items">
          {summary.rows.map((row) => {
            const maximum = Math.max(
              0,
              Math.min(MAX_CART_QUANTITY, row.product?.stock ?? 0),
            );
            return (
              <article key={row.productId} className="shop-cart-item">
                <div>
                  <h2>
                    {row.product ? (
                      <Link href={wellnessOnly ? `/friskvard#service-${row.product.id}` : `/butik/${row.product.slug}`}>
                        {row.product.name}
                      </Link>
                    ) : (
                      "Produkt som inte längre är tillgänglig"
                    )}
                  </h2>
                  {row.product && (
                    <p className="muted">
                      {formatMoney(row.product.priceOre)} per styck, inkl. moms
                    </p>
                  )}
                  {row.error && (
                    <p
                      id={`cart-error-${row.productId}`}
                      className="notice notice-error"
                      role="alert"
                    >
                      {row.error}
                    </p>
                  )}
                </div>
                <label
                  className="field"
                  htmlFor={`cart-quantity-${row.productId}`}
                >
                  Antal
                  <select
                    id={`cart-quantity-${row.productId}`}
                    aria-label={`Antal av ${row.product?.name || "otillgänglig produkt"}`}
                    aria-describedby={
                      row.error ? `cart-error-${row.productId}` : undefined
                    }
                    aria-invalid={Boolean(row.error)}
                    disabled={maximum === 0}
                    value={row.quantity}
                    onChange={(event) =>
                      cart.setQuantity(
                        row.productId,
                        Number(event.target.value),
                      )
                    }
                  >
                    {Array.from({ length: maximum }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {index + 1}
                      </option>
                    ))}
                    {row.quantity > maximum && (
                      <option value={row.quantity}>
                        {row.quantity} (nuvarande antal)
                      </option>
                    )}
                  </select>
                </label>
                <strong className="shop-price">
                  {row.product ? formatMoney(row.totalOre) : "—"}
                </strong>
                <button
                  type="button"
                  className="shop-remove"
                  aria-label={`Ta bort ${row.product?.name || "otillgänglig produkt"}`}
                  onClick={() => cart.remove(row.productId)}
                >
                  <Trash2 size={17} aria-hidden="true" />
                  <span>Ta bort</span>
                </button>
              </article>
            );
          })}
        </div>
        <aside className="shop-summary shop-cart-summary">
          <dl className="shop-order-totals">
            <div className="shop-total">
              <dt>Delsumma</dt>
              <dd>{formatMoney(summary.subtotalOre)}</dd>
            </div>
          </dl>
          <p className="muted">
            {digital ? "Inklusive moms. Eventuella rabatter räknas av i kassan." :
              "Inklusive moms. Frakt och eventuella rabatter beräknas i kassan."}
          </p>
          {summary.valid ? (
            <Link href="/butik/kassa" className="button button-primary">
              Till kassan <ArrowRight size={17} aria-hidden="true" />
            </Link>
          ) : (
            <p className="notice notice-error">
              Ändra antalet eller ta bort otillgängliga varor för att fortsätta.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

export function ClearPurchasedCart() {
  const cart = useShopCart();
  const [cleared, setCleared] = useState(false);
  return cleared ? (
    <p role="status" className="notice">
      Varukorgen är tömd.
    </p>
  ) : cart.ready && cart.lines.length > 0 ? (
    <button
      type="button"
      className="button button-secondary"
      onClick={() => {
        cart.clear();
        setCleared(true);
      }}
    >
      Töm min varukorg
    </button>
  ) : null;
}
