import { questionById } from "@/lib/anamnes/questions";
import type { AnswerMap, ConsultationDetails, Evidence, PatternFinding, QuestionId, Report } from "@/lib/anamnes/types";
import { consultationDetailRows, hasAiConsultationDetails } from "@/lib/anamnes/consultation";
import { explainAnamnesReport } from "@/lib/anamnes/report-explanation";
import { canAnalyzePatterns, medicationReviewNotice } from "@/lib/anamnes/engine";
import styles from "./tcm-anamnes.module.css";

function EvidenceList({ evidence, empty }: { evidence: Evidence[]; empty: string }) {
  return evidence.length ? <ul className={styles.evidenceList}>{evidence.map((item, index) => <li key={`${item.questionId}-${index}`}>{item.label}</li>)}</ul> : <p className={styles.emptyEvidence}>{empty}</p>;
}

function MissingQuestions({ ids }: { ids: QuestionId[] }) {
  return ids.length ? <ul className={styles.evidenceList}>{ids.map(id => <li key={id}>{questionById.get(id)?.prompt ?? "En kompletterande observation behövs."}</li>)}</ul> : <p className={styles.emptyEvidence}>Inga ytterligare uppgifter anges i den här regelmodellens kontroll. En individuell bedömning kan ändå kräva fler frågor.</p>;
}

function PatternCard({ finding, label }: { finding: PatternFinding; label: string }) {
  return <article className={styles.patternCard}>
    <p className={styles.matchLabel}>{label}</p><h4>{finding.name}</h4>
    <p className={styles.patternLanguage}>{finding.pinyin} <span lang="zh">{finding.hanzi}</span></p><p>{finding.explanation}</p>
    <div className={styles.evidenceGrid}>
      <div><h5>Fynd som talar för</h5><EvidenceList evidence={finding.supporting} empty="Inga tydliga stödjande fynd i svaren." /></div>
      <div><h5>Fynd som talar emot</h5><EvidenceList evidence={finding.opposing} empty="Inga motstridiga fynd fångades av dessa frågor. Det utesluter inte andra förklaringar." /></div>
    </div>
    {finding.missingQuestionIds.length > 0 && <details className={styles.reportDetails}><summary>Uppgifter som saknas</summary><MissingQuestions ids={finding.missingQuestionIds} /></details>}
  </article>;
}

