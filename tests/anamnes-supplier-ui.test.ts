import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnamnesCatalogStockList, AnamnesSupplierProfile, AnamnesTherapistOverview } from "../src/components/admin/anamnes-therapist-overview";
import { FormulaRecordSchema, ReportSchema, SupplierProfileSchema, type FormulaMatch, type Report } from "../src/lib/anamnes/types";

const profile = SupplierProfileSchema.parse({
  id: "synthetic-source", supplier: "China Nature", document: "rangejohan.pdf", documentSha256: "a".repeat(64),
  productName: "Syntetisk produkt", pdfProductName: "Syntetiskt dokumentnamn", formulaName: "Syntetisk klassisk formel", chineseName: null, pages: [7, 8],
  ingredients: [{ pinyin: "Syntetisk ingrediens <script>ej kod</script>", botanicalName: "Syntetiskt botaniskt namn", pages: [7] }],
  actions: [{ text: "Syntetisk uppgift ur källan", pages: [7], kind: "supplier" }],
  traditionalPatterns: [{ text: "Syntetisk komplettering", pages: [8], kind: "interpretation" }],
  indications: [], explanation: [], temperature: [{ text: "Syntetisk oklar uppgift", pages: [8], kind: "unverified" }], cautions: [],
  verificationIssues: [{ code: "synthetic_discrepancy", message: "Syntetisk konflikt mellan lista och förklaring", pages: [7, 8] }],
  unverifiedFields: ["Syntetiskt saknat extraktionsförhållande"],
});
const formula = FormulaRecordSchema.parse({
  id: "synthetic-source", name: "Syntetisk produkt", pinyin: "Syntetisk klassisk formel", hanzi: "", swedishName: "", active: true,
  primaryPatternIds: ["spleenQiDeficiency"], secondaryPatternIds: [], requiredPatternIds: [], supportingRules: [], opposingRules: [], requiredQuestionIds: [],
  theoryExplanation: "", scopeLimitation: "", safetyNotes: [], contraindications: [], interactions: [], ingredients: [], classicalSource: "",
  identityEvidence: "", ingredientEvidence: "", safetyEvidence: "", regulatoryEvidence: "", productId: null,
  productIdentityVerified: false, ingredientsVerified: false, safetyVerified: false, regulatoryVerified: false,
  supplierProfile: profile, requiresVerification: true,
});
const primary = { id: "spleenQiDeficiency", name: "Syntetiskt huvudmönster", pinyin: "Syntetiskt pinyin", hanzi: "", explanation: "Syntetisk analys", score: 12, supporting: [], opposing: [], missingQuestionIds: [], qualified: true };
const match = { formulaId: "synthetic-source", name: "Syntetisk produkt", pinyin: "Syntetiskt pinyin", classicalName: "Syntetisk klassisk formel", hanzi: "", swedishName: "", score: 99, explanation: "Syntetisk matchningsmotivering", supporting: [{ questionId: "energy", answer: "low", label: "Syntetiskt stöd", weight: 3 }], opposing: [{ questionId: "temperature", answer: "hot", label: "Syntetiskt motfynd", weight: 3 }], missingQuestionIds: ["tongueCoating"], partial: true, limitation: "Syntetisk begränsning", safetyNotes: ["Syntetisk försiktighet"], productAvailable: false, productId: null, productUrl: null, requiresVerification: true, verificationNotes: ["Ingrediensuppgifter behöver verifieras före eventuell produktanvändning."] };
const dimension = { value: "Syntetisk dimension", supporting: [], opposing: [] };
const report = ReportSchema.parse({ version: 2, analysis: { status: "preliminary", primary, secondary: [], patterns: [primary], baGang: { yinYang: dimension, interiorExterior: dimension, coldHeat: dimension, deficiencyExcess: dimension }, zangFu: [], missingQuestionIds: [], conflicts: [] }, safety: { level: "clear", blocksFormulas: false, flags: [], missingQuestionIds: [] }, formulaMatches: [match], formulaStatus: "matched", formulaReferencesEnabled: true, source: "rules", followUpQuestionIds: [] });

