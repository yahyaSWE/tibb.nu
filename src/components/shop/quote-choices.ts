"use client";

import { useSyncExternalStore } from "react";
export { normalizedCoupon, normalizedPostcode } from "./quote-data";

type QuoteChoices = { delivery: "shipping" | "pickup" | null; postcode: string; couponDraft: string; couponCode: string };
const empty: QuoteChoices = { delivery: null, postcode: "", couponDraft: "", couponCode: "" };
let choices = empty;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function update(next: Partial<QuoteChoices>) {
  choices = { ...choices, ...next };
  for (const listener of listeners) listener();
}

// Only browser memory: the customer's draft choices survive a client-side
// route change, but are never written to localStorage or the cart payload.
export function useQuoteChoices() {
  const state = useSyncExternalStore(subscribe, () => choices, () => empty);
  return { ...state, update };
}