export function AnamnesReport({ report, answers, medicationNames = "", consultation, showAnswers = true }: { report: Report; answers: AnswerMap; medicationNames?: string; consultation?: ConsultationDetails; showAnswers?: boolean }) {
  const { analysis, safety } = report;
  const candidates = analysis.status === "insufficient" ? [] : analysis.primary ? [analysis.primary, ...analysis.secondary] : analysis.patterns.filter(pattern => pattern.qualified).slice(0, 3);
  const blocked = safety.blocksFormulas;
  const medicationReview=safety.level === "medication_review";
  const noMatch = report.formulaStatus === "no_match";
  const explanation = explainAnamnesReport(report, answers);
  const visibleMatches = !blocked && report.formulaReferencesEnabled ? report.formulaMatches.slice(0, 3) : [];
  const generalFormulaNotes = new Set([
    medicationReviewNotice,
    "Produktens exakta innehåll och säkerhetsuppgifter är ännu inte verifierade. Namnet är en klassisk referens, inte en tillgänglig eller godkänd produkt.",
    "Det faktiska innehållet, medicinska risker och lämpligheten måste bedömas individuellt före eventuell användning.",
  ]);
  const specificFormulaNotes = visibleMatches.flatMap(match => match.safetyNotes.filter(note => !generalFormulaNotes.has(note)).map(note => ({ formula: match.name, note })));
  return <div className={styles.report}>
    {safety.level !== "clear" && <div className={safety.level === 'medication_review' ? styles.notice : safety.level === "emergency" || safety.level === "medical_review" ? styles.alert : styles.warning}>
      <strong>{safety.level === "emergency" ? "Avbryt och sök akut hjälp" : safety.level === "medical_review" ? "Medicinsk bedömning behöver prioriteras" : safety.level === "incomplete" ? "Säkerhetsunderlaget är ofullständigt" : safety.level === 'medication_review' ? 'Läkemedel inför konsultationen' : "Individuell säkerhetsbedömning behövs"}</strong>
      {safety.flags.length > 0 && <ul className={styles.evidenceList}>{safety.flags.map(flag => <li key={flag}>{flag}</li>)}</ul>}
      {safety.missingQuestionIds.length > 0 && <p>Obesvarade eller osäkra säkerhetsuppgifter kan inte räknas som nekande svar.</p>}
      {blocked && safety.level !== 'medication_review' && <p>Ingen formulamatchning visas för de här svaren. Ta med uppgifterna till en individuell bedömning.</p>}
      {safety.level === "emergency" && <p>Ring 112 vid ett akut nödläge.</p>}
    </div>}

    {safety.level !== "emergency" && <>
      {canAnalyzePatterns(safety) && <section className={styles.directionCard} aria-labelledby="anamnes-direction-title">
        <h3 id="anamnes-direction-title">{explanation.direction.heading}</h3>
        {explanation.direction.status !== "preliminary" && <p>{explanation.direction.body}</p>}
        {explanation.direction.references.length > 0 ? <h4>{explanation.direction.references.length === 1 ? "Örtformel att utvärdera" : "Örtformler att utvärdera"}</h4> : <p>{explanation.direction.formulaMessage}</p>}
        {explanation.direction.references.length > 0 && <ul className={styles.directionReferences}>{explanation.direction.references.map((reference, index) => { const match = visibleMatches.find(item => item.name === reference.name); const classicalName = match?.classicalName || match?.pinyin; return <li key={`${reference.name}-${index}`}><strong>{reference.name}</strong>{classicalName && classicalName !== reference.name && <span>Klassisk formel: {classicalName}</span>}{reference.partial && <span>Delvis överensstämmelse · täcker inte hela symtombilden</span>}{match?.referenceKind === 'special_order' && <><span>Specialbeställningsreferens · produkt och lämplighet behöver kontrolleras</span><a className={styles.productInfo} href="/boka">Fråga om specialbeställning · boka rådgivning</a></>}</li>; })}</ul>}
        {explanation.direction.references.length > 0 && explanation.direction.status === 'uncertain' && <p>{explanation.direction.formulaMessage}</p>}
        {visibleMatches.length > 0 && <div className={styles.reportDetailsSafety}>
          {!medicationReview && visibleMatches.some(match => !match.productAvailable || match.requiresVerification) && <p>Klassiska formelreferenser. En verifierad leverantörsprodukt är ännu inte kopplad till alla referenser.</p>}
          {!explanation.direction.references.length && visibleMatches.some(match => match.partial) && <p>Formeljämförelserna är delvisa och täcker inte hela symtombilden.</p>}
          {specificFormulaNotes.length > 0 && <ul className={styles.evidenceList}>{specificFormulaNotes.map(({ formula, note }, index) => <li key={`${formula}-${index}`}><strong>{formula}:</strong> {note}</li>)}</ul>}
        </div>}
        <p className={styles.therapistNotice}>{explanation.direction.evaluationNotice}</p>
      </section>}
      {!blocked && report.formulaReferencesEnabled && (report.formulaExclusions?.length ?? 0) > 0 && <details className={`${styles.reportDetails} ${styles.reportDetailsPanel}`}><summary>Formelreferenser som inte kunde tas med</summary><p>De här referenserna har uteslutits av säkerhetskontrollen eller behöver ytterligare uppgifter. De är inte förslag att använda eller köpa.</p><ul className={styles.evidenceList}>{report.formulaExclusions.map(exclusion => <li key={exclusion.formulaId}><strong>{exclusion.name}</strong><ul>{exclusion.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></li>)}</ul><p className={styles.smallNote}>Ta upp säkerhetsuppgifterna vid personlig rådgivning. Ett högt matchningsvärde kan inte upphäva en spärr.</p></details>}
      <details className={`${styles.reportDetails} ${styles.reportDetailsPanel}`}>
        <summary>Så har svaren bedömts</summary>
        <div className={styles.reportDetailsContent}>
          <div className={styles.reportMethod}><span>{report.source === "ai" ? "AI-assisterad analys med regelkontroll" : "Regelbaserad analys"}</span></div>
      <section className={styles.reportSection} aria-labelledby="anamnes-overview-title">
        <h3 id="anamnes-overview-title">Sammanfattning av dina svar</h3>
        <p>Du har lämnat {explanation.coverage.answered} svar. Här sammanfattas det du själv har uppgett; det är inte en fastställd förklaring till besvären.</p>
        {report.source === 'ai' && consultation && hasAiConsultationDetails(consultation) && <p>Din berättelse och dina kompletteringar har ingått i AI-underlaget. Egna texter räknas inte automatiskt som bekräftade formulärsvar.</p>}
        {explanation.overview.length > 0 && <ul className={styles.overviewList}>{explanation.overview.map(line => <li key={line}>{line}</li>)}</ul>}
        {explanation.observations.length > 0 && <dl className={styles.observationList}>{explanation.observations.map(item => <div key={item.questionId}><dt>{item.prompt}</dt><dd>{item.answer}</dd></div>)}</dl>}
        {explanation.limitations.length > 0 && <div className={styles.notice}><strong>Vad går att säga utifrån svaren?</strong><ul className={styles.evidenceList}>{explanation.limitations.map(line => <li key={line}>{line}</li>)}</ul></div>}
        <h4 className={styles.nextStepsTitle}>Så går du vidare</h4><ul className={styles.evidenceList}>{explanation.nextSteps.map(line => <li key={line}>{line}</li>)}</ul>
        {explanation.comparison && <details className={styles.reportDetails}><summary>Hur svaren har jämförts</summary><p>Det här visar delar av flera regeljämförelser som inte gav ett tydligt mönster. Fynden hör inte nödvändigtvis till samma förklaring och ska inte läsas som en diagnos.</p>
          {explanation.comparison.supporting.length > 0 && <><h5>Svar som gav stöd i någon jämförelse</h5><ul className={styles.evidenceList}>{explanation.comparison.supporting.map(line => <li key={line}>{line}</li>)}</ul></>}
          {explanation.comparison.opposing.length > 0 && <><h5>Svar som talade emot någon jämförelse</h5><ul className={styles.evidenceList}>{explanation.comparison.opposing.map(line => <li key={line}>{line}</li>)}</ul></>}
          {explanation.comparison.unmetCriteria.length > 0 && <><h5>Villkor som inte kunde bekräftas</h5><ul className={styles.evidenceList}>{explanation.comparison.unmetCriteria.map(item => <li key={item.questionId}>{item.prompt} <strong>{item.answer}.</strong> {item.status === "different_answer" ? "Det angivna svaret uppfyller inte ett obligatoriskt villkor i en av jämförelserna." : item.status === "not_asked" ? "Den här uppgiften har inte efterfrågats eller besvarats ännu." : "Uppgiften är osäker eller utelämnad och räknas inte som ett bekräftat fynd."}</li>)}</ul></>}
          {explanation.comparison.unmetComponents.length > 0 && <><h5>Delkomponenter som saknar stöd</h5><ul className={styles.evidenceList}>{explanation.comparison.unmetComponents.map((component, index) => <li key={index}>Minst ett av alternativen behöver bekräftas:<ul>{component.alternatives.map(item => <li key={item.questionId}>{item.prompt} <strong>{item.answer}.</strong><br /><span>I jämförelsen räknas: {item.expectedAnswers.join(" eller ")}.</span></li>)}</ul></li>)}</ul></>}
        </details>}
      </section>
      <section className={styles.reportSection} aria-labelledby="anamnes-pattern-title">
        <h3 id="anamnes-pattern-title">TCM-mönster att undersöka</h3>
        {analysis.status === "insufficient" && <p className={styles.notice}>Underlaget räcker inte för en tydlig mönsterhypotes. Systemet väljer därför ingen huvudförklaring och försöker inte fylla luckorna med en produktmatchning.</p>}
        {analysis.status === "conflicting" && <div className={styles.warning}><strong>Svaren behöver differentieras vidare.</strong><p>Det finns överlappande eller motstridiga fynd. Ingen säker huvudförklaring kan väljas utifrån dessa svar.</p></div>}
        {analysis.conflicts.length > 0 && <ul className={styles.evidenceList}>{analysis.conflicts.map(conflict => <li key={conflict}>{conflict}</li>)}</ul>}
        <div className={styles.patternStack}>{candidates.map((finding, index) => <PatternCard key={finding.id} finding={finding} label={analysis.primary && index === 0 ? "Primär mönsterhypotes" : "Alternativ eller samtidig mönsterhypotes"} />)}</div>
        {analysis.missingQuestionIds.length > 0 && <details className={styles.reportDetails}><summary>Kompletterande uppgifter att ta upp i samtalet</summary><MissingQuestions ids={analysis.missingQuestionIds} /></details>}
      </section>

      <section className={styles.reportSection} aria-labelledby="anamnes-bagang-title"><h3 id="anamnes-bagang-title">De åtta principerna · Ba Gang</h3>
        <div className={styles.dimensionGrid}>{([
          ["Yin / Yang", analysis.baGang.yinYang], ["Inre / Yttre", analysis.baGang.interiorExterior], ["Kyla / Hetta", analysis.baGang.coldHeat], ["Brist / Överskott", analysis.baGang.deficiencyExcess],
        ] as const).map(([label, dimension]) => <div key={label}><h4>{label}</h4><p>{dimension.value}</p>{(dimension.supporting.length > 0 || dimension.opposing.length > 0) && <details className={styles.reportDetails}><summary>Se underlaget</summary><EvidenceList evidence={[...dimension.supporting, ...dimension.opposing]} empty="Underlag saknas." /></details>}</div>)}</div>
      </section>

      <section className={styles.reportSection} aria-labelledby="anamnes-zangfu-title"><h3 id="anamnes-zangfu-title">Samspel enligt Zang-Fu</h3>
        {analysis.zangFu.length > 0 ? <ul className={styles.evidenceList}>{analysis.zangFu.map(text => <li key={text}>{text}</li>)}</ul> : <p>Otillräckligt underlag för att beskriva ett samspel mellan systemen.</p>}
        <p className={styles.smallNote}>Begreppen hör till TCM:s traditionella modell och beskriver inte medicinskt fastställd organpåverkan.</p>
      </section>

      <section className={styles.reportSection} aria-labelledby="anamnes-formulas-title"><h3 id="anamnes-formulas-title">Formelreferenser inför konsultation</h3>
        <p>Mönsteranalysen görs först. Därefter jämförs fynden med verksamhetens aktiva formelkatalog. En klassisk referens innebär inte att en leverantörsprodukt har samma innehåll eller passar dig.</p>
        {report.formulaStatus === "safety_blocked" && <p className={styles.warning}>{safety.level === 'medication_review' ? 'Ett eventuellt örtval bedöms vid konsultationen efter kontroll av dina läkemedel och kosttillskott.' : 'Säker formulamatchning kan inte göras utifrån uppgifterna. Inga formelreferenser visas.'}</p>}
        {report.formulaStatus === "insufficient" && <p className={styles.notice}>Underlaget är för begränsat eller motsägelsefullt för att jämföra formler på ett meningsfullt sätt.</p>}
        {report.formulaStatus === "disabled" && <p className={styles.notice}>Formelreferenser visas inte i den här rapporten.</p>}
        {noMatch && <p className={styles.notice}><strong>Ingen av de aktiva formlerna i sortimentet passar tillräckligt väl.</strong> Resultatet ska därför bedömas vidare i en konsultation i stället för att anpassas till en tillgänglig produkt.</p>}
        {!blocked && report.formulaReferencesEnabled && <div className={styles.patternStack}>{report.formulaMatches.slice(0, 3).map((match, index) => <article className={styles.patternCard} key={match.formulaId}>
          <p className={styles.matchLabel}>Referens {index + 1} · {match.referenceKind === 'special_order' ? 'Specialbeställning via rådgivning' : 'Ordinarie sortiment'} · {match.partial ? "Delvis överensstämmelse" : "Mönsteröverensstämmelse inom modellen"}</p>
          <h4>{match.name}</h4><p className={styles.patternLanguage}>{(match.classicalName || match.pinyin) && <span>Klassisk formel: {match.classicalName || match.pinyin}</span>}{match.hanzi && <> · <span lang="zh">{match.hanzi}</span></>}{match.swedishName && ` · ${match.swedishName}`}</p><p>{match.explanation}</p>
          <div className={styles.evidenceGrid}><div><h5>Fynd som talar för</h5><EvidenceList evidence={match.supporting} empty="Inga tillräckligt specifika stödjande fynd." /></div><div><h5>Fynd som talar emot</h5><EvidenceList evidence={match.opposing} empty="Inga motstridiga fynd har fångats av frågorna. Det är ingen bekräftelse på att formeln är lämplig." /></div></div>
          {match.partial && <p className={styles.warning}><strong>Formeln täcker inte hela symtombilden.</strong> {match.limitation}</p>}
          {!match.partial && match.limitation && <p className={styles.smallNote}>{match.limitation}</p>}
          {match.missingQuestionIds.length > 0 && <details className={styles.reportDetails}><summary>Viktiga uppgifter som behöver kompletteras</summary><MissingQuestions ids={match.missingQuestionIds} /></details>}
          <div className={styles.safetyBox}><h5>Säkerhet att bedöma vid konsultation</h5><ul className={styles.evidenceList}>{match.safetyNotes.map((note, i) => <li key={i}>{note}</li>)}</ul></div>
          {match.requiresVerification && <div className={styles.warning}><strong>Produktuppgifter behöver verifieras.</strong><p>Referensen visas inför personlig rådgivning. Den innebär inte att produkten är tillgänglig eller lämplig för dig.</p>{match.verificationNotes.length > 0 && <ul className={styles.evidenceList}>{match.verificationNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>}</div>}
          <p className={styles.productStatus}>{medicationReview ? 'Formelreferens för terapeutens bedömning. Kombinationen med dina läkemedel är inte utvärderad; interaktioner och kontraindikationer måste kontrolleras före användning.' : match.referenceKind === 'special_order' ? 'Dokumentreferens för eventuell specialbeställning. Faktisk produkt, tillgång och säkerhet behöver bekräftas individuellt.' : match.productAvailable && !match.requiresVerification ? "Produktuppgifter har verifierats i verksamhetens katalog. Användning behöver fortfarande bedömas individuellt." : "Klassisk referens · En tillgänglig, verifierad leverantörsprodukt är ännu inte kopplad till referensen."}</p>
          {match.referenceKind === 'special_order' && <a className={styles.productInfo} href="/boka">Fråga om specialbeställning · boka rådgivning</a>}
          {!medicationReview && match.referenceKind !== 'special_order' && match.productAvailable && !match.requiresVerification && match.productUrl && /^\/butik\/[a-z0-9-]+$/.test(match.productUrl) && <a className={styles.productInfo} href={match.productUrl}>Läs verifierad produktinformation</a>}
        </article>)}</div>}
      </section>
        </div>
      </details>
    </>}
    {showAnswers && <AnamnesAnswers answers={answers} medicationNames={medicationNames} consultation={consultation} />}
  </div>;
}

export function AnamnesAnswers({ answers, expanded = false, medicationNames = "", consultation }: { answers: AnswerMap; expanded?: boolean; medicationNames?: string; consultation?: ConsultationDetails }) {
  const rows = [...questionById.values()].filter(question => Object.hasOwn(answers, question.id));
  const ownRows = consultation ? consultationDetailRows(consultation).filter(row => !row.key.startsWith("questionNotes.") || !Object.hasOwn(answers, row.key.slice("questionNotes.".length))) : [];
  return <details className={styles.answersDetails} open={expanded}><summary>Alla lämnade svar ({rows.length})</summary><dl className={styles.answerList}>{rows.map(question => <div key={question.id}><dt>{question.prompt}</dt><dd>{question.options.find(option => option.value === answers[question.id])?.label ?? "Svar behöver granskas"}{question.id === "medication" && medicationNames.trim() && <p className={styles.narrativeText}>Angivna läkemedel eller kosttillskott (egna uppgifter): {medicationNames}</p>}{question.id !== "pulse" && consultation?.questionNotes[question.id] && <p className={styles.narrativeText}><strong>Egen komplettering:</strong> {consultation.questionNotes[question.id]}</p>}</dd></div>)}</dl>{ownRows.length > 0 && <section className={styles.reportSection}><h4>Egna kompletteringar</h4><p className={styles.smallNote}>Besökarens egna uppgifter. Bekräftade tolkningar ingår också i formulärsvaren; övrig fritext ger inga poäng.</p><dl className={styles.answerList}>{ownRows.map(row => <div key={row.key}><dt>{row.label}</dt><dd className={styles.narrativeText}>{row.value}</dd></div>)}</dl></section>}</details>;
}

export function AnamnesNarrative({ narrative }: { narrative: string }) {
  return narrative ? <section className={styles.reportSection}><h3>Din egen beskrivning</h3><p className={styles.narrativeText}>{narrative}</p><p className={styles.smallNote}>Besökarens egna ord. Texten är inte en bekräftad diagnos och fyller inte automatiskt i formulärsvar.</p></section> : null;
}
