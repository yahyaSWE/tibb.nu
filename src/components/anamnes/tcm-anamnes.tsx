"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Clipboard, Leaf, LockKeyhole, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { buildReport, getSafetyAssessment, safetyQuestionIds } from "@/lib/anamnes/engine";
import { getInitialQuestions, getFollowupQuestions, questionBank, questionById } from "@/lib/anamnes/questions";
import { FormulaRecordSchema, ReportSchema, InterviewResponseSchema, NarrativeSchema, MedicationNamesSchema, type AnswerMap, type FormulaRecord, type Question, type QuestionId, type Report } from "@/lib/anamnes/types";
import { finalizeInterviewReport, getInterviewCompletionQuestionIds, INTERVIEW_MAX_ROUNDS } from "@/lib/anamnes/interview";
import { formatAnamnesSummary } from "@/lib/anamnes/summary";
import { AnamnesReport } from "./report";
import { SafetyQuestions } from "./safety-questions";
import styles from "./tcm-anamnes.module.css";

const CatalogResponseSchema = z.object({
  analysisMode: z.enum(["rules", "ai"]),
  formulas: z.array(FormulaRecordSchema).max(200),
  ai: z.object({ available: z.boolean(), providerLabel: z.string(), privacyNotice: z.string(), consentVersion: z.string().optional() }),
  submissions: z.object({ available: z.boolean(), retentionDays: z.number().int().min(1).max(90), notice: z.string(), consentVersion: z.string().optional() }),
  referencesEnabled: z.boolean(),
});
type CatalogResponse = z.infer<typeof CatalogResponseSchema>;
const ReceiptSchema = z.object({ expiresAt: z.iso.datetime(), signature: z.string().regex(/^[a-f0-9]{64}$/), aiConsentVersion: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
type AnalysisReceipt = z.infer<typeof ReceiptSchema>;
type Stage = "intro" | "consent" | "safety" | "questions" | "followup" | "interview" | "report";
const initialConfig: CatalogResponse = {
  analysisMode: "rules", formulas: [], referencesEnabled: true,
  ai: { available: false, providerLabel: "AI är avstängd", privacyNotice: "Ingen extern AI används när du väljer regelanalys." },
  submissions: { available: false, retentionDays: 30, notice: "Inskickning till behandlare är inte aktiverad." },
};
async function loadCatalog(signal?: AbortSignal): Promise<CatalogResponse> {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch("/api/anamnes/catalog", { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Katalogen kunde inte hämtas.");
  return CatalogResponseSchema.parse(await response.json());
}

export default function TcmAnamnes() {
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [narrative, setNarrative] = useState("");
  const [medicationNames, setMedicationNames] = useState("");
  const [interviewActive, setInterviewActive] = useState(false);
  const [localInterview, setLocalInterview] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [interviewHistory, setInterviewHistory] = useState<Question[]>([]);
  const [interviewRound, setInterviewRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [followups, setFollowups] = useState<Question[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [receipt, setReceipt] = useState<AnalysisReceipt | null>(null);
  const [config, setConfig] = useState<CatalogResponse>(initialConfig);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [aiConsentVersion, setAiConsentVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [submission, setSubmission] = useState<{ reference: string; expiresAt: string } | null>(null);
  const [sendConsentVersion, setSendConsentVersion] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const firstFocus = useRef(true);
  const activeQuestions = useMemo(() => getInitialQuestions(answers), [answers]);
  const retainedQuestions = useMemo(() => questionBank.filter(question => !question.professionalOnly && Object.hasOwn(answers, question.id) && !activeQuestions.some(active => active.id === question.id)), [activeQuestions, answers]);
  // Safety answers are reviewed together on their own page, including on edits.
  const initialQuestions = useMemo(() => [...activeQuestions, ...retainedQuestions].filter(question => !safetyQuestionIds.includes(question.id)), [activeQuestions, retainedQuestions]);
  const currentQuestions = stage === "interview" ? interviewHistory : stage === "followup" ? followups : initialQuestions;
  const currentQuestion = currentQuestions[Math.min(index, currentQuestions.length - 1)];
  const summary = useMemo(() => report && NarrativeSchema.safeParse(narrative).success && MedicationNamesSchema.safeParse(medicationNames).success ? formatAnamnesSummary(report, answers, narrative.trim(), medicationNames) : "", [report, answers, narrative, medicationNames]);
  const answeredSafetyCount = safetyQuestionIds.filter(id => !!answers[id]).length;
  const progress = stage === "report" ? 100 : stage === "intro" || stage === "consent" ? 0 : stage === "safety" ? Math.round(answeredSafetyCount / safetyQuestionIds.length * 20) : stage === "interview" ? 20 + Math.round(((interviewRound - 1) / INTERVIEW_MAX_ROUNDS) * 70) : stage === "followup" ? 85 + Math.round(index / Math.max(1, currentQuestions.length) * 10) : 20 + Math.round(index / Math.max(1, currentQuestions.length) * 60);
  const aiChoiceAvailable = catalogState === "ready" && config.analysisMode === "ai" && config.ai.available && !!config.ai.consentVersion;
  const completionQuestions = useMemo(() => report ? getInterviewCompletionQuestionIds(answers, report.analysis) : [], [answers, report]);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal).then(value => { setConfig(value); setCatalogState("ready"); }).catch(() => { if (!controller.signal.aborted) setCatalogState("unavailable"); });
    return () => { controller.abort(); request.current?.abort(); sequence.current++; };
  }, []);
  useEffect(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [stage, index]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function clearStatus() { setError(""); setNotice(""); setCopied(false); setSubmission(null); setSendConsentVersion(null); setReceipt(null); }
  function reset() {
    request.current?.abort(); sequence.current++; setBusy(false); setAnswers({}); setNarrative(""); setMedicationNames(""); setInterviewActive(false); setLocalInterview(false); setSessionNotice(""); setInterviewHistory([]); setInterviewRound(0); setReport(null); setFollowups([]); setStage("intro"); setIndex(0); setAiConsentVersion(null); setContact({ name: "", email: "", phone: "" }); clearStatus();
  }
  function updateAnswer(question: Question, value: string) {
    const next = { ...answers, [question.id]: value };
    setAnswers(next); clearStatus();
    if (question.id === "medication" && value !== "yes") setMedicationNames("");
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Beskrivningen innehåller osynliga kontrolltecken eller är för lång. Gå tillbaka och rätta texten."); return; }
    if (getSafetyAssessment(next, narrative.trim()).level === "emergency") {
      request.current?.abort(); sequence.current++; setBusy(false); setReport(buildReport(next, [], { narrative: narrative.trim() })); setStage("report");
    }
  }
  function start() {
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Beskrivningen innehåller osynliga kontrolltecken eller är för lång. Rätta texten innan du fortsätter."); return; }
    if (getSafetyAssessment(answers, narrative.trim()).level === "emergency") { setReport(buildReport(answers, [], { narrative: narrative.trim() })); setStage("report"); clearStatus(); return; }
    const offerAi = aiChoiceAvailable && narrative.trim().length > 0;
    setAiConsentVersion(null); setInterviewActive(false); setLocalInterview(false); setSessionNotice(""); setInterviewHistory([]); setInterviewRound(0); setStage(offerAi ? "consent" : "safety"); setIndex(0); clearStatus();
  }
  function chooseAnalysis(useAi: boolean) {
    if (useAi && !aiChoiceAvailable) { setError("AI är inte tillgänglig just nu. Du kan fortsätta utan AI."); return; }
    // Starting the form or writing a description never grants provider consent.
    setAiConsentVersion(useAi ? config.ai.consentVersion! : null);
    setInterviewActive(useAi); setLocalInterview(false); setIndex(0); setStage("safety"); clearStatus();
  }
  function finishSafety(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!safetyQuestionIds.every(id => questionById.get(id)?.options.some(option => option.value === answers[id]))) { setError("Besvara alla säkerhetsfrågor. Du kan välja ”Vet inte” eller ”Vill inte svara”."); return; }
    const names = MedicationNamesSchema.safeParse(medicationNames);
    if (answers.medication === "yes" && (!names.success || !names.data)) { setError("Ange namnen på dina läkemedel eller kosttillskott. Undvik osynliga kontrolltecken och använd högst 1 000 tecken."); return; }
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Rätta beskrivningens osynliga kontrolltecken eller längd innan du fortsätter."); return; }
    const safety = getSafetyAssessment(answers, narrative.trim());
    if (safety.level === "emergency") { setReport(buildReport(answers, [], { narrative: narrative.trim() })); setStage("report"); clearStatus(); return; }
    clearStatus(); setIndex(0);
    if (interviewActive && !safety.blocksFormulas) {
      if (interviewHistory.length) setStage("interview");
      else void advanceInterview();
    } else {
      if (interviewActive) { setAiConsentVersion(null); setInterviewActive(false); setNotice("Du fortsätter med lokala frågor inför konsultationen. Dina säkerhetsuppgifter behöver individuell bedömning."); }
      setStage("questions");
    }
  }
  function showInterviewStep(nextReport: Report, ids: readonly QuestionId[], complete: boolean, reason: "continue" | "enough" | "limit" | "fallback" | "safety", nextReceipt?: AnalysisReceipt, stopped = false) {
    setReport(nextReport); setReceipt(nextReceipt ?? null);
    if (complete) {
      if (stopped) setNotice("Du har valt att avsluta samtalet. Rapporten sammanfattar svaren hittills och visar vilka uppgifter som fortfarande är osäkra.");
      else if (reason === "limit") setNotice(interviewRound >= INTERVIEW_MAX_ROUNDS ? "Samtalets frågegräns har nåtts. Rapporten visar vad dina svar räcker till och vad som fortfarande är oklart. Du kan välja att komplettera obesvarade frågor nedan." : "Det finns inga fler relevanta följdfrågor i det här flödet. Rapporten sammanfattar svaren och visar vad som behöver bedömas vidare i en konsultation.");
      setStage("report"); return;
    }
    const nextQuestions = ids.map(id => questionById.get(id)).filter((question): question is Question => !!question && !question.professionalOnly && !Object.hasOwn(answers, question.id) && !interviewHistory.some(prior => prior.id === question.id));
    if (!nextQuestions.length) { setReport(finalizeInterviewReport(nextReport, answers)); setReceipt(null); setStage("report"); return; }
    setInterviewHistory(previous => [...previous, ...nextQuestions]); setIndex(interviewHistory.length); setInterviewRound(previous => Math.min(INTERVIEW_MAX_ROUNDS, previous + 1)); setStage("interview");
  }
  function continueLocally(nextReport: Report, finish: boolean) {
    const ids = getInterviewCompletionQuestionIds(answers, nextReport.analysis).slice(0, 3);
    const limit = interviewRound >= INTERVIEW_MAX_ROUNDS;
    const complete = finish || limit || ids.length === 0;
    showInterviewStep(complete ? finalizeInterviewReport(nextReport, answers) : nextReport, ids, complete, limit ? "limit" : complete ? "enough" : "continue", undefined, finish);
  }
  function complementReport() {
    const questions = completionQuestions.map(id => questionById.get(id)).filter((question): question is Question => !!question);
    if (!questions.length) return;
    if (questions.some(question => safetyQuestionIds.includes(question.id))) { setAiConsentVersion(null); setInterviewActive(false); setIndex(0); setStage("safety"); clearStatus(); return; }
    setAiConsentVersion(null); setLocalInterview(true); setInterviewActive(true); setInterviewHistory(questions); setInterviewRound(1); setIndex(0); setStage("interview"); clearStatus();
    setSessionNotice("Du kompletterar underlaget med lokala frågor. Tidigare svar finns kvar. Inga nya svar skickas till AI.");
  }
  async function advanceInterview(finish = false) {
    if (busy) return;
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Rätta beskrivningens osynliga kontrolltecken eller längd innan du fortsätter."); return; }
    const run = ++sequence.current;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setBusy(true); clearStatus();
    try {
      const latest = await loadCatalog(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
      if (run !== sequence.current) return;
      setConfig(latest); setCatalogState("ready");
      const local = buildReport(answers, latest.formulas, { narrative: narrative.trim() });
      if (localInterview) { continueLocally(local, finish); return; }
      if (local.safety.blocksFormulas) {
        if (answers.focus === "pain" && ["unknown", "prefer_not"].includes(answers.jointWarmth ?? "")) { setReport(finalizeInterviewReport(local, answers)); setStage("report"); setNotice("Uppgiften om en röd, varm eller svullen led är osäker. Underlaget sammanfattas för individuell bedömning; inga formelreferenser visas."); }
        else if (!finish && local.safety.level !== "emergency") { setInterviewActive(false); setStage("questions"); setIndex(0); setNotice("Dina uppgifter behöver individuell säkerhetsbedömning. Du kan fortsätta med lokala frågor inför konsultationen. Beskrivningen skickas inte till AI och inga formelreferenser visas."); }
        else { setReport(finalizeInterviewReport(local, answers)); setStage("report"); }
        return;
      }
      if (latest.analysisMode !== "ai" || !latest.ai.available || !aiConsentVersion || aiConsentVersion !== latest.ai.consentVersion) {
        setAiConsentVersion(null); setLocalInterview(true); setSessionNotice("AI-samtalet är inte tillgängligt med det aktuella valet. Du fortsätter med lokala följdfrågor och behåller dina tidigare svar.");
        continueLocally(local, finish);
        return;
      }
      const response = await fetch("/api/anamnes/interview", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), body: JSON.stringify({ answers, narrative: narrative.trim(), aiConsent: true, aiConsentVersion, round: finish ? INTERVIEW_MAX_ROUNDS : interviewRound, formulaReferencesEnabled: true }) });
      if (!response.ok) throw new Error("Samtalet kunde inte fortsätta.");
      const value = InterviewResponseSchema.parse(await response.json());
      if (run !== sequence.current) return;
      if (value.reason === "fallback") {
        setAiConsentVersion(null); setLocalInterview(true); setSessionNotice("AI kunde inte användas. Du fortsätter med lokala följdfrågor och behåller dina tidigare svar. Rapporten bygger på poängmodellen.");
      }
      showInterviewStep(value.report, value.questionIds, value.complete || finish, value.reason, value.receipt, finish);
    } catch {
      if (controller.signal.aborted || run !== sequence.current) return;
      setCatalogState("unavailable"); setAiConsentVersion(null); setLocalInterview(true); setSessionNotice("Anslutningen kunde inte användas. Du kan fortsätta lokalt med dina tidigare svar. Formelreferenser visas först när den aktuella katalogen har kunnat kontrolleras.");
      continueLocally(buildReport(answers, [], { narrative: narrative.trim() }), finish);
    } finally { if (run === sequence.current) { setBusy(false); request.current = null; } }
  }
  async function calculate(final: boolean) {
    if (busy) return;
    const run = ++sequence.current;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setBusy(true); setError(""); setNotice(""); setCopied(false); setSubmission(null); setSendConsentVersion(null); setReceipt(null);
    let activeCatalog: FormulaRecord[] = [];
    let activeConfig = initialConfig;
    let catalogVerified = false;
    try {
      // Refresh before every result; never resurrect disabled formulas from a
      // static seed or old client cache if the current catalog is unavailable.
      try {
        activeConfig = await loadCatalog(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (run !== sequence.current) return;
        activeCatalog = activeConfig.formulas; catalogVerified = true; setConfig(activeConfig); setCatalogState("ready");
      } catch {
        if (controller.signal.aborted || run !== sequence.current) return;
        setCatalogState("unavailable"); setConfig(initialConfig);
        setNotice("Formelkatalogen kunde inte kontrolleras. Du får en mönsteranalys utan formelreferenser. Försök igen senare för att jämföra sortimentet.");
      }
      let result = buildReport(answers, activeCatalog, { narrative: narrative.trim() });
      let nextReceipt: AnalysisReceipt | null = null;
      const mayUseAi = catalogVerified && activeConfig.analysisMode === "ai" && !!aiConsentVersion && activeConfig.ai.available && aiConsentVersion === activeConfig.ai.consentVersion && !result.safety.blocksFormulas;
      if (mayUseAi) {
        try {
          const response = await fetch("/api/anamnes/analyze", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), body: JSON.stringify({ answers, narrative: narrative.trim(), aiConsent: true, aiConsentVersion, formulaReferencesEnabled: true }) });
          if (!response.ok) throw new Error("Analysen kunde inte slutföras.");
          const payload = z.object({ report: ReportSchema, receipt: ReceiptSchema.optional() }).parse(await response.json());
          if (run !== sequence.current) return;
          result = payload.report;
          nextReceipt = result.source === "ai" ? payload.receipt ?? null : null;
          if (result.source !== "ai") setNotice("AI-analysen kunde inte användas. Rapporten bygger på den regelbaserade modellen.");
        } catch {
          if (controller.signal.aborted || run !== sequence.current) return;
          setNotice("AI-analysen är inte tillgänglig just nu. Rapporten bygger på den regelbaserade modellen.");
        }
      } else if (aiConsentVersion && activeConfig.analysisMode === "rules") {
        setAiConsentVersion(null); setNotice("Verksamheten har bytt till poängbaserad anamnes. Ingen ny AI-analys begärdes. Rapporten bygger på poängmodellen.");
      } else if (aiConsentVersion && aiConsentVersion !== activeConfig.ai.consentVersion) {
        setAiConsentVersion(null); setNotice("Informationen om AI-behandlingen har ändrats. Ingen ny AI-analys begärdes. Du kan läsa den aktuella informationen och välja på nytt från inställningarna.");
      }
      if (run !== sequence.current) return;
      if (!final && result.safety.level !== "emergency") {
        const nextQuestions = getFollowupQuestions(answers, result.analysis, result.followUpQuestionIds);
        if (nextQuestions.length > 0) { setReport(result); setFollowups(nextQuestions.slice(0, 5)); setIndex(0); setStage("followup"); return; }
      }
      setReport(result); setReceipt(nextReceipt); setStage("report");
    } catch {
      if (!controller.signal.aborted && run === sequence.current) setError("Rapporten kunde inte färdigställas. Kontrollera dina svar och försök igen.");
    } finally { if (run === sequence.current) { setBusy(false); request.current = null; } }
  }
  function next() {
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Rätta beskrivningens osynliga kontrolltecken eller längd innan du fortsätter."); return; }
    if (getSafetyAssessment(answers, narrative.trim()).level === "emergency") { setReport(buildReport(answers, [], { narrative: narrative.trim() })); setStage("report"); clearStatus(); return; }
    if (!currentQuestion || !answers[currentQuestion.id]) { setError("Välj ett svar. Du kan alltid välja ”Vet inte” eller ”Vill inte svara”."); return; }
    setError("");
    if (index + 1 < currentQuestions.length) { setIndex(index + 1); return; }
    if (interviewActive) {
      void advanceInterview();
      return;
    }
    void calculate(stage === "followup");
  }
  function previous() {
    setError(""); setCopied(false);
    if (index > 0) setIndex(index - 1);
    else if (stage === "interview") { setStage("safety"); setIndex(0); }
    else if (stage === "followup") { setStage("questions"); setIndex(initialQuestions.length - 1); }
    else setStage("safety");
  }
  async function copySummary() {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setError(""); }
    catch { setError("Webbläsaren tillät inte kopiering. Markera och kopiera texten i sammanfattningsfältet i stället."); }
  }
  async function sendToTherapist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submission) return;
    if (!config.submissions.available || !sendConsentVersion || sendConsentVersion !== config.submissions.consentVersion) { setError("Läs informationen och välj uttryckligen att skicka anamnesen till behandlaren."); return; }
    const run = ++sequence.current; const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/anamnes/submit", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), body: JSON.stringify({ answers, narrative: narrative.trim(), medicationNames: answers.medication === "yes" ? medicationNames.trim() : "", formulaReferencesEnabled: true, sendConsent: true, submissionConsentVersion: sendConsentVersion, contact, ...(report?.source === "ai" && receipt ? { report, receipt } : {}) }) });
      if (!response.ok) throw new Error(response.status === 409 ? "Rapportens eller samtyckets giltighet behöver förnyas. Gå igenom svaren och skapa en ny rapport innan du skickar, eller ta med den kopierade sammanfattningen till konsultationen." : "Inskickningen kunde inte bekräftas. Kontrollera informationen och försök igen, eller ta med den kopierade sammanfattningen till konsultationen.");
      const result = z.object({ reference: z.string().uuid(), expiresAt: z.string().datetime() }).parse(await response.json());
      if (run === sequence.current) { setSubmission(result); setSendConsentVersion(null); }
    } catch (failure) { if (run === sequence.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Anamnesen kunde inte skickas."); }
    finally { if (run === sequence.current) { setBusy(false); request.current = null; } }
  }
  function narrativeEditor() {
    return <div className={styles.storyEditor}><label htmlFor="anamnes-story">Berätta med egna ord</label><p id="anamnes-story-help" className={styles.smallNote}>Vad söker du hjälp för, hur påverkas vardagen och vad vill du att behandlaren ska känna till? Undvik personnummer, namn och kontaktuppgifter i beskrivningen.</p><textarea id="anamnes-story" value={narrative} maxLength={4000} rows={6} autoComplete="off" disabled={busy} aria-describedby="anamnes-story-help anamnes-story-count" placeholder="Beskriv dina besvär, när de började och vad du hoppas få hjälp med…" onChange={event => { setNarrative(event.target.value); clearStatus(); }} /><span id="anamnes-story-count" className={styles.smallNote}>{narrative.length} av 4 000 tecken. Delas bara när du går vidare med ditt AI-val eller skickar till behandlaren.</span></div>;
  }

  return <div className={styles.shell}>
    <div className={styles.topbar}><span><Leaf size={18} aria-hidden="true" />Tibb.nu · Strukturerad TCM-anamnes</span><span><LockKeyhole size={14} aria-hidden="true" />Du styr hur svaren används</span></div>
    <div className={styles.body}>
      {stage !== "intro" && stage !== "consent" && report?.safety.level !== "emergency" && <div className={styles.questionProgress}><div><span>{stage === "report" ? "Din rapport" : stage === "safety" ? "Trygghetsfrågor" : stage === "interview" ? localInterview ? "Anpassade frågor · lokalt" : "Anpassat AI-samtal" : stage === "followup" ? "Fördjupande följdfrågor" : "Din anamnes"}</span><span>{stage === "report" ? "Sammanfattning" : stage === "safety" ? `${answeredSafetyCount} av ${safetyQuestionIds.length} besvarade` : stage === "interview" ? `Fråga ${index + 1} · utifrån dina svar` : `${index + 1} av ${currentQuestions.length}`}</span></div><progress max={100} value={progress} aria-label="Anamnesens framsteg" /></div>}
      {stage === "intro" && <section>
        <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>{config.analysisMode === "ai" ? "Börja med din berättelse." : "Dina svar först. Mönster och referenser därefter."}</h2>
        <p className={styles.lead}>{config.analysisMode === "ai" ? "Beskriv varför du söker hjälp. Efter trygghetsfrågorna kan AI välja relevanta frågor och följa upp dina bekräftade svar, tre frågor i taget. Du kan avsluta när du vill; ett ofullständigt underlag markeras tydligt." : "Beskriv hur du mår genom cirka 20–30 anpassade frågor och upp till fem följdfrågor. Mönsteranalysen görs oberoende av örtsortimentet. Därefter jämförs resultatet med verksamhetens aktiva formelkatalog."}</p>
        {config.analysisMode === "ai" && narrativeEditor()}
        <div className={styles.features}><div><span className={styles.featureIcon}><Check size={21} aria-hidden="true" /></span><strong>Frågor efter dina svar</strong><p>Från en bank med {questionBank.filter(question => !question.professionalOnly).length} besökarfrågor.</p></div><div><span className={styles.featureIcon}><LockKeyhole size={21} aria-hidden="true" /></span><strong>Svar först lokalt</strong><p>Inget sparas eller skickas automatiskt.</p></div><div><span className={styles.featureIcon}><ShieldCheck size={21} aria-hidden="true" /></span><strong>Individuell bedömning</strong><p>Formelreferenser inför en konsultation.</p></div></div>
        <div className={styles.notice}><strong>Ett preliminärt samtalsunderlag</strong><p>Modellen är inte kliniskt validerad. Den kan missa viktiga symtom eller förklaringar. Du får ingen diagnos, örtordination, dosering eller rekommendation att köpa en produkt. Sök vård vid nya, tilltagande eller allvarliga besvär.</p></div>
        {catalogState === "unavailable" && <p className={styles.warning}>Den aktuella formelkatalogen kunde inte laddas. Du kan fortsätta med frågorna och få en mönsteranalys; ingen inaktuell katalog används som reserv.</p>}
        <button type="button" className={styles.primary} disabled={catalogState === "loading"} onClick={start}>{catalogState === "loading" ? "Förbereder formuläret…" : "Starta anamnesen"}<ArrowRight size={17} aria-hidden="true" /></button>
      </section>}
      {stage === "consent" && <section aria-labelledby="anamnes-ai-choice">
        <h2 ref={headingRef} tabIndex={-1} id="anamnes-ai-choice" className={styles.heading}>Vill du fortsätta med AI?</h2>
        <p className={styles.lead}>Med ditt samtycke skickas din beskrivning och dina formulärsvar via Tibb.nu till {config.ai.providerLabel} för anpassade frågor och en preliminär analys. Du kan också fortsätta utan AI.</p>
        <details className={styles.reportDetails}><summary>Läs informationen om AI och dina svar</summary><p>{config.ai.privacyNotice}</p><p>Du får upp till tre frågor i taget och kan avsluta när du vill. Att skicka rapporten till en behandlare är ett separat val. Svaren sparas inte automatiskt i webbläsaren eller som ett ärende.</p><Link href="/integritet" className={styles.productInfo} prefetch={false}>Integritetsinformation</Link></details>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => chooseAnalysis(false)}>Fortsätt utan AI</button><button type="button" className={styles.primary} onClick={() => chooseAnalysis(true)}>Jag samtycker – fortsätt med AI<ArrowRight size={17} aria-hidden="true" /></button></div>
        <div className={styles.editActions}><button type="button" onClick={() => { setStage("intro"); clearStatus(); }}><ArrowLeft size={14} aria-hidden="true" />Tillbaka till min beskrivning</button></div>
      </section>}
      {stage === "safety" && <section aria-labelledby="anamnes-safety-title" aria-busy={busy}>
        <h2 ref={headingRef} tabIndex={-1} id="anamnes-safety-title" className={styles.heading}>Innan vi börjar</h2>
        <p className={styles.lead}>Besvara säkerhetsfrågorna här, så fortsätter vi sedan med dina besvär. Du kan välja ”Vet inte” eller ”Vill inte svara”.</p>
        <form onSubmit={finishSafety}>
          <SafetyQuestions answers={answers} medicationNames={medicationNames} busy={busy} onAnswer={updateAnswer} onMedicationNamesChange={value => { setMedicationNames(value); clearStatus(); }} />
          <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => { setStage("intro"); clearStatus(); }}><ArrowLeft size={16} aria-hidden="true" />Tillbaka</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Förbereder frågorna…" : "Fortsätt till frågorna"}<ArrowRight size={16} aria-hidden="true" /></button></div>
        </form>
      </section>}
      {(stage === "questions" || stage === "followup" || stage === "interview") && currentQuestion && <section aria-busy={busy}>
        <p className={styles.questionSection}>{stage === "followup" ? "Fördjupning · " : ""}{currentQuestion.section}</p>
        <h2 ref={headingRef} tabIndex={-1} id="anamnes-question" className={styles.heading}>{currentQuestion.prompt}</h2>
        {currentQuestion.help && <p id="anamnes-question-help" className={styles.lead}>{currentQuestion.help}</p>}
        {stage === "followup" && <p className={styles.smallNote}>Frågan hjälper till att skilja överlappande mönster åt. Du kan välja att inte svara.</p>}
        {stage === "interview" && <p className={styles.smallNote}>{localInterview ? "Frågorna väljs utifrån dina formulärsvar. Din egen beskrivning fyller inte i några symtom automatiskt." : "Frågorna anpassas efter din beskrivning och dina bekräftade svar. Texten fyller inte automatiskt i några symtom."} Du kan välja ”Vet inte”, gå tillbaka eller avsluta med det underlag som finns.</p>}
        {currentQuestion.id === "priorAssessment" && <p className={styles.smallNote}>”Vet inte” är ett giltigt svar. Uppgiften markeras då som osäker i sammanfattningen och stoppar inte ensam mönsteranalysen.</p>}
        {sessionNotice && <p className={styles.notice} role="status">{sessionNotice}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {stage === "questions" && !interviewActive && retainedQuestions.length > 0 && <p className={styles.smallNote}>Tidigare besvarade fördjupningsfrågor finns kvar sist i frågeflödet så att du kan granska och ändra dem. Säkerhetsuppgifter tas aldrig bort när du byter fokus.</p>}
        <fieldset className={styles.fieldset} disabled={busy} aria-labelledby="anamnes-question" aria-describedby={currentQuestion.help ? "anamnes-question-help" : undefined}><legend className={styles.srOnly}>Välj svar på frågan</legend><div className={styles.questionOptions}>{currentQuestion.options.map(option => <label className={`${styles.option} ${answers[currentQuestion.id] === option.value ? styles.selected : ""}`} key={`${currentQuestion.id}-${option.value}`}><input type="radio" name={`anamnes-${currentQuestion.id}`} value={option.value} checked={answers[currentQuestion.id] === option.value} onChange={() => updateAnswer(currentQuestion, option.value)} /><span>{option.label}</span></label>)}</div></fieldset>
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={previous}><ArrowLeft size={16} aria-hidden="true" />Tillbaka</button><button type="button" className={styles.primary} disabled={busy} onClick={next}>{busy ? "Bearbetar svaren…" : index + 1 === currentQuestions.length ? interviewActive ? stage === "interview" && interviewRound >= INTERVIEW_MAX_ROUNDS ? "Sammanfatta samtalet" : "Ta fram nästa frågor" : stage === "followup" ? "Visa rapport" : "Gå vidare till analys" : "Nästa fråga"}<ArrowRight size={16} aria-hidden="true" /></button></div>
        {interviewActive && <div className={styles.editActions}><button type="button" disabled={busy} onClick={() => void advanceInterview(true)}>Avsluta och visa underlaget nu</button></div>}
        {interviewActive && <details className={styles.reportDetails}><summary>Din beskrivning – komplettera vid behov</summary>{narrativeEditor()}</details>}
      </section>}
      {stage === "report" && report && <section>
        <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>{report.safety.level === "emergency" ? answers.emergency === "yes" ? "Avbryt formuläret och sök vård" : "Varningsuppgifter i beskrivningen" : "Ditt resultat"}</h2>
        {report.safety.level === "emergency" ? <><div className={styles.alert} role="alert"><strong>Uppgifterna behöver förtydligas innan anamnesen fortsätter.</strong>{report.safety.flags.map((flag, index) => <p key={index}>{flag}</p>)}<p>Ring 112 vid ett akut nödläge. Fortsätt inte formuläret för att försöka förklara akuta symtom med TCM.</p></div><a href="tel:112" className={styles.primary}>Ring 112 vid nödläge</a>{answers.emergency !== "yes" && <div className={styles.editActions}><button type="button" onClick={() => { setStage("intro"); setReport(null); clearStatus(); }}>Gå tillbaka och förtydliga beskrivningen</button></div>}</> : <>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {sessionNotice && <p className={styles.notice} role="status">{sessionNotice}</p>}
          <AnamnesReport report={report} answers={answers} medicationNames={medicationNames} />
          {narrative.trim() && <details className={styles.reportDetails}><summary>Din egen beskrivning</summary><p className={styles.narrativeText}>{narrative.trim()}</p></details>}
          {completionQuestions.length > 0 && <div className={styles.completionPanel}><p>Vill du förtydliga resultatet? Dina tidigare svar finns kvar.</p><button type="button" className={styles.secondary} disabled={busy} onClick={complementReport}>Komplettera underlaget<ArrowRight size={16} aria-hidden="true" /></button></div>}
          <div className={styles.consultation}><Sparkles size={24} aria-hidden="true" /><div><h3>Gå vidare med en terapeut</h3><Link href="/boka" className={styles.primary} prefetch={false}>Boka konsultation<ArrowRight size={16} aria-hidden="true" /></Link></div></div>
          <details className={styles.summaryPanel}><summary>Kopiera eller granska sammanfattningen</summary><label className={styles.summaryLabel} htmlFor="anamnes-summary">Din sammanfattning</label><textarea id="anamnes-summary" className={styles.summaryText} readOnly value={summary} rows={12} spellCheck={false} /><div className={styles.actions}><button type="button" className={styles.secondary} onClick={copySummary}><Clipboard size={16} aria-hidden="true" />{copied ? "Kopierad" : "Kopiera sammanfattning"}</button></div>{copied && <p className={styles.copyStatus} role="status">Sammanfattningen kopierades. Den innehåller hälsouppgifter; välj själv hur du delar den.</p>}</details>
          {config.submissions.available && config.submissions.consentVersion ? <details className={styles.reportDetails}><summary>Skicka underlaget till en behandlare</summary><section className={styles.submissionPanel} aria-labelledby="anamnes-send-title"><h3 id="anamnes-send-title">Vill du skicka underlaget till behandlaren?</h3><p>Det är frivilligt. Dina svar, din egen beskrivning och dina kontaktuppgifter skickas till behandlaren. {report.source === "ai" && receipt ? "Den AI-assisterade originalrapporten följer med utan ett nytt AI-anrop." : report.source === "ai" ? "Den här AI-rapporten saknar ett giltigt sparningsunderlag. Vid inskickning skapas därför en regelbaserad rapport från svaren." : "En regelbaserad rapport skapas från svaren med den aktuella katalogen."} Behandlarens egen bedömning dokumenteras separat.</p><p className={styles.smallNote}>{config.submissions.notice}</p><p className={styles.smallNote}>Underlaget lagras krypterat i högst {config.submissions.retentionDays} dagar. Behörig behandlare kan läsa det i sin skyddade vy.</p>{submission ? <div className={styles.notice} role="status"><strong>Underlaget har tagits emot.</strong><p>Referens: <code>{submission.reference}</code></p><p>Underlaget är tillgängligt till {new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeZone: "Europe/Stockholm" }).format(new Date(submission.expiresAt))}.</p></div> : <form onSubmit={sendToTherapist} className={styles.contactForm}>
            <label>Namn<input name="name" autoComplete="name" required maxLength={100} value={contact.name} onChange={event => setContact(previous => ({ ...previous, name: event.target.value }))} disabled={busy} /></label><label>E-postadress<input name="email" autoComplete="email" type="email" required maxLength={254} value={contact.email} onChange={event => setContact(previous => ({ ...previous, email: event.target.value }))} disabled={busy} /></label><label>Telefon (valfritt)<input name="phone" autoComplete="tel" type="tel" maxLength={30} value={contact.phone} onChange={event => setContact(previous => ({ ...previous, phone: event.target.value }))} disabled={busy} /></label>
            <label className={`${styles.option} ${styles.checkbox}`}><input type="checkbox" required checked={sendConsentVersion === config.submissions.consentVersion} onChange={event => setSendConsentVersion(event.target.checked ? config.submissions.consentVersion! : null)} disabled={busy} /><span>Jag har läst informationen och väljer att skicka min egen beskrivning, mina hälsosvar och kontaktuppgifter till Tibb.nu för att förbereda en konsultation.</span></label><button type="submit" className={styles.primary} disabled={busy || !sendConsentVersion}>{busy ? "Skickar underlaget…" : "Skicka till behandlaren"}</button>
          </form>}</section></details> : null}
          <div className={styles.editActions}><button type="button" disabled={busy} onClick={() => { setInterviewActive(false); setStage("safety"); setIndex(0); clearStatus(); }}>Gå igenom och ändra svar</button><button type="button" disabled={busy} onClick={() => { setStage("intro"); clearStatus(); }}>Ändra beskrivning och analysinställningar</button></div>
        </>}
      </section>}
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
      {stage !== "intro" && <div className={styles.editActions}><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Rensa svar och börja om</button></div>}
      <details className={styles.reportDetails}><summary>Om anamnesen och säkerhet</summary><div className={styles.sources}><a href="https://www.1177.se/undersokning-behandling/fler-behandlingar/alternativa-behandlingar/vaxtbaserade-lakemedel-och-naturlakemedel/" target="_blank" rel="noopener noreferrer">1177 – växtbaserade läkemedel ↗</a><a href="https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know" target="_blank" rel="noopener noreferrer">NCCIH – traditionell kinesisk medicin ↗</a><Link href="/integritet" prefetch={false}>Integritetsinformation</Link></div></details>
    </div>
  </div>;
}
