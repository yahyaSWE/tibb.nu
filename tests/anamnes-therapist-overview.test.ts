import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnamnesTherapistOverview } from "../src/components/admin/anamnes-therapist-overview";
import { buildReport } from "../src/lib/anamnes/engine";
import { formulaSeed } from "../src/lib/anamnes/catalog-seed";
import { emptyConsultationDetails, type AnswerMap } from "../src/lib/anamnes/types";

const safety: AnswerMap = { adult: "yes", pregnancy: "no", medication: "no", chronicDisease: "no", liverKidney: "no", allergy: "no", emergency: "no", clinicalRedFlags: "no" };
const energy: AnswerMap = { ...safety, focus: "energy", duration: "months", trend: "stable", priorAssessment: "yes", energy: "low", pallor: "yes", dizziness: "yes", weakVoice: "yes", exertion: "tired", tongueColor: "pale" };

test("therapist overview separates own history and goals from tentative machine evidence", () => {
  const consultation = { ...emptyConsultationDetails(), locations: "Syntetisk plats", intensity: 0, frequency: "daily" as const, dailyImpact: "Syntetisk påverkan", goal: "Ett påhittat mål", previousCare: "Tidigare påhittad utredning", lifestyle: "Syntetisk vardag" };
  const report = buildReport(energy, formulaSeed);
  assert.ok(report.analysis.primary);
  const html = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report, answers: energy, narrative: "Syntetiskt fall <script>ingen kod</script>", consultation }));
  for (const value of ["Syntetisk plats", "0 av 10", "Dagligen", "Syntetisk påverkan", "Ett påhittat mål", "Tidigare påhittad utredning", "Syntetisk vardag", "Preliminär huvudhypotes i modellen", "Talar för", "Talar emot", report.analysis.primary.name]) assert.ok(html.includes(value), value);
  assert.match(html, /inte verifierade fynd och har inte poängsatts/);
  assert.match(html, /inte din självständiga bedömning/);
  assert.match(html, /&lt;script&gt;ingen kod&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Egna tung- och pulsobservationer/);
  assert.match(html, /Utvalda symtom- och vardagssvar/);
  assert.doesNotMatch(html, /<dt>Tidigare vårdbedömning<\/dt>/);
  assert.doesNotMatch(html, /Alla lämnade svar/);
});

test("uncertain and absent answers remain distinguishable in the therapist overview", () => {
  const answers: AnswerMap = { ...safety, focus: "pain", priorAssessment: "unknown", painWarmth: "prefer_not", weatherPain: "yes", stiffness: "yes" };
  const html = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report: buildReport(answers, []), answers }));
  assert.match(html, /Osäkra eller avböjda svar \(2\)/);
  assert.match(html, /Obesvarade kompletteringsfrågor/);
  assert.match(html, /Vet inte/);
  assert.match(html, /Vill inte svara/);
  assert.match(html, /Inte besvarad/);
  assert.match(html, /inte nekande svar/);
  assert.doesNotMatch(html, /Preliminär huvudhypotes i modellen/);
});

test("safety details and names remain visible to the therapist while formula references are blocked", () => {
  const answers: AnswerMap = { ...energy, medication: "yes", chronicDisease: "yes", allergy: "yes" };
  const consultation = { ...emptyConsultationDetails(), medicationDetails: "Påhittad komplettering om medicin", conditionDetails: "Påhittad sjukdomsbakgrund", allergyDetails: "Påhittad allergiuppgift" };
  const html = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report: buildReport(answers, formulaSeed), answers, medicationNames: "Syntetiskt preparat A", consultation }));
  for (const value of ["Syntetiskt preparat A", consultation.medicationDetails, consultation.conditionDetails, consultation.allergyDetails]) assert.ok(html.includes(value));
  assert.match(html, /Automatisk formeljämförelse är spärrad/);
  assert.doesNotMatch(html, /Formelreferenser att utvärdera/);
});

test("emergency overview keeps its alert and suppresses machine hypotheses and formula references", () => {
  const answers: AnswerMap = { ...energy, emergency: "yes" };
  const html = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report: buildReport(answers, formulaSeed), answers }));
  assert.match(html, /is-alert/);
  assert.match(html, /ring 112/i);
  assert.match(html, /Ingen mönsterhypotes visas här/);
  assert.doesNotMatch(html, /Preliminär huvudhypotes i modellen|Formelreferenser att utvärdera/);
});

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export default new Proxy({}, {get: (_, key) => String(key)});", shortCircuit: true };
    return nextLoad(url, context);
  },
});

test("public answers keep notes once inside a closed reading view and the admin audit can omit duplicate answers", async () => {
  const { AnamnesAnswers, AnamnesReport } = await import("../src/components/anamnes/report");
  const consultation = { ...emptyConsultationDetails(), goal: "Unikt eget mål", questionNotes: { energy: "Unik komplettering till svaret", sleep: "Unik notering utan fast svar" } };
  const html = renderToStaticMarkup(createElement(AnamnesAnswers, { answers: energy, consultation }));
  assert.match(html, /^<details[^>]*><summary>Alla lämnade svar/);
  assert.doesNotMatch(html, /^<details[^>]*\bopen=/);
  for (const text of [consultation.goal, consultation.questionNotes.energy, consultation.questionNotes.sleep]) assert.equal(html.split(text).length - 1, 1, text);
  assert.match(html, /Egen komplettering/);
  assert.match(html, /inte verifierade fynd eller poängsatta/);
  const audit = renderToStaticMarkup(createElement(AnamnesReport, { report: buildReport(energy, formulaSeed), answers: energy, consultation, showAnswers: false }));
  assert.doesNotMatch(audit, /Alla lämnade svar|Unik komplettering till svaret|Unik notering utan fast svar|Unikt eget mål/);
});
