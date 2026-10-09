"use client";

import { useActionState } from "react";
import { retryShopOrderEmailsAction } from "@/lib/shop-email-actions";

export function ShopOrderEmailRetry({ orderId }: { orderId: number }) {
  const [state, action, pending] = useActionState(retryShopOrderEmailsAction, {});
  return <form action={action} aria-busy={pending} className="stack">
    <input type="hidden" name="orderId" value={orderId} />
    {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
    {state.message && <p role="status" className="notice">{state.message}</p>}
    <div><button type="submit" className="button button-secondary" disabled={pending}>{pending ? "Behandlar utskick…" : "Behandla väntande utskick"}</button></div>
  </form>;
}
