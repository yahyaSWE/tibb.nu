"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function BookingPaymentStatus({ reference }: { reference: string }) {
  const router = useRouter();
  const manualCheck = useRef<() => void>(() => {});
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function check(manual = false) {
      if (stopped || busy) return;
      clearTimeout(timer);
      busy = true;
      attempts++;
      setChecking(true);
      if (manual) setMessage("");
      controller = new AbortController();
      try {
        const response = await fetch("/api/kustom/booking-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Betalningsstatus är inte tillgänglig.");
        const { status } = await response.json();
        if (stopped) return;
        if (status !== "pending") {
          stopped = true;
          router.refresh();
          return;
        }
        if (manual) setMessage("Betalningen väntar fortfarande på bekräftelse.");
      } catch {
        if (manual && !stopped) setMessage("Betalningen kunde inte kontrolleras just nu. Försök igen om en stund.");
      } finally {
        busy = false;
        if (!stopped) {
          setChecking(false);
          if (attempts < 8) timer = setTimeout(() => void check(), 5000);
          else if (!manual) setMessage("Bekräftelsen dröjer. Du kan kontrollera status igen här.");
        }
      }
    }

    manualCheck.current = () => void check(true);
    timer = setTimeout(() => void check(), 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      manualCheck.current = () => {};
    };
  }, [reference, router]);

  return <>
    <button type="button" className="button button-primary" disabled={checking} onClick={() => manualCheck.current()}>
      {checking ? "Kontrollerar betalningen…" : "Uppdatera status"}
    </button>
    {message && <p role="status">{message}</p>}
  </>;
}
