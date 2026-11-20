"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, MapPin, Truck } from "lucide-react";
import type { ShopProduct, ShopSettings } from "@/lib/shop-types";
import { WELLNESS_ADDRESS_THRESHOLD_ORE } from "@/lib/shop-types";
import { formatMoney } from "@/lib/time";
import { TextContent } from "@/components/learning/cards";
import { cartSummary, checkoutDestination } from "./cart-data";
import { useShopCart } from "./cart-store";
import { useQuoteChoices, normalizedCoupon } from "./quote-choices";
import { useShopQuote } from "./use-shop-quote";
import { CouponEntry, DeliveryChoices, QuoteFeedback, QuoteBreakdown } from "./quote-controls";
import { KustomPaymentMethods } from "./kustom-payment-methods";
import "./shop.css";

export function CheckoutForm({
  products,
  settings,
  paymentProvider = "stripe",
  showKustomPaymentMethods = false,
  wellnessOnly = false,
}: {
  products: ShopProduct[];
  settings: ShopSettings;
  paymentProvider?: "stripe" | "kustom";
  showKustomPaymentMethods?: boolean;
  wellnessOnly?: boolean;
}) {
  const cart = useShopCart();
  const router = useRouter();
  const choices = useQuoteChoices();
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    postcode: choices.postcode,
    city: "",
  });
  const [chosenDelivery, setDelivery] = useState<"shipping" | "pickup">(
    choices.delivery ?? (settings.shippingEnabled ? "shipping" : "pickup"),
  );
  const [acceptedTerms, setAcceptedTerms] = useState<string | null>(null);
  const consent = acceptedTerms === settings.terms;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const checkoutAttempt = useRef<{ key: string; id: string } | null>(null);
  const summary = cartSummary(cart.lines, products);
  const servicesOnly = summary.rows.length > 0 && summary.rows.every(row => row.product?.isService);
  const hasWellness = summary.rows.some(row => row.product?.wellnessEligible);
  const delivery = servicesOnly ? "pickup" :
    settings.shippingEnabled && settings.pickupEnabled ? chosenDelivery :
    settings.shippingEnabled ? "shipping" : "pickup";
  const availableDelivery =
    servicesOnly || (delivery === "shipping" ? settings.shippingEnabled : settings.pickupEnabled);
  const quoteState = useShopQuote({items:cart.lines,delivery,postcode:values.postcode,couponCode:choices.couponCode},products,settings,cart.ready && summary.valid && availableDelivery && settings.enabled);
  const quote = quoteState.quote;
  const couponDiscount = quote?.discounts.find(discount => discount.kind === "coupon");
  const shippingAddressRequired = delivery === "shipping" && settings.shippingEnabled;
  const receiptAddressRequired = hasWellness && !!quote && quote.totalOre > WELLNESS_ADDRESS_THRESHOLD_ORE;
  const addressRequired = shippingAddressRequired || receiptAddressRequired;
  const couponEdited = normalizedCoupon(choices.couponDraft) !== choices.couponCode;
  const canCheckout = summary.valid && availableDelivery && settings.enabled && !!quote && !quoteState.pending && !couponEdited;
  const changeDelivery = (next:"shipping"|"pickup") => {setDelivery(next);choices.update({delivery:next});};
  const field = (
    key: keyof typeof values,
    label: string,
    options: {
      type?: string;
      autoComplete?: string;
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
    } = {},
  ) => (
    <label className="field" htmlFor={`checkout-${key}`}>
      {label}
      <input
        id={`checkout-${key}`}
        name={key}
        value={values[key]}
        onChange={(event) => {
          setValues((current) => ({ ...current, [key]: event.target.value }));
          if(key === "postcode") choices.update({postcode:event.target.value});
        }}
        type={options.type || "text"}
        autoComplete={options.autoComplete}
        required={options.required}
        minLength={options.minLength}
        inputMode={key === "postcode" ? "numeric" : undefined}
        maxLength={options.maxLength || 150}
        pattern={options.pattern}
      />
    </label>
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !canCheckout || !consent) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const contact = !addressRequired && (!hasWellness || (!values.address.trim() && !values.city.trim()))
        ? { ...values, address: "", postcode: "", city: "" }
        : values;
      const payload = { items: cart.lines, ...contact, delivery, consent, couponCode: choices.couponCode, expectedQuote: quote!.fingerprint };
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
      const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (!checkoutAttempt.current) {
        try { checkoutAttempt.current = JSON.parse(window.sessionStorage.getItem("tibb-checkout-attempt-v1") || "null"); } catch { /* In-memory retries remain available. */ }
      }
      if (checkoutAttempt.current?.key !== key) checkoutAttempt.current = { key, id: crypto.randomUUID() };
      try { window.sessionStorage.setItem("tibb-checkout-attempt-v1", JSON.stringify(checkoutAttempt.current)); } catch { /* No contact data is persisted. */ }
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          checkoutAttemptId: checkoutAttempt.current.id,
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      const record =
        result && typeof result === "object"
          ? (result as Record<string, unknown>)
          : {};
      if (!response.ok) {
        setError(
          typeof record.error === "string"
            ? record.error
            : "Beställningen kunde inte startas. Kontrollera uppgifterna och försök igen.",
        );
        router.refresh();
        quoteState.refresh();
      } else {
        const url = checkoutDestination(record.url);
        if (!url) throw new Error("Invalid checkout destination");
        window.location.assign(url);
        return;
      }
    } catch {
      setError(
        "Anslutningen till betalningen kunde inte bekräftas. Din varukorg och inmatning finns kvar. Kontrollera anslutningen och försök igen.",
      );
    }
    submitting.current = false;
    setPending(false);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  if (!cart.ready)
    return (
      <p className="notice" role="status">
        Läser varukorgen…
      </p>
    );
  if (!cart.lines.length)
    return (
      <div className="shop-empty">
        <h2>Din varukorg är tom.</h2>
        <p>Lägg till en vara innan du går till kassan.</p>
        <Link href={wellnessOnly ? "/friskvard" : "/butik"} className="button button-primary">
          {wellnessOnly ? "Till friskvård" : "Till butiken"}
        </Link>
      </div>
    );
  const addressFields = (
    <div className="form-grid shop-address-fields">
      {field("address", "Gatuadress", {
        required: addressRequired,
        autoComplete: shippingAddressRequired ? "shipping street-address" : "street-address",
        minLength: 3,
        maxLength: 200,
      })}
      {field("postcode", "Postnummer", {
        required: addressRequired,
        autoComplete: "postal-code",
        maxLength: 6,
        pattern: "[0-9]{3} ?[0-9]{2}",
      })}
      {field("city", "Ort", {
        required: addressRequired,
        autoComplete: "address-level2",
        minLength: 2,
        maxLength: 100,
      })}
    </div>
  );

  return (
    <form className="shop-checkout-layout" onSubmit={submit} aria-busy={pending}
      onInvalidCapture={event => {
        if (event.target instanceof HTMLInputElement) {
          event.target.closest("details")?.setAttribute("open", "");
        }
      }}>
      <aside className="shop-summary shop-checkout-summary" aria-label="Din beställning">
        <div className="shop-checkout-total">
          <div>
            <h2>Totalt</h2>
            <small>Inklusive moms</small>
          </div>
          <strong aria-live="polite">{quote ? formatMoney(quote.totalOre) : "Beräknas i kassan"}</strong>
        </div>
        {couponDiscount && (
          <p className="shop-checkout-savings" role="status">
            Rabattkod {couponDiscount.code} · −{formatMoney(couponDiscount.amountOre)}
          </p>
        )}
        <details className="shop-checkout-items">
          <summary>Visa beställningen <ChevronDown size={16} aria-hidden="true" /></summary>
          <ul className="shop-checkout-lines">
            {summary.rows.map(row => {
              const line = quote?.items.find(item => item.productId === row.productId);
              return (
                <li key={row.productId}>
                  <span>{row.quantity} × {row.product?.name || "Otillgänglig produkt"}</span>
                  <strong>{row.product ? formatMoney(line?.originalLineTotalOre ?? row.totalOre) : "—"}</strong>
                </li>
              );
            })}
          </ul>
          {quote && <QuoteBreakdown quote={quote} />}
          <Link href="/butik/varukorg" className="inline-link">Ändra varukorgen</Link>
        </details>
      </aside>
      <div className="shop-checkout-form">
        {error && (
          <div ref={errorRef} tabIndex={-1} className="notice notice-error" role="alert">{error}</div>
        )}
        {!summary.valid && (
          <div className="notice notice-error" role="alert">
            Kontrollera antal och lagerstatus innan du fortsätter.{" "}
            <Link href="/butik/varukorg" className="inline-link">Ändra varukorgen</Link>
          </div>
        )}
        {!availableDelivery && (
          <p className="notice notice-error" role="alert">Beställning kan göras när ett leveranssätt finns tillgängligt.</p>
        )}
        <fieldset disabled={pending}>
          <legend>Kontaktuppgifter</legend>
          {servicesOnly && <p className="shop-contact-hint">Klippkort och kvitto skickas till din e-post efter betalning.</p>}
          <div className="form-grid">
            {field("name", "För- och efternamn", {
              required: true,
              autoComplete: "name",
              minLength: 2,
              maxLength: 100,
            })}
            {field("email", "E-postadress", {
              type: "email",
              required: true,
              autoComplete: "email",
              maxLength: 254,
            })}
          </div>
          <details className="shop-checkout-extra">
            <summary>Lägg till telefonnummer (valfritt)</summary>
            {field("phone", "Telefonnummer", { type: "tel", autoComplete: "tel", maxLength: 30 })}
          </details>
        </fieldset>
        {!servicesOnly && availableDelivery && (
          <fieldset disabled={pending}>
            <legend>Leverans</legend>
            {settings.shippingEnabled && settings.pickupEnabled ? (
              <DeliveryChoices settings={settings} delivery={delivery} onChange={changeDelivery} />
            ) : delivery === "shipping" ? (
              <p className="shop-delivery-note"><Truck size={19} aria-hidden="true" /> Leverans inom Sverige</p>
            ) : (
              <p className="shop-delivery-note"><MapPin size={19} aria-hidden="true" /> Hämta själv · fri frakt</p>
            )}
            {shippingAddressRequired && addressFields}
            {delivery === "pickup" && (
              <div className="shop-pickup-details">
                <strong>Hämtningsplats</strong>
                <p>{settings.pickupAddress}</p>
                {settings.pickupInstructions && <TextContent text={settings.pickupInstructions} />}
              </div>
            )}
          </fieldset>
        )}
        {hasWellness && !shippingAddressRequired && (
          <fieldset disabled={pending} className="shop-receipt-address">
            <legend className="sr-only">Adress för friskvårdskvittot</legend>
            {receiptAddressRequired ? (
              <div>
                <h2>Adress för friskvårdskvittot</h2>
                <p>Kundadress behövs för det här köpet.</p>
                {addressFields}
              </div>
            ) : (
              <details className="shop-checkout-extra">
                <summary>Lägg till adress på kvittot (valfritt)</summary>
                {addressFields}
              </details>
            )}
          </fieldset>
        )}
        <details className="shop-checkout-extra shop-checkout-coupon">
          <summary>{quote?.couponCode ? "Rabattkod · " + quote.couponCode : "Har du en rabattkod?"}</summary>
          <CouponEntry
            draft={choices.couponDraft}
            code={choices.couponCode}
            onDraft={couponDraft => choices.update({ couponDraft })}
            onApply={() => {
              choices.update({ couponCode: normalizedCoupon(choices.couponDraft) });
              quoteState.refresh();
            }}
            onRemove={() => choices.update({ couponDraft: "", couponCode: "" })}
            pending={quoteState.pending}
            disabled={pending}
            confirmedCode={quote?.couponCode}
          />
        </details>
        <div className="shop-checkout-pay">
          <fieldset disabled={pending} className="shop-checkout-consent">
            <legend className="sr-only">Godkänn villkoren</legend>
            <label className="consent-check">
              <input type="checkbox" name="consent" checked={consent} required
                onChange={event => setAcceptedTerms(event.target.checked ? settings.terms : null)} />
              <span>
                Jag har läst och godkänner{" "}
                <Link href="/butik/villkor" target="_blank" rel="noopener noreferrer">köpvillkoren</Link>{" "}
                och har läst{" "}
                <Link href="/integritet" target="_blank" rel="noopener noreferrer">integritetsinformationen</Link>.
              </span>
            </label>
          </fieldset>
          <QuoteFeedback pending={quoteState.pending} error={quoteState.error} needsPostcode={quoteState.needsPostcode} onRetry={quoteState.refresh} />
          {couponEdited && <p className="muted">Använd eller ta bort den ändrade rabattkoden för att fortsätta.</p>}
          <button type="submit" className="button button-primary" disabled={pending || !canCheckout}>
            {pending ? "Öppnar betalningen…" : quote ? `Till betalning · ${formatMoney(quote.totalOre)}` : "Till betalning"}
            {!pending && <ArrowRight size={17} aria-hidden="true" />}
          </button>
          <p className="muted">Du slutför betalningen hos {paymentProvider === "kustom" ? "Kustom Checkout" : "Stripe"}.</p>
          {showKustomPaymentMethods && <KustomPaymentMethods />}
        </div>
        <noscript><p className="notice notice-error">Aktivera JavaScript i webbläsaren för att kunna beställa.</p></noscript>
      </div>
    </form>
  );
}
