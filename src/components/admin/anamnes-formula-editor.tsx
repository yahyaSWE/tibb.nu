"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./common";
import { SubmitButton } from "./submit-button";
import { saveAnamnesFormulaAction, deleteAnamnesFormulaAction, type AnamnesAdminState } from "@/lib/anamnes/admin-actions";
import type { FormulaRecord, EvidenceRule, PatternId, QuestionId } from "@/lib/anamnes/types";
import { patternCatalog } from "@/lib/anamnes/patterns";
import { questionBank } from "@/lib/anamnes/questions";

type ProductChoice = { id: number; name: string; published: boolean };
const emptyFormula: FormulaRecord = {
  id: "", name: "", pinyin: "", hanzi: "", swedishName: "", active: false,
  primaryPatternIds: [], secondaryPatternIds: [], requiredPatternIds: [], supportingRules: [], opposingRules: [], requiredQuestionIds: [],
  theoryExplanation: "", scopeLimitation: "", safetyNotes: [], contraindications: [], interactions: [], ingredients: [], tongueIndicators: [], pulseIndicators: [], classicalSource: "",
  identityEvidence: "", ingredientEvidence: "", safetyEvidence: "", regulatoryEvidence: "", productId: null,
  productIdentityVerified: false, ingredientsVerified: false, safetyVerified: false, regulatoryVerified: false,
};

function Message({ state }: { state: AnamnesAdminState }) {
  return state.error ? <p className="notice notice-error" role="alert">{state.error}</p> : state.success ? <p className="notice notice-success" role="status">{state.success}</p> : null;
}

function PatternChoices({ label, value, onChange }: { label: string; value: PatternId[]; onChange: (value: PatternId[]) => void }) {
  return <fieldset><legend>{label}</legend><div className="anamnes-admin-checks">{patternCatalog.map(pattern => <label key={pattern.id}>
    <input type="checkbox" checked={value.includes(pattern.id)} onChange={event => onChange(event.target.checked ? [...value, pattern.id] : value.filter(id => id !== pattern.id))} />
    <span>{pattern.name}<br /><small className="muted">{pattern.pinyin}</small></span>
  </label>)}</div></fieldset>;
}

function RulesEditor({ title, rules, onChange }: { title: string; rules: EvidenceRule[]; onChange: (rules: EvidenceRule[]) => void }) {
  const questions = questionBank.filter(question => !question.professionalOnly);
  const change = (index: number, rule: EvidenceRule) => onChange(rules.map((current, i) => i === index ? rule : current));
  return <fieldset><legend>{title}</legend><p className="muted">Välj en observation och de svar som ska räknas som stöd eller motsägelse. Reglerna behöver kliniskt granskas.</p>
    <div className="anamnes-admin-rules">{rules.map((rule, index) => {
      const question = questionBank.find(item => item.id === rule.questionId);
      return <div className="anamnes-admin-rule" key={`${index}-${rule.questionId}`}>
        <label>Fråga<select value={rule.questionId} onChange={event => change(index, { ...rule, questionId: event.target.value as QuestionId, values: [] })}>{questions.map(item => <option key={item.id} value={item.id}>{item.prompt}</option>)}</select></label>
        <div className="anamnes-admin-rule-options">{question?.options.map(option => <label key={option.value}><input type="checkbox" checked={rule.values.includes(option.value)} onChange={event => change(index, { ...rule, values: event.target.checked ? [...rule.values, option.value] : rule.values.filter(value => value !== option.value) })} />{option.label}</label>)}</div>
        <label>Vikt (1–5)<input type="number" min={1} max={5} value={rule.weight} onChange={event => change(index, { ...rule, weight: Number(event.target.value) })} /></label>
        <button type="button" className="button button-secondary button-small" onClick={() => onChange(rules.filter((_, i) => i !== index))}>Ta bort regel</button>
      </div>;
    })}</div>
    {rules.length < 40 && <button type="button" className="button button-secondary button-small" onClick={() => onChange([...rules, { questionId: "energy", values: [], weight: 1 }])}>Lägg till regel</button>}
  </fieldset>;
}

