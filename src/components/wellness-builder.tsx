"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, ArrowRight } from "lucide-react";
import { useShopCart } from "./shop/cart-store";
import { formatMoney } from "@/lib/time";
import type { ShopProduct } from "@/lib/shop-types";

export function WellnessBuilder({ products, available }: { products: ShopProduct[]; available: boolean }) {
  const cart = useShopCart(); const router = useRouter();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const selected = products.map(product => ({ product, quantity: quantities[product.id] ?? 0 })).filter(item => item.quantity > 0);
  const count = selected.reduce((sum, item) => sum + item.quantity, 0);
  const total = selected.reduce((sum, item) => sum + item.product.priceOre * item.quantity, 0);
  const tax = selected.reduce((sum, item) => sum + Math.round(item.product.priceOre * item.quantity * item.product.vatPercent / (100 + item.product.vatPercent)), 0);
  function change(id: number, quantity: number) { if (Number.isInteger(quantity) && quantity >= 0 && quantity <= 99) { setQuantities(current => ({ ...current, [id]: quantity })); setError(null); } }
  function add() {
    if (!available || !cart.ready || !selected.length) return;
    const message = cart.addMany(selected.map(item => ({ productId: item.product.id, quantity: item.quantity, stock: item.product.stock })));
    if (message) setError(message); else router.push("/butik/varukorg");
  }
  return <section className="wellness-builder" id="valj-tillfallen" aria-labelledby="wellness-services-title">
    <div className="wellness-services">
      <h2 id="wellness-services-title">Tjänster och priser</h2>
      <p>Välj hur många tillfällen du vill ha av varje tjänst.</p>
      {!products.length && <div className="wellness-empty">
        <p>Just nu finns inga publicerade tjänster. Hör gärna av dig om du har frågor om friskvård.</p>
        <Link href="/kontakt" className="text-link">Kontakta oss <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>}
      {products.map(product => {
        const quantity = quantities[product.id] ?? 0;
        const heading = `service-${product.id}`;
        const label = `quantity-label-${product.id}`;
        const input = `quantity-${product.id}`;
        return <section className="wellness-service" key={product.id} aria-labelledby={heading}>
          <div className="wellness-service-copy">
            <h3 id={heading}>{product.name}</h3>
            <p>{product.description}</p>
            <p className="wellness-validity">Gäller i {product.validityMonths ?? 12} månader från betalning</p>
          </div>
          <div className="wellness-service-choice">
            <p className="wellness-unit-price"><strong>{formatMoney(product.priceOre)}</strong> <span>per tillfälle</span></p>
            <p className="wellness-vat">Inkl. {product.vatPercent} % moms</p>
            <div className="wellness-quantity">
              <label id={label} htmlFor={input}>Antal tillfällen</label>
              <div>
                <button type="button" aria-label={`Minska antal ${product.name}`} disabled={!quantity} onClick={() => change(product.id, quantity - 1)}><Minus size={17} aria-hidden="true" /></button>
                <input id={input} aria-labelledby={`${label} ${heading}`} type="number" inputMode="numeric" min={0} max={99} value={quantity} onChange={event => change(product.id, Number(event.target.value))} />
                <button type="button" aria-label={`Öka antal ${product.name}`} disabled={quantity >= 99} onClick={() => change(product.id, quantity + 1)}><Plus size={17} aria-hidden="true" /></button>
              </div>
            </div>
          </div>
        </section>;
      })}
    </div>
    {!!products.length && <aside className="wellness-summary" aria-labelledby="wellness-summary-title">
      <h2 id="wellness-summary-title">Ditt friskvårdspaket</h2>
      {!count ? <p className="wellness-summary-empty">När du väljer ett tillfälle visas det här.</p> : <ul>{selected.map(item => <li key={item.product.id}><span>{item.quantity} × {item.product.name}</span><strong>{formatMoney(item.product.priceOre * item.quantity)}</strong></li>)}</ul>}
      <div className="wellness-total" aria-live="polite" aria-atomic="true">
        <span>{count} {count === 1 ? "tillfälle" : "tillfällen"} · Totalt inkl. moms</span>
        <strong>{formatMoney(total)}</strong>
        <small>Varav moms {formatMoney(tax)}</small>
      </div>
      {total > 500000 && <p className="wellness-summary-note" role="status">Paketet överstiger 5 000 kr. Kontrollera med din arbetsgivare hur mycket som ersätts.</p>}
      {error && <p className="wellness-summary-note" role="alert">{error}</p>}
      {available ? <>
        <button className="button wellness-summary-action" type="button" disabled={!count || !cart.ready} onClick={add}>Lägg i varukorgen <ArrowRight size={17} aria-hidden="true" /></button>
        <p className="wellness-summary-note">Du betalar via Kustom Checkout. Personnummer samlas inte in för kvittot.</p>
      </> : <Link href="/kontakt" className="button wellness-summary-action">Kontakta oss om friskvård <ArrowRight size={17} aria-hidden="true" /></Link>}
    </aside>}
  </section>;
}
