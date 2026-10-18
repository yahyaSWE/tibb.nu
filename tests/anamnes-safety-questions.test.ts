import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { safetyQuestionIds } from "../src/lib/anamnes/engine";
import { questionById } from "../src/lib/anamnes/questions";
import { emptyConsultationDetails, type AnswerMap, type ConsultationDetails } from "../src/lib/anamnes/types";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export default new Proxy({}, {get: (_, key) => String(key)});", shortCircuit: true };
    return nextLoad(url, context);
  },
});

async function renderSafety(answers: AnswerMap = {}, medicationNames = "", busy = false, consultation: ConsultationDetails = emptyConsultationDetails()) {
  const { SafetyQuestions } = await import("../src/components/anamnes/safety-questions");
  return renderToStaticMarkup(createElement(SafetyQuestions, {
    answers,
    medicationNames,
    busy,
    onAnswer: () => {},
    onMedicationNamesChange: () => {},
    consultation,
    onConsultationChange: () => {},
  }));
}

test("all eight safety questions share one page with independent required choices and no defaults", async () => {
  const html = await renderSafety();
  const groups = [...html.matchAll(/<fieldset\b[^>]*>[\s\S]*?<\/fieldset>/g)].map(match => match[0]);
  assert.equal(groups.length, 8);
  assert.deepEqual(groups.map(group => group.match(/id="safety-([^"]+)"/)?.[1]), [
    "emergency", "clinicalRedFlags", "adult", "pregnancy", "medication", "chronicDisease", "liverKidney", "allergy",
  ]);
  assert.doesNotMatch(html, /\bchecked=/);
  assert.doesNotMatch(html, /<textarea\b/);
  for (const id of safetyQuestionIds) {
    const question = questionById.get(id)!;
    const group = groups.find(markup => markup.includes(`id="safety-${id}"`))!;
    assert.match(group, /tabindex="-1"/);
    assert.ok(group.includes(renderToStaticMarkup(createElement("legend", null, question.prompt))));
    if (question.help) {
      assert.ok(group.includes(`aria-describedby="safety-${id}-help"`));
      assert.ok(group.includes(question.help));
    }
    const radios = [...group.matchAll(/<input\b[^>]*>/g)].map(match => match[0]);
    assert.equal(radios.length, 4);
    assert.deepEqual(radios.map(radio => radio.match(/\bvalue="([^"]+)"/)?.[1]), question.options.map(option => option.value));
    for (const radio of radios) {
      assert.ok(radio.includes(`name="anamnes-${id}"`));
      assert.match(radio, /\brequired=""/);
    }
    for (const option of question.options) assert.ok(group.includes(`<span>${option.label}</span>`));
  }
});

test("medication names are requested only for yes and retain accessible length-limited text", async () => {
  const html = await renderSafety({ medication: "yes" }, "Påhittat preparat A\nPåhittat preparat B");
  const textarea = html.match(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/)?.[0];
  assert.ok(textarea);
  assert.match(html, /<label for="anamnes-medication-names">Vilka läkemedel eller kosttillskott tar du\?<\/label>/);
  assert.match(textarea, /\bid="anamnes-medication-names"/);
  assert.match(textarea, /\bname="medicationNames"/);
  assert.match(textarea, /\brequired=""/);
  assert.match(textarea, /\bmaxLength="1000"/);
  assert.match(textarea, /\bautoComplete="off"/);
  assert.match(textarea, /\brows="3"/);
  assert.match(textarea, /aria-describedby="anamnes-medication-names-help"/);
  assert.match(html, /Ange namnen, ett per rad\./);
  assert.match(html, /Uppgifterna är till för behandlaren och skickas inte till AI\./);
  assert.match(html, /Dos, hur ofta och varför · valfritt/);
  assert.match(textarea, />Påhittat preparat A\nPåhittat preparat B<\/textarea>/);
  for (const value of ["no", "unknown", "prefer_not"] as const) {
    assert.doesNotMatch(await renderSafety({ medication: value }, "Tidigare namn"), /<textarea\b|Tidigare namn/);
  }
});

