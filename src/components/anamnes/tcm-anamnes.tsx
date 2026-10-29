"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Clipboard, RotateCcw, Sparkles } from "lucide-react";
import { buildReport, canAnalyzePatterns, getSafetyAssessment, safetyQuestionIds } from "@/lib/anamnes/engine";
import { getInitialQuestions, getFollowupQuestions, isPublicQuestion, questionBank, questionById } from "@/lib/anamnes/questions";
import { FormulaRecordSchema, ReportSchema, InterviewResponseSchema, NarrativeSchema, MedicationNamesSchema, ConsultationDetailsSchema, emptyConsultationDetails, type ConsultationDetails, type AnswerMap, type FormulaRecord, type Question, type QuestionId, type Report } from "@/lib/anamnes/types";
import { finalizeInterviewReport, getInterviewCompletionQuestionIds, getFormulaComparisonQuestionIds } from "@/lib/anamnes/interview";
import { formatAnamnesSummary } from "@/lib/anamnes/summary";
import { consultationDetailsText, hasConsultationDetails } from "@/lib/anamnes/consultation";
import { AnamnesReport } from "./report";
import { IntakeContactSchema } from "@/lib/intake-contact";
import { AnamnesSubmissionPanel } from "./submission-panel";
import { SafetyQuestions } from "./safety-questions";
import { ConsultationDetailsFields } from "./consultation-details-fields";
import { AiExtractionSchema, confirmObservations, removeConfirmedObservation, type ExtractionObservation, type ObservationDecision } from '@/lib/anamnes/observations';
import { ObservationReview } from './observation-review';
import { useAnamnesDraft } from './use-anamnes-draft';
import { AnamnesDraftPanel } from './draft-panel';
import { AnamnesStartControls } from './start-controls';
import { buildVisitorDifferential } from '@/lib/anamnes/public-differential';
import { draftResumeCursor, type AnamnesDraft } from '@/lib/anamnes/draft';
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
type Stage = "intro" | "safety" | "observations" | "questions" | "followup" | "interview" | "report";
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
  const [consultation, setConsultation] = useState<ConsultationDetails>(emptyConsultationDetails);
  const [interviewActive, setInterviewActive] = useState(false);
  const [localInterview, setLocalInterview] = useState(false);
  const [reviewingAnswers, setReviewingAnswers] = useState(false);
  const [extracted, setExtracted] = useState<ExtractionObservation[]>([]);
  const [extractionReady,setExtractionReady] = useState(false);
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
  const [aiSessionUnavailable,setAiSessionUnavailable]=useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [submission, setSubmission] = useState<{ reference: string; expiresAt: string } | null>(null);
  const [submissionError, setSubmissionError] = useState("");
  const [sendConsentVersion, setSendConsentVersion] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const firstFocus = useRef(true);
  const activeQuestions = useMemo(() => getInitialQuestions(answers), [answers]);
  const retainedQuestions = useMemo(() => questionBank.filter(question => isPublicQuestion(question) && Object.hasOwn(answers, question.id) && !activeQuestions.some(active => active.id === question.id)), [activeQuestions, answers]);
  // Safety answers are reviewed together on their own page, including on edits.
  const initialQuestions = useMemo(() => [...activeQuestions, ...retainedQuestions].filter(question => !safetyQuestionIds.includes(question.id)), [activeQuestions, retainedQuestions]);
  const currentQuestions = stage === "interview" ? interviewHistory : stage === "followup" ? followups : initialQuestions;
  const currentQuestion = currentQuestions[Math.min(index, currentQuestions.length - 1)];
  const summary = useMemo(() => report && NarrativeSchema.safeParse(narrative).success && MedicationNamesSchema.safeParse(medicationNames).success && ConsultationDetailsSchema.safeParse(consultation).success ? formatAnamnesSummary(report, answers, narrative.trim(), medicationNames, consultation) : "", [report, answers, narrative, medicationNames, consultation]);
  const answeredSafetyCount = safetyQuestionIds.filter(id => !!answers[id]).length;
  const phase = stage === "intro" ? 0 : stage === "safety" ? 1 : stage === "report" ? 3 : 2;
  const questionNote = currentQuestion && currentQuestion.id !== "pulse" ? consultation.questionNotes[currentQuestion.id] ?? "" : "";
  const questionNoteLimit = Math.max(0, Math.min(400, 6000 - Object.entries(consultation.questionNotes).reduce((total, [id, value]) => total + (id === currentQuestion?.id ? 0 : value?.length ?? 0), 0)));
  const aiChoiceAvailable = !aiSessionUnavailable && catalogState === "ready" && config.analysisMode === "ai" && config.ai.available && !!config.ai.consentVersion;
  const completionQuestions = useMemo(() => report?.differential?[...new Set(report.differential.findings.flatMap(f=>f.missingQuestionIds))].filter(id=>!Object.hasOwn(answers,id)):report?getInterviewCompletionQuestionIds(answers, report.analysis):[], [answers, report]);
  const drafts=useAnamnesDraft({version:1,answers,narrative,medicationNames,consultation,flow:interviewActive&&!localInterview?'ai':'rules',position:{
    stage:stage==='observations'?'safety':stage,questionId:['questions','followup','interview'].includes(stage)?currentQuestion?.id??null:null,
    index,history:(stage==='questions'?currentQuestions:interviewHistory).map(question=>question.id),followups:followups.map(question=>question.id),round:interviewRound}},!!submission);

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
  useEffect(()=>{setAiSessionUnavailable(false);},[config.ai.consentVersion]);
  useEffect(() => {
    // Wait for the confirmed AnswerMap and provenance to render before the next request.
    if (extractionReady && !busy) { setExtractionReady(false); void advanceInterview(); }
  }, [extractionReady, busy]);

  function clearStatus() { setError(""); setNotice(""); setCopied(false); setSubmission(null); setSubmissionError(""); setSendConsentVersion(null); setReceipt(null); }
  function updateConsultation(patch: Partial<ConsultationDetails>) {
    const changedSources=['locations','dailyImpact','goal','previousCare','lifestyle'].filter(key=>Object.hasOwn(patch,key));
    const changedNotes=patch.questionNotes?Object.keys({...consultation.questionNotes,...patch.questionNotes}).filter(id=>consultation.questionNotes[id as keyof ConsultationDetails["questionNotes"]]!==patch.questionNotes?.[id as keyof ConsultationDetails["questionNotes"]]):[];
    const cleaned = changedSources.length||changedNotes.length ? revokeInterpretations(changedSources,changedNotes) : consultation;
    setConsultation({ ...cleaned, ...patch }); clearStatus();
  }
  function revokeInterpretations(sources:string[],notes:string[]=[]) {
    let value={answers,consultation};
    for(const origin of consultation.confirmedObservations??[])if(sources.includes(origin.source)||(origin.source==='questionNote'&&notes.length&&(!origin.sourceQuestionId||notes.includes(origin.sourceQuestionId))))value=removeConfirmedObservation(value.answers,value.consultation,origin.questionId);
    setAnswers(value.answers);setConsultation(value.consultation);setExtracted([]);
    return value.consultation;
  }
  function acceptObservations(decisions:ObservationDecision[]) {
    const value=confirmObservations(answers,consultation,extracted,decisions);
    setAnswers(value.answers);setConsultation(value.consultation);setExtracted([]);clearStatus();setExtractionReady(true);
  }
  async function prepareObservations() {
    const run=++sequence.current,controller=new AbortController();request.current?.abort();request.current=controller;setBusy(true);
    try {
      const response=await fetch('/api/anamnes/extract',{method:'POST',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]),headers:{'Content-Type':'application/json'},body:JSON.stringify({answers,narrative:narrative.trim(),consultation,aiConsent:true,aiConsentVersion,formulaReferencesEnabled:true})});
      if(!response.ok)throw new Error('Extraction unavailable');
      const result=AiExtractionSchema.extend({available:z.boolean()}).parse(await response.json());
      if(run!==sequence.current)return;
      if(result.observations.length){setExtracted(result.observations);setStage('observations');}
      else setExtractionReady(true);
    } catch {
      if(controller.signal.aborted||run!==sequence.current)return;
      setNotice('Tolkningen kunde inte förberedas. Du kan besvara frågorna som vanligt.');setExtractionReady(true);
    } finally {if(run===sequence.current){setBusy(false);request.current=null;}}
  }
  function validateConsultation(value = consultation) {
    if (ConsultationDetailsSchema.safeParse(value).success) return true;
    setError("Kontrollera kompletteringarna. Använd 0–10 för besvärens styrka och håll dig inom fältens teckengränser. Ta bort osynliga kontrolltecken.");
    return false;
  }
  function reset() {
    void drafts.clear();
    setExtracted([]);setExtractionReady(false);
    request.current?.abort(); sequence.current++; setBusy(false); setAnswers({}); setNarrative(""); setMedicationNames(""); setConsultation(emptyConsultationDetails()); setInterviewActive(false); setLocalInterview(false); setReviewingAnswers(false); setSessionNotice(""); setInterviewHistory([]); setInterviewRound(0); setReport(null); setFollowups([]); setStage("intro"); setIndex(0); setAiConsentVersion(null); setContact({ name: "", email: "", phone: "" }); clearStatus();
  }
  function updateAnswer(question: Question, value: string) {
    const next = { ...answers, [question.id]: value };
    setAnswers(next); clearStatus();
    if(stage==='report'){setReport(null);setReviewingAnswers(true);setAiConsentVersion(null);setStage('safety');setIndex(0);}
    if (question.id === "medication" && value !== "yes") setMedicationNames("");
    const nextConsultation = safetyQuestionIds.includes(question.id) ? { ...consultation, ...(next.medication !== "yes" ? { medicationDetails: "" } : {}), ...(next.chronicDisease !== "yes" && next.liverKidney !== "yes" ? { conditionDetails: "" } : {}), ...(next.allergy !== "yes" ? { allergyDetails: "" } : {}) } : consultation;
    const correctedConsultation={...nextConsultation,confirmedObservations:nextConsultation.confirmedObservations?.filter(origin=>origin.questionId!==question.id||origin.answer===value)};
    setConsultation(correctedConsultation);
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Beskrivningen innehåller osynliga kontrolltecken eller är för lång. Gå tillbaka och rätta texten."); return; }
    if (!validateConsultation(nextConsultation)) return;
    if (getSafetyAssessment(next, narrative.trim(), nextConsultation).level === "emergency") {
      request.current?.abort(); sequence.current++; setBusy(false); setReport(buildReport(next, [], { narrative: narrative.trim(), consultation: nextConsultation })); setStage("report");
    }
  }
  function start(useAi = false) {
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Beskrivningen innehåller osynliga kontrolltecken eller är för lång. Rätta texten innan du fortsätter."); return; }
    if (!validateConsultation()) return;
    if (getSafetyAssessment(answers, narrative.trim(), consultation).level === "emergency") { setReport(buildReport(answers, [], { narrative: narrative.trim(), consultation })); setStage("report"); clearStatus(); return; }
    if (useAi && !aiChoiceAvailable) { setError("AI är inte tillgänglig just nu. Du kan fortsätta utan AI."); return; }
    if (useAi && !narrative.trim()) { setError("Beskriv först vad du söker hjälp för, så att AI kan anpassa frågorna. Du kan också starta utan AI."); return; }
    // Only the start-button action records the current choice; loading the page does not.
    setAiConsentVersion(useAi ? config.ai.consentVersion! : null);
    setInterviewActive(true); setLocalInterview(!useAi); setReviewingAnswers(false); setSessionNotice(""); setInterviewHistory([]); setInterviewRound(0); setReport(null); setFollowups([]); setIndex(0); setStage("safety"); clearStatus();
  }
  function restoreDraft(draft:AnamnesDraft,useAi:boolean){
    request.current?.abort();sequence.current++;setBusy(false);setExtractionReady(false);setExtracted([]);clearStatus();
    setContact({name:'',email:'',phone:''});setAnswers(draft.answers);setNarrative(draft.narrative);setMedicationNames(draft.medicationNames);setConsultation(draft.consultation);
    // The restored choice may precede completion of safety answers. It grants
    // consent only; every provider call still requires the full safety gate.
    const safety=getSafetyAssessment(draft.answers,draft.narrative,draft.consultation),allowAi=useAi&&aiChoiceAvailable;
    setAiConsentVersion(allowAi?config.ai.consentVersion!:null);setInterviewActive(true);setLocalInterview(!allowAi);setReviewingAnswers(false);setInterviewRound(draft.position.round);
    setSessionNotice(allowAi?'Ditt utkast är återställt. Du har valt att fortsätta med AI.':'Ditt utkast är återställt. Inga svar skickas till AI utan ett nytt aktivt val.');
    if(safety.level==='emergency'||draft.position.stage==='report'){
      if(safety.level!=='emergency')setSessionNotice(catalogState==='ready'?'Dina sparade svar är återställda. En ny regelbaserad rapport har räknats fram med den aktuella katalogen. En tidigare AI-rapport sparas inte i utkastet.':'Dina sparade svar är återställda. Rapporten bygger på aktuella regler, men formelkatalogen kunde inte hämtas. Inga formelreferenser visas.');
      setReport(finalizeInterviewReport(buildReport(draft.answers,config.formulas,{narrative:draft.narrative,consultation:draft.consultation}),draft.answers));setStage('report');setIndex(0);return;
    }
    setReport(null);
    if(['intro','safety'].includes(draft.position.stage)||!canAnalyzePatterns(safety)){
      setStage(draft.position.stage==='intro'?'intro':'safety');setIndex(0);setInterviewHistory([]);return;
    }
    const {history,index:restoredIndex}=draftResumeCursor(draft);
    if(!history.length){setInterviewHistory([]);setStage('safety');setIndex(0);return;}
    setInterviewHistory(history);setIndex(restoredIndex);setStage('interview');
  }
  function finishSafety(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validateConsultation()) return;
    if (!safetyQuestionIds.every(id => questionById.get(id)?.options.some(option => option.value === answers[id]))) { setError("Besvara alla säkerhetsfrågor. Du kan välja ”Vet inte” eller ”Vill inte svara”."); return; }
    const names = MedicationNamesSchema.safeParse(medicationNames);
    if (answers.medication === "yes" && (!names.success || !names.data)) { setError("Ange namnen på dina läkemedel eller kosttillskott. Undvik osynliga kontrolltecken och använd högst 1 000 tecken."); return; }
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Rätta beskrivningens osynliga kontrolltecken eller längd innan du fortsätter."); return; }
    const safety = getSafetyAssessment(answers, narrative.trim(), consultation);
    if (safety.level === "emergency") { setReport(buildReport(answers, [], { narrative: narrative.trim(), consultation })); setStage("report"); clearStatus(); return; }
    clearStatus(); setIndex(0);
    if (reviewingAnswers) {
      setInterviewActive(true); setLocalInterview(true);
      void advanceInterview();
      setSessionNotice("Du granskar och kan ändra dina tidigare svar. När du är klar skapas ett uppdaterat lokalt underlag.");
      return;
    }
    if(interviewActive&&localInterview){void advanceInterview();return;}
    if (interviewActive && canAnalyzePatterns(safety)) {
      if (interviewHistory.length) setStage("interview");
      else void prepareObservations();
    } else {
      if (interviewActive) { setAiConsentVersion(null); setSessionNotice("Med dessa säkerhetsuppgifter används lokala frågor. Din beskrivning finns kvar för behandlaren och skickas inte till AI."); }
      setInterviewActive(true); setLocalInterview(true);
      continueLocally(buildReport(answers, config.formulas, { narrative: narrative.trim(), consultation }), false);
    }
  }
  function showInterviewStep(nextReport: Report, ids: readonly QuestionId[], complete: boolean, reason: "continue" | "enough" | "exhausted" | "limit" | "fallback" | "safety", nextReceipt?: AnalysisReceipt, stopped = false,prompts:Partial<Record<QuestionId,string>>={}) {
    setReport(nextReport); setReceipt(nextReceipt ?? null);
    if (complete) {
      if (stopped) setNotice("Du har valt att avsluta samtalet. Rapporten sammanfattar svaren hittills och visar vilka uppgifter som fortfarande är osäkra.");
      else if (reason === "exhausted" || reason === "limit") setNotice("De relevanta frågorna i formuläret är genomgångna. Rapporten visar vad som fortfarande behöver klargöras tillsammans med behandlaren.");
      setStage("report"); return;
    }
    const nextQuestions = ids.map(id => {const question=questionById.get(id);return question?{...question,prompt:prompts[id]??question.prompt}:undefined;}).filter((question): question is Question => !!question && isPublicQuestion(question) && !Object.hasOwn(answers, question.id) && !interviewHistory.some(prior => prior.id === question.id));
    if (!nextQuestions.length) { setReport(nextReport.differential?nextReport:finalizeInterviewReport(nextReport, answers)); setReceipt(null); setStage("report"); return; }
    setInterviewHistory(previous => [...previous, ...nextQuestions]); setIndex(interviewHistory.length); setInterviewRound(previous => previous + 1); setStage("interview");
  }
  function continueLocally(_nextReport: Report, finish: boolean,catalog=config.formulas) {
    const {report:nextReport,result}=buildVisitorDifferential({answers,narrative:narrative.trim(),consultation},catalog,null,'local',finish);
    const ids=nextReport.followUpQuestionIds,complete=finish||result.status!=='continue';
    showInterviewStep(nextReport,ids,complete,ids.length===0?'exhausted':'continue',undefined,finish);
  }
  function complementReport() {
    const questions = completionQuestions.map(id => questionById.get(id)).filter((question): question is Question => !!question);
    if (!questions.length) return;
    if (questions.some(question => safetyQuestionIds.includes(question.id))) { setAiConsentVersion(null); setInterviewActive(false); setIndex(0); setStage("safety"); clearStatus(); return; }
    setAiConsentVersion(null); setReviewingAnswers(false); setLocalInterview(true); setInterviewActive(true); setInterviewHistory(questions); setInterviewRound(1); setIndex(0); setStage("interview"); clearStatus();
    setSessionNotice("Du kompletterar underlaget med lokala frågor. Tidigare svar finns kvar. Inga nya svar skickas till AI.");
  }
  async function advanceInterview(finish = false) {
    if (busy) return;
    if (!validateConsultation()) return;
    if (!NarrativeSchema.safeParse(narrative).success) { setError("Rätta beskrivningens osynliga kontrolltecken eller längd innan du fortsätter."); return; }
    const run = ++sequence.current;
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setBusy(true); clearStatus();
    try {
      const latest = await loadCatalog(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
      if (run !== sequence.current) return;
      setConfig(latest); setCatalogState("ready");
      const local = buildReport(answers, latest.formulas, { narrative: narrative.trim(), consultation });
      if (localInterview) { continueLocally(local, finish,latest.formulas); return; }
      if (!canAnalyzePatterns(local.safety)) {
        if (answers.focus === "pain" && ["unknown", "prefer_not"].includes(answers.jointWarmth ?? "")) { setReport(finalizeInterviewReport(local, answers)); setStage("report"); setNotice("Uppgiften om en röd, varm eller svullen led är osäker. Underlaget sammanfattas för individuell bedömning; inga formelreferenser visas."); }
        else if (!finish && local.safety.level !== "emergency") { setLocalInterview(true); setAiConsentVersion(null); setSessionNotice("Med dessa säkerhetsuppgifter används lokala frågor. Din beskrivning finns kvar för behandlaren och skickas inte till AI."); continueLocally(local, false,latest.formulas); }
        else { setReport(finalizeInterviewReport(local, answers)); setStage("report"); }
        return;
      }
      if (latest.analysisMode !== "ai" || !latest.ai.available || !aiConsentVersion || aiConsentVersion !== latest.ai.consentVersion) {
        setAiConsentVersion(null); setLocalInterview(true); setSessionNotice("AI-samtalet är inte tillgängligt med det aktuella valet. Du fortsätter med lokala följdfrågor och behåller dina tidigare svar.");
        continueLocally(local, finish,latest.formulas);
        return;
      }
      const response = await fetch("/api/anamnes/interview", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]), body: JSON.stringify({ answers, narrative: narrative.trim(), consultation, aiConsent: true, aiConsentVersion, round: interviewRound, finalize: finish, formulaReferencesEnabled: true }) });
      if (!response.ok) throw new Error("Samtalet kunde inte fortsätta.");
      const value = InterviewResponseSchema.parse(await response.json());
      if (run !== sequence.current) return;
      if (value.reason === "fallback") {
        setAiSessionUnavailable(true);
        setAiConsentVersion(null); setLocalInterview(true); setSessionNotice("AI kunde inte användas. Du fortsätter med lokala följdfrågor och behåller dina tidigare svar. Rapporten bygger på poängmodellen.");
      }
      showInterviewStep(value.report, value.questionIds, value.complete || finish, value.reason, value.receipt, finish,value.questionPrompts);
    } catch {
      if (controller.signal.aborted || run !== sequence.current) return;
      setAiSessionUnavailable(true);
      setCatalogState("unavailable"); setAiConsentVersion(null); setLocalInterview(true); setSessionNotice("Anslutningen kunde inte användas. Du kan fortsätta lokalt med dina tidigare svar. Formelreferenser visas först när den aktuella katalogen har kunnat kontrolleras.");
      continueLocally(buildReport(answers, [], { narrative: narrative.trim(), consultation }), finish,[]);
    } finally { if (run === sequence.current) { setBusy(false); request.current = null; } }
  }
  async function calculate(final: boolean) {
    if (busy) return;
    if (!validateConsultation()) return;
    setReviewingAnswers(false);
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
      let result = buildVisitorDifferential({answers,narrative:narrative.trim(),consultation},activeCatalog,null,'local',true).report;
      let nextReceipt: AnalysisReceipt | null = null;
      const mayUseAi = catalogVerified && activeConfig.analysisMode === "ai" && !!aiConsentVersion && activeConfig.ai.available && aiConsentVersion === activeConfig.ai.consentVersion && canAnalyzePatterns(result.safety);
      if (mayUseAi) {
        try {
          const response = await fetch("/api/anamnes/analyze", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), body: JSON.stringify({ answers, narrative: narrative.trim(), consultation, aiConsent: true, aiConsentVersion, formulaReferencesEnabled: true }) });
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
    if (!validateConsultation()) return;
    if (getSafetyAssessment(answers, narrative.trim(), consultation).level === "emergency") { setReport(buildReport(answers, [], { narrative: narrative.trim(), consultation })); setStage("report"); clearStatus(); return; }
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
    if (!validateConsultation()) { setSubmissionError("Kompletteringarna behöver kontrolleras. Stäng rutan och gå igenom uppgifterna innan du skickar."); return; }
    const parsedContact = IntakeContactSchema.safeParse(contact);
    if (!parsedContact.success) { setSubmissionError("Kontrollera ditt namn och din e-postadress och försök igen."); return; }
    if (!config.submissions.available || !sendConsentVersion || sendConsentVersion !== config.submissions.consentVersion) { setSubmissionError("Läs informationen och markera att du vill skicka anamnesen till behandlaren."); return; }
    const run = ++sequence.current; const controller = new AbortController(); request.current = controller;
    setBusy(true); setSubmissionError(""); setError("");
    try {
      const response = await fetch("/api/anamnes/submit", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), body: JSON.stringify({ answers, narrative: narrative.trim(), medicationNames: answers.medication === "yes" ? medicationNames.trim() : "", consultation, formulaReferencesEnabled: true, sendConsent: true, submissionConsentVersion: sendConsentVersion, contact: parsedContact.data, ...(report?.source === "ai" && receipt ? { report, receipt } : {}) }) });
      if (!response.ok) throw new Error(response.status === 409 ? "Rapportens eller samtyckets giltighet behöver förnyas. Gå igenom svaren och skapa en ny rapport innan du skickar, eller ta med den kopierade sammanfattningen till konsultationen." : "Inskickningen kunde inte bekräftas. Kontrollera informationen och försök igen, eller ta med den kopierade sammanfattningen till konsultationen.");
      const result = z.object({ reference: z.string().uuid(), expiresAt: z.string().datetime() }).parse(await response.json());
      if (run === sequence.current) { setSubmission(result); setSendConsentVersion(null); void drafts.clear(); }
    } catch (failure) { if (run === sequence.current && !controller.signal.aborted) setSubmissionError(failure instanceof Error ? failure.message : "Anamnesen kunde inte skickas. Dina svar finns kvar; försök igen."); }
    finally { if (run === sequence.current) { setBusy(false); request.current = null; } }
  }
  function narrativeEditor() {
    return <div className={styles.storyEditor}><label htmlFor="anamnes-story">Berätta med egna ord</label><p id="anamnes-story-help" className={styles.smallNote}>Vad söker du hjälp för, när började det och vad gör det bättre eller sämre? Beskriv gärna flera besvär. Undvik namn, personnummer och kontaktuppgifter.</p><textarea id="anamnes-story" value={narrative} maxLength={4000} rows={6} autoComplete="off" disabled={busy} aria-describedby="anamnes-story-help anamnes-story-count" placeholder="Jag söker hjälp för…" onChange={event => { revokeInterpretations(["narrative"]); setNarrative(event.target.value); clearStatus(); }} /><span id="anamnes-story-count" className={styles.smallNote}>{narrative.length} av 4 000 tecken.</span></div>;
  }
  const draftPanel = report?.safety.level !== "emergency" ? <AnamnesDraftPanel controls={drafts} aiAvailable={aiChoiceAvailable} busy={busy||catalogState==="loading"} onResume={restoreDraft}/> : null;

  return <div className={styles.shell}>
    <div className={styles.body}>
      {stage !== "intro" && stage !== "report" && draftPanel}
      {report?.safety.level !== "emergency" && <nav className={styles.phaseProgress} aria-label="Anamnesens steg"><ol>{["Din berättelse", "Trygghetsfrågor", "Följdfrågor", submission ? "Inskickat" : config.submissions.available ? "Granska & skicka" : "Ditt underlag"].map((label, step) => <li key={step} className={step <= phase ? styles.phaseReached : undefined} aria-current={step === phase ? "step" : undefined}><span aria-hidden="true">{step + 1}</span>{label}</li>)}</ol></nav>}
      {stage !== "intro" && stage !== "report" && report?.safety.level !== "emergency" && <div className={styles.questionProgress}><div><span>{stage === "safety" ? `${answeredSafetyCount} av ${safetyQuestionIds.length} trygghetsfrågor besvarade` : `Fråga ${index + 1}${stage === "interview" ? " · anpassas efter dina svar" : ""}`}</span></div>{stage !== "safety" && <p className={styles.modeStatus} role="status"><strong>{interviewActive && !localInterview ? "AI-anpassade frågor" : "Lokala frågor"}</strong>{sessionNotice ? <span>{sessionNotice}</span> : <span>{interviewActive && !localInterview ? "Din beskrivning och dina bekräftade svar styr vilka frågor som kommer härnäst." : "Dina valda svar används i poängmodellen. Beskrivningen och dina förtydliganden finns kvar för behandlaren."}</span>}</p>}</div>}
      {stage === "intro" && <section>
        <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>{config.analysisMode === "ai" ? "Börja med din berättelse." : "Dina svar först. Mönster och referenser därefter."}</h2>
        <p className={styles.lead}>Beskriv dina symtom och vad du upplever med egna ord, utan västerländska diagnosnamn. Sedan följer trygghetsfrågor och frågor som anpassas efter dina svar. Du kan pausa och fortsätta senare.</p>
        {narrativeEditor()}
        <ConsultationDetailsFields value={consultation} disabled={busy} onChange={updateConsultation} />
        {catalogState === "unavailable" && <p className={styles.warning}>Den aktuella formelkatalogen kunde inte laddas. Du kan fortsätta med frågorna och få en mönsteranalys; ingen inaktuell katalog används som reserv.</p>}
        <AnamnesStartControls aiAvailable={aiChoiceAvailable} loading={catalogState==='loading'} providerLabel={config.ai.providerLabel} privacyNotice={config.ai.privacyNotice} onStart={start}>{draftPanel}</AnamnesStartControls>
      </section>}
      {stage === "observations" && <section aria-busy={busy}><h2 ref={headingRef} tabIndex={-1} className={styles.heading}>Granska din berättelse</h2><ObservationReview proposals={extracted} onConfirm={acceptObservations} onSkip={()=>{setExtracted([]);setExtractionReady(true);}} disabled={busy}/></section>}
      {stage === "safety" && <section aria-labelledby="anamnes-safety-title" aria-busy={busy}>
        <h2 ref={headingRef} tabIndex={-1} id="anamnes-safety-title" className={styles.heading}>Innan vi börjar</h2>
        <p className={styles.lead}>Besvara säkerhetsfrågorna här, så fortsätter vi sedan med dina besvär. Du kan välja ”Vet inte” eller ”Vill inte svara”.</p>
        <form onSubmit={finishSafety}>
          <SafetyQuestions answers={answers} medicationNames={medicationNames} consultation={consultation} onConsultationChange={updateConsultation} busy={busy} onAnswer={updateAnswer} onMedicationNamesChange={value => { setMedicationNames(value); clearStatus(); }} />
          <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => { setStage("intro"); clearStatus(); }}><ArrowLeft size={16} aria-hidden="true" />Tillbaka</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Förbereder frågorna…" : "Fortsätt till frågorna"}<ArrowRight size={16} aria-hidden="true" /></button></div>
        </form>
      </section>}
      {(stage === "questions" || stage === "followup" || stage === "interview") && currentQuestion && <section aria-busy={busy}>
        <p className={styles.questionSection}>{stage === "followup" ? "Fördjupning · " : ""}{currentQuestion.section}</p>
        <h2 ref={headingRef} tabIndex={-1} id="anamnes-question" className={styles.heading}>{currentQuestion.prompt}</h2>
        {currentQuestion.help && <p id="anamnes-question-help" className={styles.lead}>{currentQuestion.help}</p>}
        {stage === "followup" && <p className={styles.smallNote}>Frågan hjälper till att skilja överlappande mönster åt. Du kan välja att inte svara.</p>}
        {stage === "interview" && <p className={styles.smallNote}>{localInterview ? "Frågorna väljs utifrån dina formulärsvar. Din egen beskrivning fyller inte i några symtom automatiskt." : "Frågorna anpassas efter din beskrivning och dina bekräftade svar. Texten fyller inte automatiskt i några symtom."} Du kan välja ”Vet inte”, gå tillbaka eller avsluta med det underlag som finns.</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {stage === "questions" && !interviewActive && retainedQuestions.length > 0 && <p className={styles.smallNote}>Tidigare besvarade fördjupningsfrågor finns kvar sist i frågeflödet så att du kan granska och ändra dem. Säkerhetsuppgifter tas aldrig bort när du byter fokus.</p>}
        <fieldset className={styles.fieldset} disabled={busy} aria-labelledby="anamnes-question" aria-describedby={currentQuestion.help ? "anamnes-question-help" : undefined}><legend className={styles.srOnly}>Välj svar på frågan</legend><div className={styles.questionOptions}>{currentQuestion.options.map(option => <label className={`${styles.option} ${answers[currentQuestion.id] === option.value ? styles.selected : ""}`} key={`${currentQuestion.id}-${option.value}`}><input type="radio" name={`anamnes-${currentQuestion.id}`} value={option.value} checked={answers[currentQuestion.id] === option.value} onChange={() => updateAnswer(currentQuestion, option.value)} /><span>{option.label}</span></label>)}</div></fieldset>
        <details key={`clarification-${currentQuestion.id}`} className={`${styles.reportDetails} ${styles.questionClarification}`} open={!!questionNote || undefined}><summary>Vill du förtydliga ditt svar? · valfritt</summary><div className={styles.detailFields}><label htmlFor={`anamnes-note-${currentQuestion.id}`}>Beskriv med egna ord<textarea id={`anamnes-note-${currentQuestion.id}`} value={questionNote} maxLength={questionNoteLimit} rows={3} disabled={busy} autoComplete="off" aria-describedby="anamnes-question-note-help" placeholder="Till exempel om flera alternativ stämmer eller om något viktigt saknas" onChange={event => updateConsultation({ questionNotes: { ...consultation.questionNotes, [currentQuestion.id]: event.target.value } })} /></label><p id="anamnes-question-note-help" className={styles.smallNote}>{questionNote.length} av {questionNoteLimit} tecken. Texten räknas inte som poäng. {interviewActive && !localInterview ? "AI kan använda den för att välja följdfrågor." : "Texten finns med i underlaget för behandlaren."}</p></div></details>
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={previous}><ArrowLeft size={16} aria-hidden="true" />Tillbaka</button><button type="button" className={styles.primary} disabled={busy} onClick={next}>{busy ? "Bearbetar svaren…" : index + 1 === currentQuestions.length ? interviewActive ? "Ta fram nästa frågor" : stage === "followup" ? "Visa rapport" : "Gå vidare till analys" : "Nästa fråga"}<ArrowRight size={16} aria-hidden="true" /></button></div>
        {interviewActive && <div className={styles.editActions}><button type="button" disabled={busy} onClick={() => void advanceInterview(true)}>Avsluta och visa underlaget nu</button></div>}
        <details className={styles.reportDetails}><summary>Din beskrivning – komplettera vid behov</summary>{narrativeEditor()}<ConsultationDetailsFields value={consultation} disabled={busy} onChange={updateConsultation} /></details>
      </section>}
      {stage === "report" && report && <section className={!submission && config.submissions.available && report.safety.level !== "emergency" ? styles.reportAwaitingSend : undefined}>
        <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>{report.safety.level === "emergency" ? answers.emergency === "yes" ? "Avbryt formuläret och sök vård" : "Varningsuppgifter i beskrivningen" : submission ? "Din anamnes är skickad" : "Din anamnes är klar"}</h2>
        {report.safety.level === "emergency" ? <><div className={styles.alert} role="alert"><strong>Uppgifterna behöver förtydligas innan anamnesen fortsätter.</strong>{report.safety.flags.map((flag, index) => <p key={index}>{flag}</p>)}<p>Ring 112 vid ett akut nödläge. Fortsätt inte formuläret för att försöka förklara akuta symtom med TCM.</p></div><a href="tel:112" className={styles.primary}>Ring 112 vid nödläge</a>{answers.emergency !== "yes" && <div className={styles.editActions}><button type="button" onClick={() => { setStage("intro"); setReport(null); clearStatus(); }}>Gå tillbaka och förtydliga beskrivningen</button></div>}</> : <>
          <AnamnesReport report={report} answers={answers} medicationNames={medicationNames} consultation={consultation} beforeAnalysis={
            <AnamnesSubmissionPanel config={config.submissions} contact={contact} onContactChange={setContact}
              accepted={!!config.submissions.consentVersion && sendConsentVersion === config.submissions.consentVersion}
              onAccepted={accepted => setSendConsentVersion(accepted ? config.submissions.consentVersion! : null)}
              onSubmit={sendToTherapist} busy={busy} error={submissionError} submission={submission} source={report.source} hasReceipt={!!receipt} onCopy={copySummary} copied={copied}
              preview={<>{narrative.trim() && <><h4>Din egen beskrivning</h4><p>{narrative.trim()}</p></>}{hasConsultationDetails(consultation) && <><h4>Dina kompletteringar</h4><p>{consultationDetailsText(consultation)}</p></>}{answers.medication === "yes" && medicationNames.trim() && <><h4>Läkemedel och kosttillskott</h4><p>{medicationNames.trim()}</p></>}<p>Även dina {Object.keys(answers).length} valda svar och rapporten följer med. Du kan granska dem i underlaget på resultatsidan.</p></>}
            />
          } />
          {(notice || sessionNotice) && <details className={styles.reportDetails}><summary>Om frågeflödet och analysen</summary>{notice && <p>{notice}</p>}{sessionNotice && <p>{sessionNotice}</p>}</details>}
          {narrative.trim() && <details className={styles.reportDetails}><summary>Din egen beskrivning</summary><p className={styles.narrativeText}>{narrative.trim()}</p></details>}
          {hasConsultationDetails(consultation) && <details className={styles.reportDetails}><summary>Dina kompletteringar inför samtalet</summary><p className={styles.narrativeText}>{consultationDetailsText(consultation)}</p></details>}
          {completionQuestions.length > 0 && <div className={styles.completionPanel}><p>Vill du förtydliga resultatet? Dina tidigare svar finns kvar.</p><button type="button" className={styles.secondary} disabled={busy} onClick={complementReport}>Komplettera underlaget<ArrowRight size={16} aria-hidden="true" /></button></div>}
          <details className={styles.summaryPanel}><summary>Kopiera eller granska sammanfattningen</summary><label className={styles.summaryLabel} htmlFor="anamnes-summary">Din sammanfattning</label><textarea id="anamnes-summary" className={styles.summaryText} readOnly value={summary} rows={12} spellCheck={false} /><div className={styles.actions}><button type="button" className={styles.secondary} onClick={copySummary}><Clipboard size={16} aria-hidden="true" />{copied ? "Kopierad" : "Kopiera sammanfattning"}</button></div>{copied && <p className={styles.copyStatus} role="status">Sammanfattningen kopierades. Den innehåller hälsouppgifter; välj själv hur du delar den.</p>}</details>
          {!submission && draftPanel && <details className={styles.reportDetails}><summary>Om ditt sparade utkast</summary>{draftPanel}</details>}
          <div className={styles.consultation}><Sparkles size={24} aria-hidden="true" /><div><h3>Boka ditt samtal</h3><p>{submission ? "Ditt underlag är skickat. Välj en tid för individuell bedömning." : "Bokningen skickar inte din anamnes automatiskt. Skicka den separat ovan eller ta med din sammanfattning."}</p><Link href="/boka" className={styles.primary} prefetch={false}>Boka konsultation<ArrowRight size={16} aria-hidden="true" /></Link></div></div>
          <div className={styles.editActions}><button type="button" disabled={busy} onClick={() => { setAiConsentVersion(null); setInterviewActive(false); setReviewingAnswers(true); setStage("safety"); setIndex(0); clearStatus(); }}>Gå igenom och ändra svar</button><button type="button" disabled={busy} onClick={() => { setStage("intro"); clearStatus(); }}>Ändra beskrivning och analysinställningar</button></div>
        </>}
      </section>}
      {(consultation.confirmedObservations?.length??0)>0 && stage!=="intro" && <details className={styles.reportDetails}><summary>Svar från din berättelse som du bekräftat ({consultation.confirmedObservations!.length})</summary>{consultation.confirmedObservations!.map(origin=>{const question=questionById.get(origin.questionId)!;return <div className={styles.notice} key={origin.questionId}><label>{question.prompt}<select disabled={busy} value={answers[origin.questionId]??''} onChange={event=>updateAnswer(question,event.target.value)}>{question.options.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select></label><p>Från din text: ”{origin.excerpt}”</p><button type="button" disabled={busy} className={styles.secondary} onClick={()=>{const value=removeConfirmedObservation(answers,consultation,origin.questionId);setAnswers(value.answers);setConsultation(value.consultation);setReport(null);setLocalInterview(true);setAiConsentVersion(null);clearStatus();setStage('safety');}}>Ta bort tolkningen</button></div>;})}</details>}
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
      {stage !== "intro" && <div className={styles.editActions}><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Rensa svar och börja om</button></div>}
      <details className={styles.reportDetails}><summary>Om anamnesen och säkerhet</summary><p>Modellen är inte kliniskt validerad. Den kan missa viktiga symtom eller förklaringar. Du får ingen diagnos, örtordination, dosering eller rekommendation att köpa en produkt. Sök vård vid nya, tilltagande eller allvarliga besvär.</p><div className={styles.sources}><a href="https://www.1177.se/undersokning-behandling/fler-behandlingar/alternativa-behandlingar/vaxtbaserade-lakemedel-och-naturlakemedel/" target="_blank" rel="noopener noreferrer">1177 – växtbaserade läkemedel ↗</a><a href="https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know" target="_blank" rel="noopener noreferrer">NCCIH – traditionell kinesisk medicin ↗</a><Link href="/integritet" prefetch={false}>Integritetsinformation</Link></div></details>
    </div>
  </div>;
}
