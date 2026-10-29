import "server-only";
import { IntakeRequestSchema, InterviewRequestSchema, InterviewResponseSchema, ReportSchema, type InterviewResponse } from "./types";
import { validateAnswers, getInitialQuestions } from "./questions";
import { analyzePatterns, buildReport, canAnalyzePatterns, getSafetyAssessment } from "./engine";
import { publicFormulaCatalog } from "./catalog";
import { requestAiDifferential, requestAiInterview, requestAiExtraction, createAnalysisReceipt } from "./ai";
import { validateExtractedObservations } from './observations';
import { getAnamnesConfigStatus } from "./config";
import { getAnamnesAnalysisMode } from "./settings";
import { hasAiConsultationDetails, normalizeConsultationDetails } from "./consultation";
import { finalizeInterviewReport, getFormulaComparisonQuestionIds, getInterviewCompletionQuestionIds, getInterviewDecision, getInterviewFallbackQuestions, interviewHasCompletedFocusQuestions, interviewHasEnoughAnswers, mandatoryInterviewQuestions, sanitizeInterviewQuestionIds } from "./interview";
export { analyzeDifferential as analyzeAnamnes, interviewDifferential as interviewAnamnes } from './differential-service';

export async function getPublicAnamnesCatalog() {
  const status = getAnamnesConfigStatus();
  const analysisMode = await getAnamnesAnalysisMode();
  return { formulas: await publicFormulaCatalog(), analysisMode, ai: { available: analysisMode === "ai" && status.ai.available, consentVersion: status.ai.consentVersion, providerLabel: status.ai.providerLabel, privacyNotice: status.ai.privacyNotice }, submissions: { available: status.submissions.available, consentVersion: status.submissions.consentVersion, retentionDays: status.submissions.retentionDays, notice: status.submissions.notice }, referencesEnabled: true as const };
}
export async function analyzeLegacyAnamnes(input: unknown) {
  const answers = validateAnswers(input && typeof input === "object" ? (input as Record<string, unknown>).answers : undefined);
  const value = IntakeRequestSchema.parse(input);
  const consultation = normalizeConsultationDetails(value.consultation, answers);
  const safety = getSafetyAssessment(answers, value.narrative, consultation);
  const analysis = analyzePatterns(answers);
  const catalog = await publicFormulaCatalog();
  // No network calls for incomplete screens or other blocking safety flags. A
  // user's affirmative provider consent is separate from send-to-clinic consent.
  const ready = getInitialQuestions(answers).filter((question) => !question.professionalOnly).every((question) => !!answers[question.id]);
  const consentCurrent = value.aiConsentVersion === getAnamnesConfigStatus().ai.consentVersion;
  const differential = value.aiConsent && consentCurrent && canAnalyzePatterns(safety) && ready ? await requestAiDifferential(answers, analysis, value.narrative, consultation) : null;
  const report = ReportSchema.parse(buildReport(answers, catalog, { narrative: value.narrative, consultation, source: differential ? "ai" : "rules", formulaReferencesEnabled: value.formulaReferencesEnabled, followUpQuestionIds: differential?.followUpQuestionIds, acceptedPatternIds: differential?.patternIds }));
  const receipt = createAnalysisReceipt(answers, report, value.narrative, consultation);
  return receipt ? { report, receipt } : { report };
}
export async function extractAnamnesObservations(input:unknown) {
  const answers=validateAnswers(input&&typeof input==='object'?(input as Record<string,unknown>).answers:undefined);
  const value=IntakeRequestSchema.parse(input);
  const consultation=normalizeConsultationDetails(value.consultation,answers);
  const config=getAnamnesConfigStatus();
  if(!value.aiConsent||value.aiConsentVersion!==config.ai.consentVersion||!canAnalyzePatterns(getSafetyAssessment(answers,value.narrative,consultation))||!config.ai.available||await getAnamnesAnalysisMode()!=='ai')return {observations:[],available:false};
  const proposal=await requestAiExtraction(answers,value.narrative,consultation);
  return {observations:proposal?validateExtractedObservations(proposal,answers,value.narrative,consultation):[],available:!!proposal};
}

