"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./common";
import { SubmitButton } from "./submit-button";
import { reviewAnamnesAction, deleteAnamnesAction } from "@/lib/anamnes/admin-actions";

export function AnamnesReviewForm({ id, revision }: { id: string; revision: number }) {
  const [state, action] = useActionState(reviewAnamnesAction, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <form action={action} className="anamnes-admin-editor">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="expectedRevision" value={state.revision ?? revision} />
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}{state.success && <p className="notice notice-success" role="status">{state.success}</p>}
    <p className="muted">Varje sparning skapar en ny daterad bedömningsanteckning. Ursprunglig anamnes och maskinell rapport bevaras separat. Vid samtidig redigering måste sidan laddas om.</p>
    <div className="anamnes-admin-grid">
      <Field name="anamnes-tongue-notes" label="Behandlarens egna tungobservationer"><textarea id="anamnes-tongue-notes" name="tongueNotes" rows={4} maxLength={5000} /></Field>
      <Field name="anamnes-pulse-notes" label="Behandlarens egna pulsobservationer"><textarea id="anamnes-pulse-notes" name="pulseNotes" rows={4} maxLength={5000} /></Field>
      <div className="anamnes-admin-full"><Field name="anamnes-review-corrections" label="Korrigeringar och invändningar mot maskinens analys" help="Beskriv vad du inte instämmer i och varför. Detta ersätter inte den sparade ursprungsrapporten."><textarea id="anamnes-review-corrections" name="corrections" rows={5} maxLength={10000} /></Field></div>
      <div className="anamnes-admin-full"><Field name="anamnes-review-notes" label="Övriga behandlarnoteringar"><textarea id="anamnes-review-notes" name="notes" rows={4} maxLength={10000} /></Field></div>
      <div className="anamnes-admin-full"><Field name="anamnes-final-assessment" label="Behandlarens självständiga kliniska bedömning" help="Dokumentera din egen bedömning efter individuell konsultation. Maskinrapporten är ett preliminärt underlag."><textarea id="anamnes-final-assessment" name="finalAssessment" rows={6} maxLength={10000} /></Field></div>
    </div>
    <SubmitButton pendingLabel="Sparar bedömning…">Spara separat behandlarbedömning</SubmitButton>
  </form>;
}

export function DeleteAnamnesCaseForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteAnamnesAction, {});
  const router = useRouter();
  useEffect(() => { if (state.success) { router.replace("/admin/anamnes/arenden"); router.refresh(); } }, [state, router]);
  return <form action={action} className="anamnes-admin-delete"><input type="hidden" name="id" value={id} />
    <h2>Radera ärendet</h2><p className="muted">Raderar anamnes, kontaktuppgifter och alla behandlarbedömningar från den aktiva databasen. Säkerhetskopior hanteras enligt verksamhetens dokumenterade rutiner.</p>
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
    <label className="form-check"><input name="confirm" value="yes" type="checkbox" required /><span>Jag bekräftar att hela ärendet ska raderas</span></label>
    <SubmitButton className="button button-danger" pendingLabel="Raderar…">Radera anamnes och anteckningar</SubmitButton>
  </form>;
}
