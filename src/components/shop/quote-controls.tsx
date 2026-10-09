"use client";

import { useId } from "react";
import { MapPin, Truck } from "lucide-react";
import type { ShopQuote, ShopSettings } from "@/lib/shop-types";
import { formatMoney } from "@/lib/time";
import { normalizedCoupon } from "./quote-data";

export function CouponEntry({ draft, code, onDraft, onApply, onRemove, pending, disabled = false, confirmedCode }: {
  draft: string; code: string; onDraft: (value: string) => void; onApply: () => void; onRemove: () => void;
  pending: boolean; disabled?: boolean; confirmedCode?: string | null;
}) {
  const id = useId();
  const edited = normalizedCoupon(draft) !== code;
  return <div className="shop-coupon">
    <label className="field" htmlFor={id}>Rabattkod (valfritt)
      <input id={id} value={draft} onChange={(event) => onDraft(event.target.value)} maxLength={50} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={disabled} />
    </label>
    <div className="shop-coupon-actions">
      <button type="button" className="button button-secondary" onClick={onApply} disabled={disabled || pending || !normalizedCoupon(draft)}>{pending && code ? "Kontrollerar…" : "Använd kod"}</button>
      {(code || draft) && <button type="button" className="shop-remove" disabled={disabled} onClick={onRemove}>Ta bort kod</button>}
    </div>
    {edited && <p className="muted">Använd eller ta bort den ändrade rabattkoden innan du fortsätter.</p>}
    {!pending && confirmedCode && !edited && <p role="status" className="shop-add-feedback">Rabattkod {confirmedCode} används i prisberäkningen.</p>}
  </div>;
}

export function PostcodeField({ value, onChange, required = false, disabled = false }: { value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  const id = useId();
  return <label className="field" htmlFor={id}>Postnummer
    <input id={id} name="postcode" value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} maxLength={6} pattern="[0-9]{3} ?[0-9]{2}" inputMode="numeric" autoComplete="shipping postal-code" />
  </label>;
}

export function DeliveryChoices({ settings, delivery, onChange }: { settings: ShopSettings; delivery: "shipping" | "pickup"; onChange: (value: "shipping" | "pickup") => void }) {
  const name = useId();
  return <div className="shop-delivery-options">
    {settings.shippingEnabled && <label className={`shop-delivery-option${delivery === "shipping" ? " selected" : ""}`}>
      <input type="radio" name={name} value="shipping" checked={delivery === "shipping"} onChange={() => onChange("shipping")} />
      <Truck size={20} aria-hidden="true" /><span><strong>Leverans inom Sverige</strong><small>{settings.shippingRuleMode ? "Frakt beräknas från postnummer och vikt" : "Frakten bekräftas i prisberäkningen"}</small></span>
    </label>}
    {settings.pickupEnabled && <label className={`shop-delivery-option${delivery === "pickup" ? " selected" : ""}`}>
      <input type="radio" name={name} value="pickup" checked={delivery === "pickup"} onChange={() => onChange("pickup")} />
      <MapPin size={20} aria-hidden="true" /><span><strong>Hämta själv</strong><small>Ingen fraktkostnad</small></span>
    </label>}
  </div>;
}

export function QuoteFeedback({ pending, error, needsPostcode, onRetry }: { pending: boolean; error: string | null; needsPostcode: boolean; onRetry: () => void }) {
  if (needsPostcode) return <p className="notice" role="status">Ange ett svenskt postnummer med fem siffror för att beräkna frakt och totalbelopp.</p>;
  if (pending) return <p className="notice" role="status">Beräknar aktuellt pris, rabatter och frakt…</p>;
  if (error) return <div className="notice notice-error" role="alert"><p>{error}</p><p>Kontrollera varukorgen, rabattkoden och leveransvalet. Du kan välja hämtning om det erbjuds, eller kontakta verksamheten om leveransen inte kan beräknas.</p><button type="button" className="button button-secondary" onClick={onRetry}>Beräkna igen</button></div>;
  return null;
}

export function QuoteTotals({ quote }: { quote: Pick<ShopQuote, "originalSubtotalOre" | "subtotalOre" | "shippingOre" | "totalOre" | "discounts" | "shippingLabel"> }) {
  return <dl className="shop-order-totals">
    <div><dt>Varor före rabatter</dt><dd>{formatMoney(quote.originalSubtotalOre)}</dd></div>
    {quote.discounts.map((discount, index) => <div className="shop-discount" key={`${discount.kind}-${index}`}><dt>{discount.name}{discount.code ? ` (${discount.code})` : ""}</dt><dd>−{formatMoney(discount.amountOre)}</dd></div>)}
    <div><dt>Varor efter rabatter</dt><dd>{formatMoney(quote.subtotalOre)}</dd></div>
    <div><dt>{quote.shippingLabel}</dt><dd>{formatMoney(quote.shippingOre)}</dd></div>
    <div className="shop-total"><dt>Totalt, inklusive moms</dt><dd>{formatMoney(quote.totalOre)}</dd></div>
  </dl>;
}