export async function interviewLegacyAnamnes(input: unknown): Promise<InterviewResponse> {
  // Validate own enumerable keys before Zod can strip dangerous unknown keys.
  // A crafted AnswerMap must not slip past the public question boundary.
  const answers = validateAnswers(input && typeof input === "object" ? (input as Record<string, unknown>).answers : undefined);
  const value = InterviewRequestSchema.parse(input);
  const consultation = normalizeConsultationDetails(value.consultation, answers);
  const safety = getSafetyAssessment(answers, value.narrative, consultation);
  const analysis = analyzePatterns(answers);
  const catalog = await publicFormulaCatalog();
  const finalRound = value.finalize;
  const ruleReport = ReportSchema.parse(buildReport(answers, catalog, { narrative: value.narrative, consultation, formulaReferencesEnabled: value.formulaReferencesEnabled }));
  const result = (questionIds: InterviewResponse["questionIds"], complete: boolean, reason: InterviewResponse["reason"], report = ruleReport): InterviewResponse => {
    const nextQuestions = complete ? [] : questionIds;
    const finalReport = complete ? finalizeInterviewReport(report, answers) : report;
    return InterviewResponseSchema.parse({ report: { ...finalReport, followUpQuestionIds: nextQuestions }, questionIds: nextQuestions, complete, reason });
  };
  // Both structured answers and free text are screened before any external
  // request. Missing/uncertain safety answers do not authorize sending data.
  if (!canAnalyzePatterns(safety)) {
    const unansweredSafety = mandatoryInterviewQuestions.filter((id) => !answers[id]).slice(0, 3);
    return result(unansweredSafety, finalRound || unansweredSafety.length === 0 || safety.level !== "incomplete", "safety");
  }
  const enough = interviewHasEnoughAnswers(answers);
  if (finalRound && !enough) return result([], true, "enough");
  const config = getAnamnesConfigStatus();
  const permitted = value.aiConsent && value.aiConsentVersion === config.ai.consentVersion && config.ai.available && await getAnamnesAnalysisMode() === "ai";
  const referenceQuestions = () => value.formulaReferencesEnabled ? getFormulaComparisonQuestionIds(answers,analysis,catalog) : [];
  // Administrator-added safety rules must be clarified in local mode too;
  // their absence cannot be treated as permission to match a product.
  const fallbackQuestions = () => [...new Set([...getInterviewFallbackQuestions(answers,analysis),...referenceQuestions()])].slice(0,3);
  if (!permitted) {
    const next = finalRound ? [] : fallbackQuestions();
    return result(next, finalRound || next.length === 0, "fallback");
  }
  const decision=getInterviewDecision(answers,analysis);
  // A model cannot prolong an exhausted history with unrelated confirmations.
  // Reference safety rules remain downstream of the independent differential.
  if(!finalRound&&decision.shouldStop&&referenceQuestions().length===0)return result([],true,decision.reason==='supported'?'enough':'exhausted');
  const differential = await requestAiInterview(answers, analysis, value.narrative, consultation);
  if (!differential) {
    const next = finalRound ? [] : fallbackQuestions();
    return result(next, finalRound || next.length === 0, "fallback");
  }
  // Only an explicit visitor stop can close an unfinished interview. A model
  // confidence signal cannot skip relevant unanswered reviewed questions.
  const remaining = getInterviewCompletionQuestionIds(answers,analysis);
  const allowedQuestions=new Set(decision.rankedQuestions.map(question=>question.questionId));
  // Before a differential has emerged the story can identify a different area
  // of the bank. Later batches must concentrate on the shortlisted criteria.
  const narrativeDiscovery=decision.candidatePatternIds.length<2&&decision.answeredSymptomCount<15&&(!!value.narrative||hasAiConsultationDetails(consultation));
  const curatedIds = sanitizeInterviewQuestionIds(differential.questionIds.filter(id=>narrativeDiscovery||allowedQuestions.has(id)), answers, analysis, { allowNarrativeQuestions: narrativeDiscovery });
  const comparisonIds = referenceQuestions();
  const hasQualifiedPattern = differential.patternIds.length > 0 && analysis.patterns.some(pattern => pattern.qualified);
  // A provider's generic confidence must not close an empty report while the
  // independent rules still have meaningful discriminators to ask about.
  const exhausted = remaining.length === 0 && curatedIds.length === 0 && comparisonIds.length === 0;
  const focusCompleted = interviewHasCompletedFocusQuestions(answers);
  const complete = finalRound || exhausted;
  // Even a valid model answer cannot close the interview without a minimum
  // confirmed history. Empty/answered/professional choices fall back to known
  // unanswered public questions and are never turned into invented answers.
  // Formula criteria enter only once the independent history is sufficient;
  // until then the narrative and differential drive the interview. This
  // server-side comparison includes opposing findings and no product bias is
  // added to the model prompt. Pain safety questions retain priority.
  const clarifyReference = differential.sufficient && enough && hasQualifiedPattern && focusCompleted && comparisonIds.length > 0;
  const nextIds = clarifyReference ? comparisonIds : curatedIds.length ? curatedIds : [...getInterviewFallbackQuestions(answers, analysis),...comparisonIds];
  const questionIds = complete ? [] : [...new Set(nextIds)].slice(0,3);
  const currentReport = ReportSchema.parse({ ...buildReport(answers, catalog, { narrative: value.narrative, consultation, source: "ai", formulaReferencesEnabled: value.formulaReferencesEnabled, acceptedPatternIds: differential.patternIds, followUpQuestionIds: questionIds }), followUpQuestionIds: questionIds });
  const report = complete ? finalizeInterviewReport(currentReport, answers) : currentReport;
  // Only a completed interview may authenticate a report for clinic storage.
  // Intermediate hypotheses are working state, not a signed final original.
  const receipt = complete ? createAnalysisReceipt(answers, report, value.narrative, consultation) : null;
  return InterviewResponseSchema.parse({ report, questionIds, complete, reason: exhausted && !hasQualifiedPattern ? "exhausted" : complete ? "enough" : "continue", ...(receipt ? { receipt } : {}) });
}
