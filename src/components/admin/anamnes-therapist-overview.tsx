import { questionById } from "@/lib/anamnes/questions";
import { consultationDetailRows } from "@/lib/anamnes/consultation";
import { explainAnamnesReport } from "@/lib/anamnes/report-explanation";
import { emptyConsultationDetails, type AnswerMap, type ConsultationDetails, type FormulaRecord, type PatternFinding, type QuestionId, type Report } from "@/lib/anamnes/types";

type OverviewProps = {
  report: Report;
  answers: AnswerMap;
  narrative?: string;
  medicationNames?: string;
  consultation?: ConsultationDetails;
  catalogStock?: AnamnesCatalogStock[];
};
export type AnamnesCatalogStock = { id: string; formulaName?: string; productId: number | null; productName: string | null; stock: number | null; published: boolean; shopEnabled: boolean; available: boolean };

export function AnamnesCatalogStockList({ stock, formulaNames = {} }: { stock: AnamnesCatalogStock[]; formulaNames?: Record<string, string> }) {
  return <details className="anamnes-therapist-details"><summary>Lager och produktkopplingar ({stock.length})</summary><p className="muted">Aktuellt lager i butikssystemet. Lagerantalet bekräftar inte produktens verifiering eller lämplighet för en viss person.</p><dl className="anamnes-therapist-stock">{stock.map(item => <div key={item.id}><dt>{formulaNames[item.id] || item.formulaName || item.productName || item.id}</dt><dd>{item.productId === null ? "Ingen produkt kopplad" : <><strong>{item.productName || `Produkt ${item.productId}`}</strong><span>{item.stock === null ? "Lageruppgift saknas" : `${item.stock} i lager`}</span><span>{!item.published ? "Utkast i butiken" : !item.shopEnabled ? "Butiken är avstängd" : item.available ? "Verifierad och tillgänglig i butiken" : "Visas inte som tillgänglig produkt"}</span></>}</dd></div>)}</dl></details>;
}

/** Protected supplier documentation. Never import this into a public report. */
export function AnamnesSupplierProfile({ formula }: { formula: FormulaRecord }) {
  const source = formula.supplierProfile;
  if (!source) return <p className="muted">Ingen leverantörsprofil är dokumenterad för den här referensen.</p>;
  const pageLabel = (pages: number[]) => `${pages.length === 1 ? "PDF-sida" : "PDF-sidor"} ${pages.join(", ")}`;
  const sections = [
    ["TCM-funktioner (Actions)", source.actions], ["Traditionella mönster", source.traditionalPatterns],
    ["Traditionella indikationer enligt leverantören", source.indications], ["Formelns uppbyggnad", source.explanation],
    ["Temperatur", source.temperature], ["Kontraindikationer och försiktighet", source.cautions],
  ] as const;
  const originLabels = { supplier: "Uttryckligen i leverantörsdokumentet", interpretation: "Kompletterande TCM-tolkning", unverified: "Ej verifierat" };
  return <section className="anamnes-supplier-profile" aria-label={`Leverantörsunderlag för ${formula.name}`}>
    <h3>Leverantörsunderlag · {source.supplier}</h3>
    <p className="muted">Spårbar dokumentation för behandlarens granskning. Traditionella indikationer och sjukdomslistor är inte belägg för behandlingseffekt eller godkända produktpåståenden.</p>
    <dl className="anamnes-admin-answer-list"><div><dt>Produkt i sortimentet</dt><dd>{source.productName}</dd></div>{source.pdfProductName !== source.productName && <div><dt>Produktnamn i dokumentet</dt><dd>{source.pdfProductName}</dd></div>}<div><dt>Klassisk formel</dt><dd>{source.formulaName}{source.chineseName && <> · <span lang="zh">{source.chineseName}</span></>}</dd></div><div><dt>Källa</dt><dd>{source.document} · {pageLabel(source.pages)}<br /><small>Dokumentets SHA-256: <code>{source.documentSha256}</code></small></dd></div></dl>
    {source.verificationIssues.length > 0 && <div className="anamnes-therapist-attention"><h4>Kontrollpunkter i originalunderlaget</h4><ul>{source.verificationIssues.map(issue => <li key={issue.code}><strong>{issue.code}</strong>: {issue.message} <small>({pageLabel(issue.pages)})</small></li>)}</ul><p>Gissa inte vilken ingrediensversion som avses. Ursprungskällans uppgifter behålls även när en senare kontroll dokumenteras.</p></div>}
    <h4>Uppräknade ingredienser i leverantörsdokumentet</h4><ul>{source.ingredients.map((ingredient, index) => <li key={`${ingredient.pinyin}-${index}`}><strong>{ingredient.pinyin}</strong>{ingredient.botanicalName && <> · {ingredient.botanicalName}</>} <small>({pageLabel(ingredient.pages)})</small></li>)}</ul>
    {sections.map(([title, statements]) => <details className="anamnes-therapist-details" key={title}><summary>{title}</summary>{statements.length ? <ul>{statements.map((statement, index) => <li key={index}>{statement.text}<br /><small>{originLabels[statement.kind]} · {pageLabel(statement.pages)}</small></li>)}</ul> : <p className="muted">Uppgift saknas i det dokumenterade underlaget.</p>}</details>)}
    {source.unverifiedFields.length > 0 && <div className="anamnes-therapist-attention"><h4>Uppgifter som ännu inte verifierats</h4><ul>{source.unverifiedFields.map((field, index) => <li key={index}>{field}</li>)}</ul></div>}
  </section>;
}

