import { questionById } from "@/lib/anamnes/questions";
import { consultationDetailRows } from "@/lib/anamnes/consultation";
import { explainAnamnesReport } from "@/lib/anamnes/report-explanation";
import { emptyConsultationDetails, type AnswerMap, type ConsultationDetails, type PatternFinding, type QuestionId, type Report } from "@/lib/anamnes/types";

type OverviewProps = {
  report: Report;
  answers: AnswerMap;
  narrative?: string;
  medicationNames?: string;
  consultation?: ConsultationDetails;
};

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
export function AnamnesTherapistOverview({ report, answers, narrative = "", medicationNames = "", consultation = emptyConsultationDetails() }: OverviewProps) {
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
      {!report.safety.blocksFormulas && report.formulaReferencesEnabled && <div className="anamnes-therapist-formulas"><h4>Formelreferenser att utvärdera</h4>{report.formulaStatus === "matched" && report.formulaMatches.length ? <ul>{report.formulaMatches.slice(0, 3).map(formula => <li key={formula.formulaId}><strong>{formula.name}</strong>{formula.partial && <span> · Delvis överensstämmelse</span>}{formula.limitation && <p>{formula.limitation}</p>}</li>)}</ul> : <p>{report.formulaStatus === "no_match" ? "Ingen aktiv formel passar tillräckligt väl till underlaget." : "Underlaget räcker inte till en formeljämförelse."}</p>}<p className="muted">Klassiska referenser, ingen ordination. Faktiskt innehåll, interaktioner och individuell lämplighet behöver kontrolleras.</p></div>}
    </section>
  </section>;
}
