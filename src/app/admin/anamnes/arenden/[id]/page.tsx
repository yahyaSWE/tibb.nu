import { PatternAssessment } from '@/components/anamnes/pattern-assessment';
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAnamnesConfigStatus } from "@/lib/anamnes/config";
import { getAnamnesCase, therapistAccess, type StoredAnamnesCase } from "@/lib/anamnes/cases";
import { AdminHeading, dateTime } from "@/components/admin/common";
import { AnamnesAdminNav } from "@/components/admin/anamnes-nav";
import { AnamnesReviewForm, DeleteAnamnesCaseForm } from "@/components/admin/anamnes-review-form";
import { AnamnesReport, AnamnesAnswers } from "@/components/anamnes/report";
import { AnamnesTherapistOverview } from "@/components/admin/anamnes-therapist-overview";
import { questionById } from "@/lib/anamnes/questions";
import { getFormulaCatalog, getFormulaCatalogStock } from "@/lib/anamnes/catalog";
import { labPatternById as patternById } from "@/lib/anamnes/lab/library";

export default async function AnamnesCasePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  if (!therapistAccess(actor)) notFound();
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) notFound();
  if (!getAnamnesConfigStatus().submissions.storageReady) return <><AdminHeading title="Anamnesärende" description="Säker lagring är inte färdigkonfigurerad." /><AnamnesAdminNav current="cases" therapist /><p className="notice">Ingen anamnes öppnas. Kontrollera ANAMNES_STORAGE_KEY i serverns konfiguration.</p></>;
  let item: StoredAnamnesCase | null = null;
  let failed = false;
  try { item = await getAnamnesCase(actor, id); } catch { failed = true; }
  if (failed) return <><AdminHeading title="Anamnesärende" description="Ärendet kunde inte öppnas." /><AnamnesAdminNav current="cases" therapist /><p className="notice notice-error" role="alert">Kontrollera att rätt lagringsnyckel och databas används. Inga underlag eller tekniska feluppgifter visas här.</p></>;
  if (!item) notFound();
  const [formulas, catalogStock] = await Promise.all([getFormulaCatalog(), getFormulaCatalogStock(actor)]);
  const latestReview = item.reviews.at(-1);
  return <>
    <AdminHeading title="Anamnesärende" description={`Inskickad ${dateTime(item.createdAt)}. Åtkomsten upphör ${dateTime(item.expiresAt)}.`} action={<Link href="/admin/anamnes/arenden" className="button button-secondary">Alla aktuella ärenden</Link>} />
    <AnamnesAdminNav current="cases" therapist />
    <p className="notice anamnes-admin-sensitive">Känsliga hälsouppgifter och preliminärt konsultationsstöd. Följ verksamhetens bedömning av dokumentation, sekretess, eventuell journalföring och tillämpliga bevarandekrav.</p>
    <section className="panel"><h2>Besökarens kontaktuppgifter</h2><dl className="anamnes-admin-answer-list"><div><dt>Namn</dt><dd>{item.contact.name}</dd></div><div><dt>E-postadress</dt><dd>{item.contact.email}</dd></div>{item.contact.phone && <div><dt>Telefon</dt><dd>{item.contact.phone}</dd></div>}</dl></section>
    <AnamnesTherapistOverview report={item.report} answers={item.intake.answers} narrative={item.intake.narrative} medicationNames={item.intake.medicationNames} consultation={item.intake.consultation} catalogStock={catalogStock} />
    <section className="panel" style={{ marginTop: 24 }}><h2>Behandlarens självständiga bedömning</h2><AnamnesReviewForm id={item.id} revision={item.revision} formulaOptions={formulas} initialSelection={latestReview} /></section>
    <section className="panel" style={{ marginTop: 24 }}><h2>Fullständiga inskickade svar</h2><AnamnesAnswers answers={item.intake.answers} medicationNames={item.intake.medicationNames} consultation={item.intake.consultation} /></section>
    <details className="panel" style={{ marginTop: 24 }}><summary><strong>Information vid inskickning och rapportens ursprung</strong></summary><p className="muted">Här visas informationen som gällde när det här underlaget skickades. Den aktuella driftkonfigurationen kan ha ändrats sedan dess.</p>
      {item.consent ? <dl className="anamnes-admin-answer-list">
        <div><dt>Separat inskickningsval registrerat</dt><dd>{dateTime(item.consent.recordedAt)}</dd></div>
        <div><dt>Lagringstid enligt informationen vid inskickning</dt><dd>{item.consent.retentionDays} dagar</dd></div>
        <div><dt>Versionsreferens för inskickningsinformationen</dt><dd><code>{item.consent.submissionVersion}</code></dd></div>
        <div><dt>Exakt information om inskickning vid tillfället</dt><dd>{item.consent.submissionNotice}</dd></div>
        {item.consent.aiNotice && <div><dt>AI-information som hör till den sparade rapporten</dt><dd>{item.consent.aiNotice}</dd></div>}
        {item.consent.aiConsentVersion && <div><dt>Versionsreferens för AI-informationen</dt><dd><code>{item.consent.aiConsentVersion}</code></dd></div>}
      </dl> : <p className="muted">Det äldre ärendet saknar sparad detaljhistorik för informationstext och informationsversion.</p>}
      <dl className="anamnes-admin-answer-list">
        <div><dt>Metod för den sparade rapporten</dt><dd>{(item.provenance?.source ?? item.report.source) === "ai" ? "AI-assisterad analys med regelkontroll" : "Regelbaserad analys"}</dd></div>
        {item.provenance?.provider && <div><dt>AI-leverantör vid analysen</dt><dd>{item.provenance.provider}</dd></div>}
        {item.provenance?.model && <div><dt>AI-modell vid analysen</dt><dd>{item.provenance.model}</dd></div>}
        {item.provenance?.analysisReceipt && <div><dt>Analyskvittots giltighet vid inskickning</dt><dd>Serverkontrollerat kvitto, giltigt till {dateTime(item.provenance.analysisReceipt.expiresAt)}. Signaturen visas inte.</dd></div>}
      </dl>
    </details>
    <details className="panel anamnes-admin-audit"><summary>Ursprunglig maskinell rapport</summary><div className="anamnes-admin-audit-content"><p className="muted">Den inskickade rapporten har beräknats på servern utifrån besökarens svar och den då aktuella katalogen. {item.report.source === "ai" ? "Den har kompletterats med AI och kontrollerats mot regelmodellen." : "Den är regelbaserad; en eventuell AI-vy i besökarens webbläsare sparas inte automatiskt."} Behandlarens korrigeringar lagras separat och ändrar inte ursprungsrapporten.</p><AnamnesReport report={item.report} answers={item.intake.answers} medicationNames={item.intake.medicationNames} consultation={item.intake.consultation} showAnswers={false} /></div></details>
    {!item.report.differential && <details className="panel anamnes-admin-audit"><summary>Samtliga mönster i differentieringen</summary><div className="anamnes-admin-audit-content"><p className="muted">Även svagt underbyggda eller motsagda mönster visas för granskning. Modellens interna poäng är inte sannolikheter eller kliniskt validerade säkerhetsmått.</p><div className="anamnes-admin-list">{item.report.analysis.patterns.map(pattern => <details key={pattern.id}><summary><strong>{pattern.name}</strong><span className="badge">{pattern.qualified ? "Underbyggd hypotes" : "Otillräckligt stöd"}</span></summary><p>{pattern.pinyin} · {pattern.hanzi}</p><p>{pattern.explanation}</p><PatternAssessment finding={pattern}/><h4>Stödjande fynd</h4>{pattern.supporting.length ? <ul>{pattern.supporting.map((finding, index) => <li key={`${finding.questionId}-${index}`}>{finding.label}</li>)}</ul> : <p className="muted">Inga stödjande fynd.</p>}<h4>Motsägande fynd</h4>{pattern.opposing.length ? <ul>{pattern.opposing.map((finding, index) => <li key={`${finding.questionId}-${index}`}>{finding.label}</li>)}</ul> : <p className="muted">Inga registrerade motsägelser. Det bevisar inte att mönstret stämmer.</p>}{pattern.missingQuestionIds.length > 0 && <><h4>Uppgifter som saknas</h4><ul>{pattern.missingQuestionIds.map(questionId => <li key={questionId}>{questionById.get(questionId)?.prompt || questionId}</li>)}</ul></>}</details>)}</div></div></details>}
    {item.reviews.length > 0 && <section className="panel" style={{ marginTop: 24 }}><h2>Tidigare behandlaranteckningar</h2><div className="anamnes-admin-review-history">{[...item.reviews].reverse().map(review => <article className="panel" key={review.revision}><h3>Anteckning {review.revision}</h3><p className="muted">{dateTime(review.reviewedAt)} · {review.authorName}</p>{(review.selectedPrimaryPatternId || review.selectedSecondaryPatternIds.length > 0 || review.selectedFormulaId) && <dl className="anamnes-admin-answer-list"><div><dt>Bedömt huvudmönster</dt><dd>{review.selectedPrimaryPatternId ? patternById.get(review.selectedPrimaryPatternId)?.name || review.selectedPrimaryPatternId : "Inget huvudmönster valt"}</dd></div><div><dt>Sekundära mönster</dt><dd>{review.selectedSecondaryPatternIds.length ? review.selectedSecondaryPatternIds.map(id => patternById.get(id)?.name || id).join(" · ") : "Inga sekundära mönster valda"}</dd></div><div><dt>Vald formelreferens</dt><dd>{review.selectedFormulaId ? formulas.find(formula => formula.id === review.selectedFormulaId)?.name || `Tidigare katalogreferens: ${review.selectedFormulaId}` : "Ingen formula vald"}</dd></div></dl>}{([
      ["Formelmotivering och säkerhetsbedömning", review.formulaNotes], ["Egna tungobservationer", review.tongueNotes], ["Egna pulsobservationer", review.pulseNotes], ["Korrigeringar av maskinens analys", review.corrections], ["Övriga noteringar", review.notes], ["Självständig klinisk bedömning", review.finalAssessment],
    ] as const).map(([label, value]) => value ? <div key={label}><h4>{label}</h4><p className="anamnes-admin-reading">{value}</p></div> : null)}</article>)}</div></section>}
    <section className="panel" style={{ marginTop: 24 }}><DeleteAnamnesCaseForm id={item.id} /></section>
  </>;
}