function answerLabel(answers: AnswerMap, id: QuestionId): string {
  if (!Object.hasOwn(answers, id)) return "Inte besvarad";
  return questionById.get(id)?.options.find(option => option.value === answers[id])?.label ?? "Svar behöver granskas";
}

function QuestionList({ ids, answers }: { ids: QuestionId[]; answers: AnswerMap }) {
  return <ul className="anamnes-therapist-question-list">{ids.map(id => <li key={id}><span>{questionById.get(id)?.prompt ?? id}</span><strong>{answerLabel(answers, id)}</strong></li>)}</ul>;
}

function Hypothesis({ finding, primary }: { finding: PatternFinding; primary: boolean }) {
  return <article className="anamnes-therapist-hypothesis">
    <p className="anamnes-therapist-kicker">{primary ? "Preliminär huvudhypotes i modellen" : "Alternativ eller samtidig hypotes"}</p>
    <h4>{finding.name}</h4><p className="muted">{finding.pinyin} · <span lang="zh">{finding.hanzi}</span></p>
    <div className="anamnes-therapist-evidence">
      <div><h5>Talar för</h5>{finding.supporting.length ? <ul>{finding.supporting.map((item, index) => <li key={`${item.questionId}-${index}`}>{item.label}</li>)}</ul> : <p className="muted">Inga bekräftade stödjande svar.</p>}</div>
      <div><h5>Talar emot</h5>{finding.opposing.length ? <ul>{finding.opposing.map((item, index) => <li key={`${item.questionId}-${index}`}>{item.label}</li>)}</ul> : <p className="muted">Inga registrerade motfynd. Det bekräftar inte hypotesen.</p>}</div>
    </div>
  </article>;
}