test("all safety details are disabled while processing, and explicit unknown answers stay selected", async () => {
  const html = await renderSafety({ adult: "unknown", pregnancy: "prefer_not", medication: "yes", chronicDisease: "yes", allergy: "yes" }, "Syntetiskt preparat", true);
  const fieldsets = [...html.matchAll(/<fieldset\b[^>]*>/g)].map(match => match[0]);
  assert.ok(fieldsets.every(fieldset => /\bdisabled=""/.test(fieldset)));
  const controls = [...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)].map(match => match[0]);
  assert.equal(controls.length, 36);
  assert.ok(controls.every(control => /\bdisabled=""/.test(control)));
  const checked = controls.filter(control => /\bchecked=""/.test(control));
  assert.equal(checked.length, 5);
  assert.ok(checked.some(control => control.includes('name="anamnes-adult"') && control.includes('value="unknown"')));
  assert.ok(checked.some(control => control.includes('name="anamnes-pregnancy"') && control.includes('value="prefer_not"')));
  assert.ok(checked.some(control => control.includes('name="anamnes-medication"') && control.includes('value="yes"')));
});

test("positive safety branches retain optional details for the therapist with bounded accessible fields", async () => {
  const consultation = { ...emptyConsultationDetails(), medicationDetails: "Påhittad dos och frekvens", conditionDetails: "Påhittad tidigare diagnos", allergyDetails: "Påhittat ämne och reaktion" };
  const html = await renderSafety({ medication: "yes", chronicDisease: "yes", liverKidney: "yes", allergy: "yes" }, "Påhittat preparat", false, consultation);
  for (const [id, text] of [
    ["anamnes-medication-details", consultation.medicationDetails],
    ["anamnes-condition-details", consultation.conditionDetails],
    ["anamnes-allergy-details", consultation.allergyDetails],
  ]) {
    const textarea = [...html.matchAll(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/g)].map(match => match[0]).find(control => control.includes(`id="${id}"`));
    assert.ok(textarea, `Missing ${id}`);
    assert.ok(html.includes(`<label for="${id}">`));
    assert.match(textarea, /\bmaxLength="1500"/);
    assert.match(textarea, /\bautoComplete="off"/);
    assert.doesNotMatch(textarea, /\brequired=""/);
    assert.ok(textarea.includes(text));
  }
  assert.equal([...html.matchAll(/id="anamnes-condition-details"/g)].length, 1, "A shared diagnosis field must not be duplicated when both condition questions are positive");
});

test("liver or kidney history alone also exposes the shared condition field", async () => {
  const html = await renderSafety({ chronicDisease: "no", liverKidney: "yes" }, "", false, { ...emptyConsultationDetails(), conditionDetails: "Påhittad leveruppföljning" });
  assert.match(html, /id="anamnes-condition-details"/);
  assert.match(html, /Påhittad leveruppföljning/);
  assert.equal([...html.matchAll(/id="anamnes-condition-details"/g)].length, 1);
});

test("hidden safety details never render after negative or withheld answers", async () => {
  const consultation = { ...emptyConsultationDetails(), medicationDetails: "Tidigare preparatdetaljer", conditionDetails: "Tidigare diagnosdetaljer", allergyDetails: "Tidigare allergidetaljer" };
  for (const value of ["no", "unknown", "prefer_not"] as const) {
    const html = await renderSafety({ medication: value, chronicDisease: value, liverKidney: value, allergy: value }, "Tidigare preparatnamn", false, consultation);
    assert.doesNotMatch(html, /<textarea\b|Tidigare preparat|Tidigare diagnos|Tidigare allergi/);
  }
});

test("visitor supplied safety details remain escaped text rather than markup", async () => {
  const html = await renderSafety({ medication: "yes", allergy: "yes" }, "<script>syntetiskt</script>", false, { ...emptyConsultationDetails(), allergyDetails: "<img src=x>syntetiskt" });
  assert.match(html, /&lt;script&gt;syntetiskt&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x&gt;syntetiskt/);
  assert.doesNotMatch(html, /<script>|<img\b/);
});
