"use client";

import { useEffect, useId, useRef } from "react";
import { Plus, X } from "lucide-react";
import type { ShopProduct } from "@/lib/shop-types";
import type { ShopProductFields } from "@/lib/shop-admin-state";
import { Field, kronor } from "./common";

export type ShopBundleCatalogItem = Pick<ShopProduct, "id" | "name" | "priceOre" | "vatPercent" | "stock" | "weightGrams" | "kind" | "published">;
export function ShopBundleEditor({ items, catalog, onChange }: { items: ShopProductFields["bundleItems"]; catalog: ShopBundleCatalogItem[]; onChange: (items: ShopProductFields["bundleItems"]) => void }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const previousCount = useRef(items.length);
  useEffect(() => {
    if (items.length > previousCount.current) container.current?.querySelector<HTMLSelectElement>(`[data-bundle-row="${items.length - 1}"] select`)?.focus();
    previousCount.current = items.length;
  }, [items.length]);
  const selected = items.map(item => ({ product: catalog.find(product => String(product.id) === item.productId), quantity: Number(item.quantity) }));
  const valid = selected.length > 0 && selected.every(item => item.product && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99) && new Set(items.map(item => item.productId)).size === items.length;
  const stock = valid ? Math.min(...selected.map(item => Math.floor(item.product!.stock / item.quantity))) : null;
  const price = valid ? selected.reduce((total, item) => total + item.product!.priceOre * item.quantity, 0) : null;
  const weight = valid && selected.every(item => (item.product!.weightGrams ?? 0) > 0) ? selected.reduce((total, item) => total + item.product!.weightGrams! * item.quantity, 0) : null;
  return <div className="shop-bundle-editor stack" ref={container}>
    <div><h3>Ingår i paketet</h3><p className="small muted">Välj vanliga produkter och antal per paket. Delarna behöver vara publicerade och ha samma momssats som paketet när det publiceras.</p></div>
    {items.map((item,index) => <div className="shop-bundle-row" key={index} data-bundle-row={index}>
      <Field label={`Produkt ${index + 1}`} name={`${id}-product-${index}`}><select id={`${id}-product-${index}`} name="bundleProductId" value={item.productId} required onChange={event => onChange(items.map((row,rowIndex) => rowIndex === index ? {...row,productId:event.target.value} : row))}><option value="">Välj produkt</option>{catalog.map(product => <option key={product.id} value={product.id} disabled={items.some((row,rowIndex) => rowIndex !== index && row.productId === String(product.id))}>{product.name}{!product.published ? " (utkast)" : ""} · {product.vatPercent} % moms</option>)}</select></Field>
      <Field label="Antal per paket" name={`${id}-quantity-${index}`}><input id={`${id}-quantity-${index}`} name="bundleQuantity" type="number" min={1} max={99} step={1} required value={item.quantity} onChange={event => onChange(items.map((row,rowIndex) => rowIndex === index ? {...row,quantity:event.target.value} : row))}/></Field>
      <button type="button" className="button button-secondary button-small" aria-label={`Ta bort produkt ${index + 1} från paketet`} onClick={() => onChange(items.filter((_,rowIndex) => rowIndex !== index))}><X size={16} aria-hidden="true"/>Ta bort</button>
    </div>)}
    <div><button type="button" className="button button-secondary button-small" disabled={items.length >= 20 || items.length >= catalog.length} onClick={() => onChange([...items,{productId:"",quantity:"1"}])}><Plus size={16} aria-hidden="true"/>Lägg till produkt</button></div>
    {!catalog.length && <p className="notice">Skapa en vanlig produkt först för att kunna bygga ett paket.</p>}
    {valid ? <dl className="shop-bundle-summary"><div><dt>Beräknat lager</dt><dd>{stock} paket</dd></div><div><dt>Delarnas sammanlagda pris</dt><dd>{kronor(price!)}</dd></div><div><dt>Produktvikt per paket</dt><dd>{weight === null ? "Okänd – ange vikt på alla delar" : `${weight.toLocaleString("sv-SE")} g`}</dd></div></dl> : <p className="small muted">Välj delar och giltiga antal för att se beräknat lager, pris och vikt.</p>}
    <p className="small muted">Paketet använder delarnas lager. Lagersaldot kan ändras när en del säljs separat eller i ett annat paket.</p>
  </div>;
}
