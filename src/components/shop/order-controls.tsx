"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import "./shop.css";

export function OrderControls({
  reference,
  pending,
}: {
  reference: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [refreshing, refresh] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
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
          disabled={refreshing || cancelling}
          onClick={() => refresh(() => router.refresh())}
        >
          {refreshing ? "Uppdaterar…" : "Uppdatera betalningsstatus"}
        </button>
      )}
      {pending && (
        <button
          type="button"
          className="button button-secondary"
          disabled={refreshing || cancelling}
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
