"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import "./shop.css";

export function OrderControls({
  reference,
  pending,
  kustom = false,
}: {
  reference: string;
  pending: boolean;
  kustom?: boolean;
}) {
  const router = useRouter();
  const [refreshing, refresh] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const [checking, setChecking] = useState(false);
  async function checkPayment() {
    if (!kustom) { refresh(() => router.refresh()); return; }
    if (busy.current) return;
    busy.current = true; setChecking(true); setError(null);
    try {
      const response = await fetch("/api/kustom/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error || "Betalningen kunde inte kontrolleras. Försök igen om en stund."); }
      refresh(() => router.refresh());
    } catch { setError("Anslutningen till betalningstjänsten kunde inte bekräftas. Försök igen om en stund."); }
    finally { busy.current = false; setChecking(false); }
  }
  async function cancel() {
    if (busy.current) return;
    busy.current = true;
    setCancelling(true);
    setError(null);
    try {
      const response = await fetch("/api/shop/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const data =
          result && typeof result === "object"
            ? (result as Record<string, unknown>)
            : {};
        setError(
          typeof data.error === "string"
            ? data.error
            : "Beställningen kunde inte avbrytas. Uppdatera status och försök igen.",
        );
      }
      refresh(() => router.refresh());
    } catch {
      setError(
        "Anslutningen bröts. Uppdatera status innan du försöker avbryta igen.",
      );
    }
    setCancelling(false);
    busy.current = false;
  }
  return (
    <div className="shop-order-controls">
      {pending && (
        <button
          type="button"
          className="button button-primary"
          disabled={refreshing || cancelling || checking}
          onClick={checkPayment}
        >
          {refreshing || checking ? "Uppdaterar…" : "Uppdatera betalningsstatus"}
        </button>
      )}
      {pending && (
        <button
          type="button"
          className="button button-secondary"
          disabled={refreshing || cancelling || checking}
          onClick={cancel}
        >
          {cancelling ? "Avbryter…" : "Avbryt väntande beställning"}
        </button>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