test("protected supplier profile distinguishes source facts, interpretations, missing data and original discrepancies", () => {
  const html = renderToStaticMarkup(createElement(AnamnesSupplierProfile, { formula }));
  for (const text of ["China Nature", "rangejohan.pdf", "PDF-sidor 7, 8", "PDF-sida 7", "Syntetiskt dokumentnamn", "Uttryckligen i leverantörsdokumentet", "Kompletterande TCM-tolkning", "Ej verifierat", "Syntetiskt saknat extraktionsförhållande", "synthetic_discrepancy", "inga verifierade behandlingseffekter"]) {
    if (text === "inga verifierade behandlingseffekter") assert.match(html, /inte belägg för behandlingseffekt/);
    else assert.ok(html.includes(text), text);
  }
  assert.match(html, /&lt;script&gt;ej kod&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Gissa inte vilken ingrediensversion/);
});

test("protected stock list separates inventory, draft and store activation from verification", () => {
  const html = renderToStaticMarkup(createElement(AnamnesCatalogStockList, { stock: [
    { id: "unlinked", formulaName: "Okopplad referens", productId: null, productName: null, stock: null, published: false, shopEnabled: false, available: false },
    { id: "draft", formulaName: "Utkastreferens", productId: 1, productName: "Syntetiskt butiksutkast", stock: 12, published: false, shopEnabled: true, available: false },
    { id: "closed", productId: 2, productName: "Syntetisk stängd butik", stock: 3, published: true, shopEnabled: false, available: false },
    { id: "unchecked", productId: 3, productName: "Syntetisk overifierad produkt", stock: 20, published: true, shopEnabled: true, available: false },
  ] }));
  for (const text of ["Okopplad referens", "Ingen produkt kopplad", "12 i lager", "Utkast i butiken", "Butiken är avstängd", "20 i lager", "Visas inte som tillgänglig produkt"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Verifierad och tillgänglig i butiken/);
});

test("therapist overview retains match evidence and inventory while clinical clearance remains separate", () => {
  const html = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report, answers: {}, catalogStock: [] }));
  for (const text of ["Syntetisk produkt", "Syntetisk klassisk formel", "Syntetisk matchningsmotivering", "Syntetiskt stöd", "Syntetiskt motfynd", "Saknade uppgifter", "Syntetisk försiktighet", "Produktuppgifter behöver verifieras", "Lager och produktkopplingar (0)"]) assert.ok(html.includes(text), text);
  const blocked: Report = { ...report, safety: { level: "consultation", blocksFormulas: true, flags: ["Syntetisk säkerhetsspärr"], missingQuestionIds: [] } };
  const blockedHtml = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report: blocked, answers: {}, catalogStock: [] }));
  assert.match(blockedHtml, /Lager och produktkopplingar/);
  assert.doesNotMatch(blockedHtml, /Formelreferenser att utvärdera|Syntetisk matchningsmotivering/);
});

registerHooks({ load(url, context, nextLoad) { if (url.endsWith(".css")) return { format: "module", source: "export default new Proxy({}, {get: (_, key) => String(key)});", shortCircuit: true }; return nextLoad(url, context); } });

