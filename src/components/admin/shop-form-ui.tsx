"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import type { ShopAdminActionState } from "@/lib/shop-admin-state";
import type { ReactNode, RefObject } from "react";

export function useShopInlineForm<Values>(
  action: (previous: ShopAdminActionState<Values>, data: FormData) => Promise<ShopAdminActionState<Values>>,
  defaults: Values,
) {
  const [state, formAction, pending] = useActionState(
    async (previous: ShopAdminActionState<Values>, data: FormData) => {
      try { return await action(previous, data); }
      catch (error) {
        unstable_rethrow(error);
        return { error: "Det gick inte att spara. Din inmatning finns kvar. Kontrollera anslutningen och försök igen." };
      }
    },
    {},
  );
  const [values, setValues] = useState(state.values ?? defaults);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.values) setValues(state.values); }, [state]);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state]);
  return {
    state: { ...state, success: !pending && values === state.values ? state.success : undefined },
    action: formAction, pending, values, setValues, errorRef,
  };
}

export function ShopSaveButton({ pending, disabled = false, children }: { pending: boolean; disabled?: boolean; children: ReactNode }) {
  return <button type="submit" className="button button-primary" disabled={pending || disabled}>
    {pending ? <><LoaderCircle size={17} className="admin-submit-spinner" aria-hidden="true" /> Sparar…</> : <><Save size={17} aria-hidden="true" />{children}</>}
  </button>;
}

export function ShopFormMessage({ state, errorRef }: { state: { error?: string; success?: string }; errorRef: RefObject<HTMLDivElement | null> }) {
  return state.error ? <div className="notice notice-error" role="alert" tabIndex={-1} ref={errorRef}>{state.error}</div> : state.success ? <div className="notice notice-success" role="status">{state.success}</div> : null;
}