export function AnamnesFormulaEditor({ formula, products }: { formula?: FormulaRecord; products: ProductChoice[] }) {
  const [values, setValues] = useState<FormulaRecord>(formula ?? emptyFormula);
  const [state, action, pending] = useActionState(saveAnamnesFormulaAction, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  const set = <Key extends keyof FormulaRecord>(key: Key, value: FormulaRecord[Key]) => setValues(current => ({ ...current, [key]: value }));
  const prefix = `formula-${formula?.id || "new"}`;
  function text(key: "id" | "name" | "pinyin" | "hanzi" | "swedishName", label: string, maxLength: number, required = false) {
    return <Field label={label} name={`${prefix}-${key}`}><input id={`${prefix}-${key}`} value={values[key]} onChange={event => set(key, event.target.value)} maxLength={maxLength} required={required} readOnly={key === "id" && !!formula} pattern={key === "id" ? "[a-z0-9][a-z0-9_-]{0,79}" : undefined} /></Field>;
  }
  function area(key: "theoryExplanation" | "scopeLimitation" | "classicalSource" | "identityEvidence" | "ingredientEvidence" | "safetyEvidence" | "regulatoryEvidence", label: string, help?: string) {
    return <Field label={label} name={`${prefix}-${key}`} help={key.endsWith("Evidence") ? `${help || "Ange det faktiskt granskade underlaget."} Minst 20 tecken behövs innan motsvarande verifieringsmarkering kan sparas.` : help}><textarea id={`${prefix}-${key}`} value={values[key]} onChange={event => set(key, event.target.value)} maxLength={key.endsWith("Evidence") ? 4000 : 2000} rows={3} /></Field>;
  }
  function lines(key: "safetyNotes" | "contraindications" | "interactions" | "ingredients" | "tongueIndicators" | "pulseIndicators", label: string, help?: string) {
    return <Field label={label} name={`${prefix}-${key}`} help={help || "En uppgift per rad. Tomt betyder att uppgiften inte är verifierad."}><textarea id={`${prefix}-${key}`} value={values[key].join("\n")} onChange={event => set(key, event.target.value.split("\n"))} maxLength={key === "ingredients" ? 16000 : 20000} rows={4} /></Field>;
  }
  return <form action={action} className="anamnes-admin-editor" aria-label={formula ? `Redigera ${formula.name}` : "Ny örtformel"}>
    <input type="hidden" name="formula" value={JSON.stringify({ ...values, ...(state.updatedAt ? { updatedAt: state.updatedAt } : {}), ingredients: values.ingredients.map(value => value.trim()).filter(Boolean), tongueIndicators: values.tongueIndicators.map(value => value.trim()).filter(Boolean), pulseIndicators: values.pulseIndicators.map(value => value.trim()).filter(Boolean), safetyNotes: values.safetyNotes.map(value => value.trim()).filter(Boolean), contraindications: values.contraindications.map(value => value.trim()).filter(Boolean), interactions: values.interactions.map(value => value.trim()).filter(Boolean) })} />
    <Message state={state} />
    <fieldset><legend>Formelns identitet</legend><div className="anamnes-admin-grid">
      {text("id", "Internt ID", 80, true)}{text("name", "Formelnamn", 160, true)}{text("pinyin", "Pinyin", 160)}{text("hanzi", "Kinesiska tecken", 100)}{text("swedishName", "Svenskt beskrivande namn", 200)}
    </div><p className="muted">ID är permanent efter att formeln har skapats. Endast små bokstäver, siffror, bindestreck och understreck.</p><label className="form-check"><input type="checkbox" checked={values.active} onChange={event => set("active", event.target.checked)} /><span>Aktiv referens i anamnesen</span></label></fieldset>
    <div className="anamnes-admin-grid">{area("theoryExplanation", "TCM-funktion och teoretisk relevans")}{area("scopeLimitation", "Begränsningar – vad formeln inte täcker")}{area("classicalSource", "Klassisk källa", "Ange endast källor som faktiskt har kontrollerats.")}{lines("tongueIndicators", "Karakteristiska tungobservationer", "Granskade teoretiska observationer, en per rad. Börjar tomt. Bedömning görs av behandlare.")}{lines("pulseIndicators", "Karakteristiska pulsobservationer", "Granskade teoretiska observationer, en per rad. Puls används inte för besökarens automatiska matchning.")}</div>
    <PatternChoices label="Primära mönster (minst ett)" value={values.primaryPatternIds} onChange={value => set("primaryPatternIds", value)} />
    <PatternChoices label="Sekundära mönster" value={values.secondaryPatternIds} onChange={value => set("secondaryPatternIds", value)} />
    <PatternChoices label="Mönster som måste vara underbyggda för en matchning" value={values.requiredPatternIds} onChange={value => set("requiredPatternIds", value)} />
    <details><summary>Fördjupade matchningsregler och nödvändiga frågor</summary><div className="stack" style={{ marginTop: 18 }}><RulesEditor title="Fynd som talar för" rules={values.supportingRules} onChange={value => set("supportingRules", value)} /><RulesEditor title="Fynd som talar emot" rules={values.opposingRules} onChange={value => set("opposingRules", value)} /><fieldset><legend>Frågor som behövs för fullständigare bedömning</legend><div className="anamnes-admin-checks">{questionBank.filter(question => !question.professionalOnly).map(question => <label key={question.id}><input type="checkbox" checked={values.requiredQuestionIds.includes(question.id)} onChange={event => set("requiredQuestionIds", event.target.checked ? [...values.requiredQuestionIds, question.id] : values.requiredQuestionIds.filter(id => id !== question.id))} /><span>{question.prompt}</span></label>)}</div></fieldset></div></details>
    <fieldset><legend>Säkerhet och verifierad produktinformation</legend><p className="notice">En klassisk referens är ingen ordination. China Natures innehåll får inte antas motsvara det klassiska receptet. Alla produktuppgifter börjar som overifierade.</p><div className="anamnes-admin-grid">
      {lines("safetyNotes", "Säkerhetsfrågor att bedöma")}{lines("contraindications", "Dokumenterade kontraindikationer")}{lines("interactions", "Dokumenterade läkemedelsinteraktioner")}{lines("ingredients", "Verifierad ingredienslista", "Skriv inte in ett antaget klassiskt recept. Använd den faktiska produktens dokumentation och ange en ingrediens per rad.")}
      {area("identityEvidence", "Dokumentation för produktidentitet", "Dokumentreferens, version eller datum som kopplar formeln till den faktiska produkten.")}{area("ingredientEvidence", "Dokumentation för ingredienser")}{area("safetyEvidence", "Dokumentation för säkerhet och interaktioner")}{area("regulatoryEvidence", "Underlag för regulatorisk status i Sverige")}
      <Field label="Kopplad produkt i butiken" name={`${prefix}-productId`} help="En produkt kan visas som tillgänglig först efter fullständig verifiering och kontroll att den är publicerad i butiken. Vid produktbyte: avmarkera alla fyra verifieringar och spara först. Granska sedan den nya produktens underlag och verifiera på nytt i en separat sparning."><select id={`${prefix}-productId`} value={values.productId ?? ""} onChange={event => set("productId", event.target.value ? Number(event.target.value) : null)}><option value="">Ingen produkt kopplad</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}{product.published ? "" : " (utkast)"}</option>)}</select></Field>
    </div><div className="anamnes-admin-checks" style={{ marginTop: 20 }}>{([
      ["productIdentityVerified", "Den faktiska produktidentiteten är kontrollerad"], ["ingredientsVerified", "Den faktiska ingredienslistan är kontrollerad"], ["safetyVerified", "Säkerhetsuppgifter och interaktioner är kontrollerade"], ["regulatoryVerified", "Regulatorisk status för svensk försäljning är kontrollerad"],
    ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={values[key]} onChange={event => set(key, event.target.checked)} /><span>{label}</span></label>)}</div><p className="muted">Ändrad ingredienslista kräver att ingrediens- och säkerhetsverifiering avmarkeras innan ändringen sparas. Granska därefter innehåll, risker och interaktioner och verifiera på nytt i en separat sparning.</p><p className="muted">Markeringarna ersätter inte en klinisk, juridisk eller regulatorisk granskning. Spara underlagen innan någon markering görs. Resultatet uppmanar alltid till konsultation och innehåller ingen köpknapp.</p></fieldset>
    <SubmitButton pendingLabel="Sparar formel…">{pending ? "Sparar…" : formula ? "Spara formel" : "Skapa formel"}</SubmitButton>
  </form>;
}

export function DeleteAnamnesFormula({ id, updatedAt }: { id: string; updatedAt?: string }) {
  const [state, action] = useActionState(deleteAnamnesFormulaAction, {});
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <form action={action} className="anamnes-admin-delete"><input type="hidden" name="id" value={id} /><input type="hidden" name="updatedAt" value={updatedAt || ""} /><Message state={state} /><p className="muted">Inaktivering behåller formeln för senare redigering. Borttagning tar bort den ur katalogen för kommande analyser; tidigare sparade rapporter ändras inte.</p><label className="form-check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Jag vill ta bort den här formeln ur katalogen</span></label><SubmitButton className="button button-danger button-small" pendingLabel="Tar bort…">Ta bort formel</SubmitButton></form>;
}