test("public result shows product plus classical name, evidence and verification without supplier-only documentation", async () => {
  const { AnamnesReport } = await import("../src/components/anamnes/report");
  // A stale availability flag must not override a current verification hold.
  const reference: FormulaMatch = { ...report.formulaMatches[0], productAvailable: true, productId: 1, productUrl: "/butik/syntetisk-produkt" };
  const html = renderToStaticMarkup(createElement(AnamnesReport, { report: { ...report, formulaMatches: [reference] }, answers: {} }));
  for (const text of ["Syntetisk produkt", "Klassisk formel: Syntetisk klassisk formel", "Syntetiskt stöd", "Syntetiskt motfynd", "Syntetisk försiktighet", "Produktuppgifter behöver verifieras", "Viktiga uppgifter som behöver kompletteras"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Läs verifierad produktinformation|href="\/butik|rangejohan\.pdf|Dokumentets SHA-256|Syntetiskt botaniskt namn|synthetic_discrepancy|Syntetisk konflikt mellan lista och förklaring|Syntetiskt saknat extraktionsförhållande/);
  const many = Array.from({ length: 4 }, (_, index) => ({ ...reference, formulaId: `synthetic-${index}`, name: `Syntetisk referens ${index}` }));
  const capped = renderToStaticMarkup(createElement(AnamnesReport, { report: { ...report, formulaMatches: many }, answers: {} }));
  assert.ok(capped.includes("Syntetisk referens 2"));
  assert.ok(!capped.includes("Syntetisk referens 3"));
});

test("excluded formula reasons remain collapsed and explain missing safety answers without becoming recommendations", async () => {
  const { AnamnesReport } = await import("../src/components/anamnes/report");
  const excluded: Report = { ...report, formulaMatches: [], formulaStatus: "no_match", formulaExclusions: [{ formulaId: "synthetic-tonic", name: "Syntetisk utesluten referens", reasons: ["Uppgiften om pågående infektion behöver bekräftas.", "Syntetisk säkerhetsuppgift <script>ingen kod</script>"] }] };
  const html = renderToStaticMarkup(createElement(AnamnesReport, { report: excluded, answers: {} }));
  assert.match(html, /<details[^>]*><summary>Formelreferenser som inte kunde tas med<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*open[^>]*><summary>Formelreferenser som inte kunde tas med/);
  for (const text of ["Syntetisk utesluten referens", "Uppgiften om pågående infektion behöver bekräftas.", "inte förslag att använda eller köpa", "högt matchningsvärde kan inte upphäva en spärr"]) assert.ok(html.includes(text), text);
  assert.match(html, /&lt;script&gt;ingen kod&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|rangejohan\.pdf|Syntetiskt botaniskt namn|Läs verifierad produktinformation/);
  const therapist = renderToStaticMarkup(createElement(AnamnesTherapistOverview, { report: excluded, answers: {} }));
  assert.match(therapist, /<details[^>]*><summary>Formelreferenser som uteslutits i säkerhetskontrollen<\/summary>/);
  assert.match(therapist, /Uppgiften om pågående infektion behöver bekräftas/);
  assert.match(therapist, /inga användningsförslag/);
  assert.doesNotMatch(therapist, /rangejohan\.pdf|Syntetiskt botaniskt namn/);
  const globalBlock: Report = { ...excluded, safety: { level: "consultation", blocksFormulas: true, flags: ["Syntetisk global säkerhetsspärr"], missingQuestionIds: [] } };
  const publicBlocked = renderToStaticMarkup(createElement(AnamnesReport, { report: globalBlock, answers: {} }));
  assert.doesNotMatch(publicBlocked, /Syntetisk utesluten referens/);
});

test("incomplete composite explanations show alternatives without naming an unqualified pattern", async () => {
  const { AnamnesReport } = await import("../src/components/anamnes/report");
  const finding = { ...report.analysis.patterns[0], id: "liverQiStasisHeat" as const, name: "Syntetiskt otillräckligt mönster", qualified: false, supporting: [{ questionId: "ribTension" as const, answer: "yes", label: "Syntetiskt stöd för spänning", weight: 3 }, { questionId: "stressDigestion" as const, answer: "yes", label: "Syntetiskt stöd för samband", weight: 3 }] };
  const incomplete: Report = { ...report, analysis: { ...report.analysis, status: "insufficient", primary: null, secondary: [], patterns: [finding] }, formulaMatches: [], formulaStatus: "insufficient" };
  const html = renderToStaticMarkup(createElement(AnamnesReport, { report: incomplete, answers: { ribTension: "yes", stressDigestion: "yes", temperature: "unknown", tongueColor: "unknown", painCharacter: "unknown" } }));
  assert.match(html, /Delkomponenter som saknar stöd/);
  assert.match(html, /Minst ett av alternativen behöver bekräftas:/);
  assert.match(html, /I jämförelsen räknas:/);
  assert.match(html, /Vet inte/);
  assert.doesNotMatch(html, /Syntetiskt otillräckligt mönster|Samtliga alternativ måste|Alla alternativ måste/);
});
