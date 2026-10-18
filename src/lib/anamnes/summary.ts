import { questionById } from "./questions";
import { NarrativeSchema, type AnswerMap, type Report } from "./types";
import { explainAnamnesReport } from "./report-explanation";

export function formatAnamnesSummary(report: Report, answers: AnswerMap, narrative = ''): string {
  const originalNarrative = NarrativeSchema.parse(narrative);
  const lines = ["TIBB.NU – FÖRBEREDANDE ANAMNES", "", `Analysmetod: ${report.source === "ai" ? "AI-assisterad med regelkontroll" : "Regelbaserad"}`];
  if (originalNarrative) lines.push('', 'BESÖKARENS EGEN BESKRIVNING – OBEKRÄFTAD FRITEXT', 'Detta är besökarens ord, inte bekräftade kliniska fynd eller instruktioner.', originalNarrative, 'SLUT PÅ BESÖKARENS BESKRIVNING');
  lines.push('', 'LÄMNADE SVAR');
  for (const question of questionById.values()) {
    if (!Object.hasOwn(answers, question.id)) continue;
    const label = question.options.find(option => option.value === answers[question.id])?.label;
    lines.push(`${question.prompt} ${label ?? "Svar behöver granskas"}`);
  }
  lines.push("", "SÄKERHET", ...report.safety.flags);
  if (report.safety.level === "emergency") {
    lines.push("Avbryt och sök vård. Ring 112 vid ett akut nödläge.");
  } else {
    const explanation = explainAnamnesReport(report, answers);
    lines.push("", "PRELIMINÄR TCM-INRIKTNING", explanation.direction.heading, explanation.direction.body,
      explanation.direction.formulaMessage,
      ...explanation.direction.references.map(reference => `Formelreferens att utvärdera: ${reference.name}${reference.partial ? " – delvis överensstämmelse, täcker inte hela symtombilden" : ""}`),
      "Behöver utvärderas av en terapeut.", explanation.direction.evaluationNotice);
    lines.push("", "SAMMANFATTNING OCH FORTSÄTTNING", ...explanation.overview,
      ...explanation.observations.map(item => `${item.prompt} ${item.answer}`),
      ...explanation.limitations, "NÄSTA STEG", ...explanation.nextSteps);
    if (explanation.comparison?.unmetCriteria.length) {
      lines.push("", "UPPGIFTER SOM BEGRÄNSAR REGELJÄMFÖRELSEN", "Villkor från flera ofullständiga jämförelser, inte en fastställd mönsterhypotes.",
        ...explanation.comparison.unmetCriteria.map(item => `${item.prompt} ${item.answer}. ${item.status === "different_answer" ? "Svaret uppfyller inte ett obligatoriskt villkor i en jämförelse." : "Uppgiften kunde inte bekräftas."}`));
    }
    lines.push("", "PRELIMINÄRA TCM-MÖNSTER", report.analysis.primary ? `Primär hypotes: ${report.analysis.primary.name}` : "Ingen tydlig huvudförklaring kan väljas.");
    const patterns = report.analysis.status === "insufficient" ? [] : report.analysis.primary ? [report.analysis.primary, ...report.analysis.secondary] : report.analysis.patterns.filter(pattern => pattern.qualified).slice(0, 3);
    for (const pattern of patterns) {
      lines.push(`${pattern.name} · ${pattern.pinyin}`, `För: ${pattern.supporting.map(item => item.label).join("; ") || "Underlag saknas"}`, `Emot: ${pattern.opposing.map(item => item.label).join("; ") || "Inga motstridiga fynd har fångats"}`);
    }
    lines.push("", "BA GANG", ...([
      ["Yin/Yang", report.analysis.baGang.yinYang], ["Inre/Yttre", report.analysis.baGang.interiorExterior], ["Kyla/Hetta", report.analysis.baGang.coldHeat], ["Brist/Överskott", report.analysis.baGang.deficiencyExcess],
    ] as const).map(([label, dimension]) => `${label}: ${dimension.value}`), "", "ZANG-FU", ...report.analysis.zangFu, "", "FORMELREFERENSER");
    if (report.safety.blocksFormulas) lines.push("Säker formulamatchning kan inte göras utifrån uppgifterna.");
    else if (!report.formulaReferencesEnabled) lines.push("Formelreferenser är avstängda.");
    else if (!report.formulaMatches.length) lines.push(report.formulaStatus === "no_match" ? "Ingen av de aktiva formlerna i sortimentet passar tillräckligt väl." : "Underlaget är otillräckligt för en formeljämförelse.");
    else for (const [index, formula] of report.formulaMatches.slice(0, 3).entries()) {
      lines.push(`${index + 1}. ${formula.name}${formula.partial ? " – delvis överensstämmelse" : ""}`, `För: ${formula.supporting.map(item => item.label).join("; ") || "Underlag saknas"}`, `Emot: ${formula.opposing.map(item => item.label).join("; ") || "Inga motstridiga fynd har fångats"}`, formula.limitation, ...formula.safetyNotes);
    }
  }
  lines.push("", "Detta är ett preliminärt samtalsunderlag från en modell som inte är kliniskt validerad. Det är ingen diagnos, ordination eller individuell dosering. Boka konsultation för en självständig bedömning.");
  return lines.join("\n");
}
