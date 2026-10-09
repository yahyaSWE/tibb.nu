"use client";

import { useEffect, useState } from "react";
import type { ShopProduct, ShopQuote, ShopQuoteInput, ShopSettings } from "@/lib/shop-types";
import { createLatestRequest, type LatestRequestState } from "./latest-request";
import { normalizedCoupon, normalizedPostcode, quoteRequestKey, readShopQuote } from "./quote-data";

export function useShopQuote(input: ShopQuoteInput, products: ShopProduct[], settings: ShopSettings, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<LatestRequestState<ShopQuote> | null>(null);
  const inputKey = quoteRequestKey(input, products, settings, revision);
  const postcodeRequired = input.delivery === "shipping" && settings.shippingRuleMode;
  const needsPostcode = Boolean(postcodeRequired && !/^\d{5}$/.test(normalizedPostcode(input.postcode || "")));
  const allowed = enabled && !needsPostcode;

  useEffect(() => {
    if (!allowed) return;
    const controller = createLatestRequest<ShopQuoteInput, ShopQuote>(async (request, signal) => {
      const response = await fetch("/api/shop/quote", {
        method: "POST", cache: "no-store", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: request.items, delivery: request.delivery,
          postcode: request.delivery === "shipping" ? normalizedPostcode(request.postcode || "") : "",
          couponCode: normalizedCoupon(request.couponCode || "") }),
      });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "Priset kunde inte beräknas. Försök igen.";
        throw new Error(message);
      }
      const quote = readShopQuote(value);
      if (!quote) throw new Error("Prisberäkningen kunde inte bekräftas. Försök igen.");
      return quote;
    }, setState);
    controller.start(inputKey, input);
    return () => controller.dispose();
    // The key contains every pricing input and the current server props.
    // Contact fields are deliberately excluded from the quote request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, allowed]);

  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const current = allowed && state?.key === inputKey ? state : null;
  return {
    quote: current?.status === "success" ? current.value : null,
    pending: allowed && (!current || current.status === "pending"),
    error: current?.status === "error" ? current.error instanceof Error ? current.error.message : "Anslutningen kunde inte bekräftas. Försök igen." : null,
    needsPostcode,
    refresh: () => setRevision((current) => current + 1),
  };
}
