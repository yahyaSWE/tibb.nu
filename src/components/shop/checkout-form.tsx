"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard, MapPin, Truck } from "lucide-react";
import type { ShopProduct, ShopSettings } from "@/lib/shop-types";
import { formatMoney } from "@/lib/time";
import { TextContent } from "@/components/learning/cards";
import { cartSummary, checkoutDestination } from "./cart-data";
import { useShopCart } from "./cart-store";
import { useQuoteChoices, normalizedCoupon } from "./quote-choices";
import { useShopQuote } from "./use-shop-quote";
import { CouponEntry, QuoteFeedback, QuoteTotals } from "./quote-controls";
import "./shop.css";

export function CheckoutForm({
  products,
  settings,
}: {
  products: ShopProduct[];
  settings: ShopSettings;
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
  const [delivery, setDelivery] = useState<"shipping" | "pickup">(
    choices.delivery ?? (settings.shippingEnabled ? "shipping" : "pickup"),
  );
  const [acceptedTerms, setAcceptedTerms] = useState<string | null>(null);
  const consent = acceptedTerms === settings.terms;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const summary = cartSummary(cart.lines, products);
  const availableDelivery =
    delivery === "shipping" ? settings.shippingEnabled : settings.pickupEnabled;
  const deliveryNeedsChange =
    !availableDelivery && (settings.shippingEnabled || settings.pickupEnabled);
  const quoteState = useShopQuote({items:cart.lines,delivery,postcode:values.postcode,couponCode:choices.couponCode},products,settings,cart.ready && summary.valid && availableDelivery && settings.enabled);
  const quote = quoteState.quote;
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
    if (submitting.current || !canCheckout) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.lines,
          ...values,
          delivery,
          consent,
          couponCode: choices.couponCode,
          expectedQuote: quote!.fingerprint,
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
        <Link href="/butik" className="button button-primary">
          Till butiken
        </Link>
      </div>
    );
  return (
    <div className="shop-checkout-layout">
      <form
        onSubmit={submit}
        className="shop-checkout-form"
        aria-busy={pending}
      >
        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            className="notice notice-error"
            role="alert"
          >
            {error}
          </div>
        )}
        {!summary.valid && (
          <div className="notice notice-error" role="alert">
            En eller flera varor är inte längre tillgängliga i valt antal.{" "}
            <Link href="/butik/varukorg" className="inline-link">
              Justera varukorgen
            </Link>{" "}
            innan du betalar.
          </div>
        )}
        {!settings.shippingEnabled && !settings.pickupEnabled && (
          <p className="notice notice-error" role="alert">
            Beställningar öppnar när ett leveransalternativ finns tillgängligt.
          </p>
        )}
        <fieldset disabled={pending}>
          <legend>Dina kontaktuppgifter</legend>
          <div className="form-grid">
            {field("name", "Namn", {
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
            {field("phone", "Telefonnummer (valfritt)", {
              type: "tel",
              autoComplete: "tel",
              maxLength: 30,
            })}
          </div>
        </fieldset>
        <fieldset
          disabled={pending}
          aria-describedby={
            deliveryNeedsChange ? "checkout-delivery-unavailable" : undefined
          }
        >
          <legend>Leverans</legend>
          {deliveryNeedsChange && (
            <p
              id="checkout-delivery-unavailable"
              className="notice notice-error"
              role="alert"
            >
              Det valda leveranssättet är inte längre tillgängligt. Välj ett
              annat leveranssätt nedan för att fortsätta.
            </p>
          )}
          <div className="shop-delivery-options">
            {settings.shippingEnabled && (
              <label
                className={`shop-delivery-option${delivery === "shipping" ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="delivery"
                  value="shipping"
                  checked={delivery === "shipping"}
                  onChange={() => changeDelivery("shipping")}
                />
                <Truck size={20} aria-hidden="true" />
                <span>
                  <strong>Leverans inom Sverige</strong>
                  <small>
                    {settings.shippingRuleMode ? "Frakt beräknas från vikt och postnummer" : "Frakt visas i prisberäkningen"}
                  </small>
                </span>
              </label>
            )}
            {settings.pickupEnabled && (
              <label
                className={`shop-delivery-option${delivery === "pickup" ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="delivery"
                  value="pickup"
                  checked={delivery === "pickup"}
                  onChange={() => changeDelivery("pickup")}
                />
                <MapPin size={20} aria-hidden="true" />
                <span>
                  <strong>Hämta själv</strong>
                  <small>Ingen fraktkostnad</small>
                </span>
              </label>
            )}
          </div>
          {delivery === "shipping" && settings.shippingEnabled && (
            <div className="form-grid shop-address-fields">
              {field("address", "Gatuadress", {
                required: true,
                autoComplete: "shipping street-address",
                minLength: 3,
                maxLength: 200,
              })}
              {field("postcode", "Postnummer", {
                required: true,
                autoComplete: "shipping postal-code",
                maxLength: 6,
                pattern: "[0-9]{3} ?[0-9]{2}",
              })}
              {field("city", "Ort", {
                required: true,
                autoComplete: "shipping address-level2",
                minLength: 2,
                maxLength: 100,
              })}
              <p className="muted">Leveransland: Sverige.</p>
            </div>
          )}
          {delivery === "pickup" && settings.pickupEnabled && (
            <div className="shop-pickup-details">
              <h3>Hämtningsplats</h3>
              <p>{settings.pickupAddress}</p>
              {settings.pickupInstructions && (
                <TextContent text={settings.pickupInstructions} />
              )}
            </div>
          )}
        </fieldset>
        <CouponEntry draft={choices.couponDraft} code={choices.couponCode} onDraft={couponDraft=>choices.update({couponDraft})} onApply={()=>{choices.update({couponCode:normalizedCoupon(choices.couponDraft)});quoteState.refresh();}} onRemove={()=>choices.update({couponDraft:"",couponCode:""})} pending={quoteState.pending} disabled={pending} confirmedCode={quote?.couponCode}/>
        {settings.terms && (
          <details className="shop-checkout-terms">
            <summary>Läs köpvillkoren</summary>
            <TextContent text={settings.terms} />
          </details>
        )}
        <fieldset disabled={pending} className="shop-checkout-consent">
          <legend className="sr-only">Bekräfta villkoren</legend>
          <label className="consent-check">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(event) => setAcceptedTerms(event.target.checked ? settings.terms : null)}
              required
            />
            <span>
              Jag har läst{" "}
              <Link
                href="/butik/villkor"
                target="_blank"
                rel="noopener noreferrer"
              >
                köpvillkoren
              </Link>{" "}
              och{" "}
              <Link
                href="/integritet"
                target="_blank"
                rel="noopener noreferrer"
              >
                informationen om personuppgifter
              </Link>
              .
            </span>
          </label>
        </fieldset>
        <button
          type="submit"
          className="button button-primary"
          disabled={pending || !canCheckout || !consent}
        >
          <CreditCard size={18} aria-hidden="true" />
          {pending
            ? "Förbereder betalningen…"
            : quote ? `Fortsätt till betalning · ${formatMoney(quote.totalOre)}` : "Fortsätt till betalning"}{" "}
          {!pending && <ArrowRight size={17} aria-hidden="true" />}
        </button>
        <p className="muted">
          Du fortsätter till Stripe för att slutföra köpet. Beställningen är
          betald först när betalningen har bekräftats.
        </p>
        <noscript>
          <p className="notice notice-error">
            Kassan behöver JavaScript. Aktivera det i webbläsaren för att
            beställa.
          </p>
        </noscript>
      </form>
      <aside className="shop-summary">
        <h2>Din beställning</h2>
        <ul className="shop-checkout-lines">
          {summary.rows.map((row) => (
            <li key={row.productId}>
              <span>
                {row.quantity} × {row.product?.name || "Otillgänglig produkt"}
                {row.error && (
                  <small className="shop-item-error">{row.error}</small>
                )}
              </span>
              <strong>{quote ? formatMoney(quote.items.find(item=>item.productId===row.productId)?.lineTotalOre??0) : "—"}</strong>
            </li>
          ))}
        </ul>
        <QuoteFeedback pending={quoteState.pending} error={quoteState.error} needsPostcode={quoteState.needsPostcode} onRetry={quoteState.refresh}/>
        {quote && <QuoteTotals quote={quote}/>}
        <p className="muted">
          Priser i SEK inklusive moms. Priser, leveransval och lager
          kontrolleras igen när du fortsätter till betalning.
        </p>
        <Link href="/butik/varukorg" className="inline-link">
          Ändra varukorgen
        </Link>
      </aside>
    </div>
  );
}
