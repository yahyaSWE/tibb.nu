"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ArrowRight } from "lucide-react";
import { useShopCart } from "./shop/cart-store";
import { formatMoney } from "@/lib/time";
import type { ShopProduct } from "@/lib/shop-types";

export function WellnessBuilder({ products, available }: { products: ShopProduct[]; available: boolean }) {
  const cart = useShopCart(); const router = useRouter();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const selected = products.map(product => ({ product, quantity: quantities[product.id] ?? 0 })).filter(item => item.quantity > 0);
  const total = selected.reduce((sum, item) => sum + item.product.priceOre * item.quantity, 0);
  const tax = selected.reduce((sum, item) => sum + Math.round(item.product.priceOre * item.quantity * item.product.vatPercent / (100 + item.product.vatPercent)), 0);
  function change(id: number, quantity: number) { if (Number.isInteger(quantity) && quantity >= 0 && quantity <= 99) { setQuantities(current => ({ ...current, [id]: quantity })); setError(null); } }
  function add() {
    const message = cart.addMany(selected.map(item => ({ productId: item.product.id, quantity: item.quantity, stock: 99 })));
    if (message) setError(message); else router.push("/butik/varukorg");
  }
  return <div className="wellness-builder" id="valj-tillfallen">
    <div>
      <h2>Välj dina tillfällen</h2>
      <p className="muted">Kombinera tjänsterna så att paketet passar dig. Varje klipp gäller ett tillfälle av den tjänst du väljer.</p>
      {!products.length && <p className="notice">Friskvårdstjänsterna förbereds. Kontakta oss för priser och bokning tills köpen öppnar här.</p>}
      {products.map(product => <section className="wellness-service" key={product.id} aria-labelledby={`service-${product.id}`}>
        <div><h3 id={`service-${product.id}`}>{product.name}</h3><p>{product.description}</p>
          <p className="wellness-unit-price"><strong>{formatMoney(product.priceOre)}</strong> per tillfälle <span>inklusive {product.vatPercent} % moms</span></p>
          <p className="small muted">Personligt klippkort · Giltigt i {product.validityMonths ?? 12} månader från betalningsdatum</p>
        </div>
        <div className="wellness-quantity">
          <label htmlFor={`quantity-${product.id}`}>Antal tillfällen</label>
          <div><button type="button" aria-label={`Minska antal ${product.name}`} disabled={!quantities[product.id]} onClick={() => change(product.id, (quantities[product.id] ?? 0) - 1)}><Minus size={16}/></button>
            <input id={`quantity-${product.id}`} type="number" inputMode="numeric" min={0} max={99} value={quantities[product.id] ?? 0} onChange={event => change(product.id, Number(event.target.value))}/>
            <button type="button" aria-label={`Öka antal ${product.name}`} disabled={(quantities[product.id] ?? 0) >= 99} onClick={() => change(product.id, (quantities[product.id] ?? 0) + 1)}><Plus size={16}/></button></div>
          <span>{formatMoney(product.priceOre * (quantities[product.id] ?? 0))}</span>
        </div>
      </section>)}
    </div>
    <aside className="wellness-summary" aria-label="Ditt friskvårdspaket">
      <h2>Ditt paket</h2>
      {!selected.length ? <p>Välj hur många tillfällen du vill köpa. Du ser ditt paket här innan du går vidare.</p> : <ul>{selected.map(item => <li key={item.product.id}><span>{item.quantity} × {item.product.name}</span><strong>{formatMoney(item.product.priceOre * item.quantity)}</strong></li>)}</ul>}
      <div className="wellness-total" aria-live="polite"><span>Totalt inklusive moms</span><strong>{formatMoney(total)}</strong><small>Varav moms {formatMoney(tax)}</small></div>
      {total > 500000 && <p className="notice" role="status">Paketet överstiger 5 000 kr. Gränsen för skattefritt friskvårdsbidrag är normalt 5 000 kr per år. Du kan fortsätta köpa, men kontrollera med din arbetsgivare vad som ersätts.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {available ? <button className="button button-primary" type="button" disabled={!total || !cart.ready} onClick={add}>Lägg paketet i varukorgen <ArrowRight size={17}/></button> : <p className="notice">Köp online öppnar när kassan är klar. Du kan läsa om tjänsterna och kontakta oss under tiden.</p>}
      <p className="small">Du granskar uppgifterna och betalar i Kustom Checkout. Personnummer samlas inte in för kvittot. Arbetsgivaren avgör om ersättning beviljas.</p>
    </aside>
  </div>;
}
