"use client";

import { useActionState } from "react";
import { requestShopWithdrawal } from "@/lib/shop-withdrawal-actions";
import "./shop.css";

export function WithdrawalForm({ order }: { order?: { reference: string; name: string; email: string } }) {
  const [state, action, pending] = useActionState(requestShopWithdrawal, {});
  if (state.receipt) return (
    <div className="stack" role="status">
      <h2>Vi har tagit emot ditt meddelande</h2>
      {state.receipt.split("\n\n").map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      <p>Ett mottagningsbevis skickas till e-postadressen för beställningen.</p>
      <p><a className="inline-link" download="mottagningsbevis-tibb.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(state.receipt)}`}>Ladda ner mottagningsbeviset</a></p>
    </div>
  );

  return (
    <form className="stack" action={action} aria-busy={pending}>
      {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      <fieldset className="stack content-form-fields" disabled={pending}>
        <label className="field">Ditt namn<input name="name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={state.name ?? order?.name} /></label>
        <label className="field">Beställningsreferens<input name="reference" spellCheck={false} autoCapitalize="none" required minLength={32} maxLength={32} defaultValue={state.reference ?? order?.reference} aria-describedby="withdrawal-reference-help" /></label>
        <p className="small muted" id="withdrawal-reference-help">Referensen finns i beställningsbekräftelsen.</p>
        <label className="field">E-post för mottagningsbeviset<input name="email" type="email" autoComplete="email" maxLength={254} required defaultValue={state.email ?? order?.email} aria-describedby="withdrawal-email-help" /></label>
        <p className="small muted" id="withdrawal-email-help">Ange samma e-postadress som vid beställningen.</p>
        <label className="form-check"><input type="checkbox" name="confirmed" required /><span>Jag vill frånträda avtalet för den här beställningen.</span></label>
        <div><button type="submit" className="button button-primary">{pending ? "Skickar…" : "Bekräfta att jag ångrar köpet"}</button></div>
      </fieldset>
    </form>
  );
}