/** A reading view of the saved case; own text never becomes a scored finding. */
export function AnamnesTherapistOverview({ report, answers, narrative = "", medicationNames = "", consultation = emptyConsultationDetails(), catalogStock }: OverviewProps) {
  const rows = consultationDetailRows(consultation);
  const row = (key: keyof ConsultationDetails) => rows.find(item => item.key === key);
  const complaintRows = ["locations", "intensity", "frequency", "dailyImpact"] as const;
  const historyRows = ["previousCare", "lifestyle"] as const;
  const safetyRows = ["medicationDetails", "conditionDetails", "allergyDetails"] as const;
  const symptomAnswers = explainAnamnesReport(report, answers).observations;
  const safetyTitles: Record<Report["safety"]["level"], string> = {
    emergency: "Akuta varningsuppgifter – följ hänvisningen",
    medical_review: "Medicinsk bedömning behöver prioriteras",
    consultation: "Individuell säkerhetsbedömning krävs",
    incomplete: "Säkerhetsuppgifter behöver kompletteras",
    clear: "Inga automatiska säkerhetsspärrar har utlösts",
  };
  const hypotheses = report.safety.level === "emergency" || report.analysis.status === "insufficient" ? [] : report.analysis.primary ? [report.analysis.primary, ...report.analysis.secondary] : report.analysis.patterns.filter(pattern => pattern.qualified).slice(0, 3);
  const unknownIds = [...questionById.keys()].filter(id => answers[id] === "unknown" || answers[id] === "prefer_not");
  const missingIds = [...new Set([...report.safety.missingQuestionIds, ...report.analysis.missingQuestionIds, ...report.followUpQuestionIds, ...hypotheses.flatMap(finding => finding.missingQuestionIds)])].filter(id => !Object.hasOwn(answers, id));
  const allContradictions = [...new Set(report.analysis.conflicts)];
  const safetyDetailNeedsClarification = !!consultation.medicationDetails && answers.medication !== "yes" || !!consultation.conditionDetails && answers.chronicDisease !== "yes" && answers.liverKidney !== "yes" || !!consultation.allergyDetails && answers.allergy !== "yes";
  return <section className="panel anamnes-therapist-overview" aria-labelledby="anamnes-therapist-overview-title">
    <div className="anamnes-admin-status"><h2 id="anamnes-therapist-overview-title">Inför konsultationen</h2><span className="badge">Besökarens uppgifter</span></div>
    <p className="muted">Fritext och kompletteringar är besökarens egna uppgifter. De är inte verifierade fynd och har inte poängsatts som symtom.</p>
    <div className="anamnes-therapist-grid">
      <article className="anamnes-therapist-card"><h3>Sökorsak och besvär</h3>
        {narrative.trim() ? <p className="anamnes-admin-reading">{narrative}</p> : <p className="muted">Ingen egen beskrivning lämnad.</p>}
        <dl className="anamnes-therapist-facts"><div><dt>Huvudområde</dt><dd>{answerLabel(answers, "focus")}</dd></div>{complaintRows.map(key => { const item = row(key); return item ? <div key={key}><dt>{item.label}</dt><dd>{item.value}</dd></div> : null; })}</dl>
        {symptomAnswers.length > 0 && <details className="anamnes-therapist-details"><summary>Utvalda symtom- och vardagssvar ({symptomAnswers.length})</summary><QuestionList ids={symptomAnswers.map(item => item.questionId)} answers={answers} /></details>}
      </article>
      <article className="anamnes-therapist-card"><h3>Förlopp och bakgrund</h3>
        <dl className="anamnes-therapist-facts">{([['duration', 'Varaktighet'], ['onset', 'Debut'], ['trend', 'Förlopp']] as const).map(([id, label]) => <div key={id}><dt>{label}</dt><dd>{answerLabel(answers, id)}</dd></div>)}{historyRows.map(key => { const item = row(key); return item ? <div key={key}><dt>{item.label}</dt><dd>{item.value}</dd></div> : null; })}</dl>
        <h4>Besökarens mål</h4><p className="anamnes-admin-reading">{consultation.goal || "Inget mål angivet – fråga vad besökaren vill ha hjälp med."}</p>
      </article>
      <article className={`anamnes-therapist-card anamnes-therapist-safety${report.safety.level === "emergency" || report.safety.level === "medical_review" ? " is-alert" : ""}`}>
        <h3>Säkerhet och läkemedel</h3><strong>{safetyTitles[report.safety.level]}</strong>
        {report.safety.flags.length > 0 && <ul>{report.safety.flags.map(flag => <li key={flag}>{flag}</li>)}</ul>}
        <dl className="anamnes-therapist-facts"><div><dt>Läkemedel eller kosttillskott</dt><dd>{answerLabel(answers, "medication")}{medicationNames.trim() && <p className="anamnes-admin-reading">{medicationNames}</p>}</dd></div>{safetyRows.map(key => { const item = row(key); return item ? <div key={key}><dt>{item.label} · egna uppgifter</dt><dd>{item.value}</dd></div> : null; })}</dl>
        {safetyDetailNeedsClarification && <p className="anamnes-therapist-attention">Fritext om läkemedel, sjukdom eller allergi finns utan ett motsvarande ja-svar. Klarlägg skillnaden; ett nej eller osäkert svar upphäver inte fritexten.</p>}
        {report.safety.blocksFormulas && <p><strong>Automatisk formeljämförelse är spärrad.</strong> Säkerhetsuppgifterna behöver bedömas individuellt.</p>}
        {report.safety.level !== "emergency" && (report.formulaExclusions?.length ?? 0) > 0 && <details className="anamnes-therapist-details"><summary>Formelreferenser som uteslutits i säkerhetskontrollen</summary><ul>{report.formulaExclusions.map(exclusion => <li key={exclusion.formulaId}><strong>{exclusion.name}</strong><ul>{exclusion.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></li>)}</ul><p className="muted">Spärrade referenser är inga användningsförslag. Dokumentera din självständiga bedömning; matchningspoäng upphäver inte kontraindikationer eller saknade säkerhetsuppgifter.</p></details>}
      </article>
      <article className="anamnes-therapist-card"><h3>Att klarlägga i samtalet</h3>
        {allContradictions.length > 0 && <><h4>Motstridiga fynd</h4><ul>{allContradictions.map(value => <li key={value}>{value}</li>)}</ul></>}
        {unknownIds.length > 0 && <details className="anamnes-therapist-details" open={unknownIds.length <= 3}><summary>Osäkra eller avböjda svar ({unknownIds.length})</summary><QuestionList ids={unknownIds} answers={answers} /></details>}
        {missingIds.length > 0 && <details className="anamnes-therapist-details" open={missingIds.length <= 3}><summary>Obesvarade kompletteringsfrågor ({missingIds.length})</summary><QuestionList ids={missingIds} answers={answers} /></details>}
        {!unknownIds.length && !missingIds.length && !allContradictions.length && <p className="muted">Inga ytterligare luckor anges av modellen. Den individuella bedömningen kan kräva fler frågor.</p>}
        <p className="muted">”Vet inte”, avböjda och obesvarade frågor är inte nekande svar. Egna tung- och pulsobservationer dokumenteras i din separata bedömning.</p>
      </article>
    </div>
    <section className="anamnes-therapist-differential" aria-labelledby="anamnes-therapist-differential-title"><h3 id="anamnes-therapist-differential-title">Maskinens preliminära differentiering</h3>
      <p className="muted">Förslag att pröva vid konsultation. Detta är inte din självständiga bedömning; modellens interna poäng är inte sannolikheter.</p>
      {hypotheses.length ? <div className="anamnes-therapist-hypotheses">{hypotheses.map(finding => <Hypothesis key={finding.id} finding={finding} primary={report.analysis.primary?.id === finding.id} />)}</div> : <p className="notice">{report.safety.level === "emergency" ? "Prioritera de akuta varningsuppgifterna. Ingen mönsterhypotes visas här." : "Ingen tillräckligt tydlig huvudförklaring har valts i den sparade rapporten. Fullständiga regeljämförelser finns i granskningsunderlaget."}</p>}
      {!report.safety.blocksFormulas && report.formulaReferencesEnabled && <div className="anamnes-therapist-formulas"><h4>Formelreferenser att utvärdera</h4>{report.formulaStatus === "matched" && report.formulaMatches.length ? <ul>{report.formulaMatches.slice(0, 3).map(formula => <li key={formula.formulaId}><strong>{formula.name}</strong>{(formula.classicalName || formula.pinyin) && <span> · {formula.classicalName || formula.pinyin}</span>}{formula.partial && <span> · Delvis överensstämmelse</span>}{formula.limitation && <p>{formula.limitation}</p>}{formula.requiresVerification && <p className="anamnes-therapist-attention">Produktuppgifter behöver verifieras. Kontrollera leverantörens kontrollpunkter i formelkatalogen.</p>}<details><summary>Matchningsmotivering och säkerhet</summary><p>{formula.explanation}</p><h5>Talar för</h5>{formula.supporting.length ? <ul>{formula.supporting.map((item, index) => <li key={index}>{item.label}</li>)}</ul> : <p>Inga bekräftade stödjande svar.</p>}<h5>Talar emot</h5>{formula.opposing.length ? <ul>{formula.opposing.map((item, index) => <li key={index}>{item.label}</li>)}</ul> : <p>Inga registrerade motfynd. Det bekräftar inte referensens lämplighet.</p>}{formula.missingQuestionIds.length > 0 && <><h5>Saknade uppgifter</h5><QuestionList ids={formula.missingQuestionIds} answers={answers} /></>}<h5>Försiktighet</h5><ul>{formula.safetyNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></details></li>)}</ul> : <p>{report.formulaStatus === "no_match" ? "Ingen aktiv formel passar tillräckligt väl till underlaget." : "Underlaget räcker inte till en formeljämförelse."}</p>}<p className="muted">Klassiska referenser, ingen ordination. Faktiskt innehåll, interaktioner och individuell lämplighet behöver kontrolleras.</p></div>}
      {catalogStock && <AnamnesCatalogStockList stock={catalogStock} formulaNames={Object.fromEntries(report.formulaMatches.map(formula => [formula.formulaId, formula.name]))} />}
    </section>
  </section>;
}
