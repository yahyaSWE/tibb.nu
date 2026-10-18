import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { safetyQuestionIds } from "../src/lib/anamnes/engine";
import { questionById } from "../src/lib/anamnes/questions";
import type { AnswerMap } from "../src/lib/anamnes/types";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export default new Proxy({}, {get: (_, key) => String(key)});", shortCircuit: true };
    return nextLoad(url, context);
  },
});

async function renderSafety(answers: AnswerMap = {}, medicationNames = "", busy = false) {
  const { SafetyQuestions } = await import("../src/components/anamnes/safety-questions");
  return renderToStaticMarkup(createElement(SafetyQuestions, {
    answers,
    medicationNames,
    busy,
    onAnswer: () => {},
    onMedicationNamesChange: () => {},
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
  assert.match(html, /Ange namnen, ett per rad\. Dosering behövs inte\./);
  assert.match(textarea, />Påhittat preparat A\nPåhittat preparat B<\/textarea>/);
  for (const value of ["no", "unknown", "prefer_not"] as const) {
    assert.doesNotMatch(await renderSafety({ medication: value }, "Tidigare namn"), /<textarea\b|Tidigare namn/);
  }
});

test("all inputs are disabled while processing, and explicit unknown answers stay selected", async () => {
  const html = await renderSafety({ adult: "unknown", pregnancy: "prefer_not", medication: "yes" }, "Syntetiskt preparat", true);
  const fieldsets = [...html.matchAll(/<fieldset\b[^>]*>/g)].map(match => match[0]);
  assert.ok(fieldsets.every(fieldset => /\bdisabled=""/.test(fieldset)));
  const controls = [...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)].map(match => match[0]);
  assert.equal(controls.length, 33);
  assert.ok(controls.every(control => /\bdisabled=""/.test(control)));
  const checked = controls.filter(control => /\bchecked=""/.test(control));
  assert.equal(checked.length, 3);
  assert.ok(checked.some(control => control.includes('name="anamnes-adult"') && control.includes('value="unknown"')));
  assert.ok(checked.some(control => control.includes('name="anamnes-pregnancy"') && control.includes('value="prefer_not"')));
  assert.ok(checked.some(control => control.includes('name="anamnes-medication"') && control.includes('value="yes"')));
});
