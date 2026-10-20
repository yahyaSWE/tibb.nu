"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./common";
import { SubmitButton } from "./submit-button";
import { reviewAnamnesAction, deleteAnamnesAction } from "@/lib/anamnes/admin-actions";
import { patternCatalog } from "@/lib/anamnes/patterns";
import type { FormulaRecord, PatternId } from "@/lib/anamnes/types";

type ReviewSelection = { selectedPrimaryPatternId: PatternId | null; selectedSecondaryPatternIds: PatternId[]; selectedFormulaId: string | null };
export function AnamnesReviewForm({ id, revision, formulaOptions = [], initialSelection }: { id: string; revision: number; formulaOptions?: Pick<FormulaRecord, "id" | "name" | "pinyin" | "active">[]; initialSelection?: Partial<ReviewSelection> }) {
  const [state, action] = useActionState(reviewAnamnesAction, {});
  const [primary, setPrimary] = useState<PatternId | "">(initialSelection?.selectedPrimaryPatternId ?? "");
  const [secondary, setSecondary] = useState<PatternId[]>(initialSelection?.selectedSecondaryPatternIds ?? []);
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <form action={action} className="anamnes-admin-editor">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="expectedRevision" value={state.revision ?? revision} />
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}{state.success && <p className="notice notice-success" role="status">{state.success}</p>}
    <p className="muted">Varje sparning skapar en ny daterad bedömningsanteckning. Ursprunglig anamnes och maskinell rapport bevaras separat. Vid samtidig redigering måste sidan laddas om.</p>
    <fieldset><legend>Din mönster- och formelbedömning</legend>
      <p className="muted">Välj dina egna slutsatser efter individuell bedömning. Valen ändrar inte maskinens analys, skapar ingen ordination och skickas inte till besökaren.</p>
      <Field name="anamnes-primary-pattern" label="Bedömt huvudmönster"><select id="anamnes-primary-pattern" name="selectedPrimaryPatternId" value={primary} onChange={event => { const value = event.target.value as PatternId | ""; setPrimary(value); setSecondary(current => current.filter(id => id !== value)); }}><option value="">Inget huvudmönster valt</option>{patternCatalog.map(pattern => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}</select></Field>
      <fieldset className="anamnes-review-secondary"><legend>Sekundära mönster (högst två)</legend><div className="anamnes-admin-checks">{patternCatalog.map(pattern => <label key={pattern.id}><input type="checkbox" name="selectedSecondaryPatternIds" value={pattern.id} checked={secondary.includes(pattern.id)} disabled={pattern.id === primary || secondary.length >= 2 && !secondary.includes(pattern.id)} onChange={event => setSecondary(current => event.target.checked ? [...current, pattern.id] : current.filter(id => id !== pattern.id))} /><span>{pattern.name}</span></label>)}</div></fieldset>
      <Field name="anamnes-selected-formula" label="Formelreferens i din bedömning" help="Endast aktiva katalogreferenser kan väljas. Kontrollera faktiska ingredienser, säkerhetsuppgifter och leverantörens kontrollpunkter innan eventuell användning."><select id="anamnes-selected-formula" name="selectedFormulaId" defaultValue={formulaOptions.some(formula => formula.active && formula.id === initialSelection?.selectedFormulaId) ? initialSelection?.selectedFormulaId ?? "" : ""}><option value="">Ingen formula vald</option>{formulaOptions.filter(formula => formula.active).map(formula => <option key={formula.id} value={formula.id}>{formula.name}{formula.pinyin && formula.pinyin !== formula.name ? ` · ${formula.pinyin}` : ""}</option>)}</select></Field>
      <Field name="anamnes-formula-notes" label="Din motivering och säkerhetsbedömning för formeln" help="Dokumentera även varför en referens avvisas, vilka uppgifter som saknas och vad som behöver följas upp."><textarea id="anamnes-formula-notes" name="formulaNotes" rows={5} maxLength={5000} /></Field>
    </fieldset>
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
