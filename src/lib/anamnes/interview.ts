import { getSafetyAssessment, safetyQuestionIds } from './engine';
import { patternById } from './patterns';
import { baseQuestionIds, getInitialQuestions, isPublicQuestion, questionById, validateAnswers } from './questions';
import { type AnswerMap, type FormulaRecord, type PatternAnalysis, type QuestionId, type Report } from './types';

export const mandatoryInterviewQuestions: readonly QuestionId[] = ['emergency','clinicalRedFlags','adult','pregnancy','medication','chronicDisease','liverKidney','allergy'];
export const mandatoryInterviewBackgroundQuestions: readonly QuestionId[] = ['focus','duration','onset','trend'];
export const coreInterviewQuestions: readonly QuestionId[] = ['temperature','energy','sleep','appetite','stool','thirst','sweating','emotion','pain'];
const backgroundIds: readonly QuestionId[] = [...mandatoryInterviewBackgroundQuestions,'priorAssessment'];
const undecided = new Set(['unknown','prefer_not']);
const isKnown = (answers: AnswerMap, id: QuestionId) => Object.hasOwn(answers,id) && !undecided.has(answers[id]!);
const focusedPainQuestionIds: readonly QuestionId[] = ['painLocation','painCharacter','painMovement','weatherPain','painWarmth','jointWarmth','stiffness'];

/** Do not automatically end a pain interview before its focused safety discriminator. */
export function interviewHasCompletedFocusQuestions(input: AnswerMap): boolean {
  const answers = validateAnswers(input);
  return answers.focus !== 'pain' || focusedPainQuestionIds.every(id => Object.hasOwn(answers,id)) && isKnown(answers,'jointWarmth');
}

/** A skipped/unknown answer is complete for navigation, but is never a clear clinical answer. */
export function getPendingInterviewSafetyQuestions(input: AnswerMap): QuestionId[] {
  const answers = validateAnswers(input);
  return mandatoryInterviewQuestions.filter(id => !Object.hasOwn(answers,id));
}
export function getPendingInterviewBackgroundQuestions(input: AnswerMap): QuestionId[] {
  const answers = validateAnswers(input);
  return mandatoryInterviewBackgroundQuestions.filter(id => !Object.hasOwn(answers,id));
}

/** Curated IDs only; never repeat answered/withheld questions or expose professional pulse assessment. */
export function sanitizeInterviewQuestionIds(ids: readonly unknown[], input: AnswerMap, analysis?: PatternAnalysis, options: { allowNarrativeQuestions?: boolean } = {}): QuestionId[] {
  const answers = validateAnswers(input);
  const pendingSafety = getPendingInterviewSafetyQuestions(answers);
  // A model or stale client cannot skip the fixed safety questions.
  if (pendingSafety.length) return pendingSafety.slice(0,3);
  // A narrative may point to a different part of the reviewed question bank
  // before any structured symptom supports a local hypothesis. Let AI ask
  // those questions, without counting the narrative as a confirmed answer.
  const meaningful = analysis && !options.allowNarrativeQuestions ? new Set(remainingInterviewQuestionIds(answers,analysis)) : null;
  const unique = new Set<QuestionId>();
  const pendingPainSafety: QuestionId[] = analysis && answers.focus === 'pain' && !Object.hasOwn(answers,'jointWarmth') && analysis.patterns.some(pattern => pattern.qualified) ? ['jointWarmth'] : [];
  for (const id of [...getPendingInterviewBackgroundQuestions(answers),...pendingPainSafety,...ids]) {
    if (typeof id !== 'string') continue;
    const question = questionById.get(id as QuestionId);
    if (question && isPublicQuestion(question) && !Object.hasOwn(answers,question.id) && (!meaningful || meaningful.has(question.id))) unique.add(question.id);
    if (unique.size === 3) break;
  }
  return [...unique];
}

/** Unknown/withheld background is a response, but never evidence of a clinical finding. */
export function interviewHasEnoughAnswers(input: AnswerMap): boolean {
  const answers = validateAnswers(input);
  const safetyClear = getSafetyAssessment(answers).level === 'clear';
  if (!safetyClear || getPendingInterviewBackgroundQuestions(answers).length) return false;
  const symptomIds = Object.keys(answers).filter(id => !safetyQuestionIds.includes(id as QuestionId) && !backgroundIds.includes(id as QuestionId));
  return symptomIds.filter(id => isKnown(answers,id as QuestionId)).length >= 6;
}

/** Completion follows content coverage rather than a count of question batches. */
export function interviewHasCoreCoverage(answers: AnswerMap): boolean {
  return coreInterviewQuestions.every(id => Object.hasOwn(answers,id));
}

/** Stopping early cannot turn an unfinished interview into a confident report. */
export function finalizeInterviewReport(report: Report, input: AnswerMap): Report {
  const answers = validateAnswers(input);
  if (interviewHasEnoughAnswers(answers)) return {...report,followUpQuestionIds:[]};
  const missingBackground = getPendingInterviewBackgroundQuestions(answers);
  return {
    ...report,
    analysis: {
      ...report.analysis,status:'insufficient',primary:null,secondary:[],zangFu:[],
      missingQuestionIds:[...new Set([...report.analysis.missingQuestionIds,...missingBackground])],
    },
    formulaMatches:[],
    formulaStatus: !report.formulaReferencesEnabled ? 'disabled' : report.safety.blocksFormulas ? 'safety_blocked' : 'insufficient',
    followUpQuestionIds:[],
  };
}

function remainingInterviewQuestionIds(input: AnswerMap, analysis: PatternAnalysis): QuestionId[] {
  const answers = validateAnswers(input);
  const pendingSafety = getPendingInterviewSafetyQuestions(answers);
  if (pendingSafety.length) return pendingSafety;
  // Safety-sensitive cases can still provide a local history. Only acute
  // danger stops intake; external AI and formula gates remain separate.
  if (getSafetyAssessment(answers).level === 'emergency') return [];
  const initial = getInitialQuestions(answers).map(question => question.id);
  // Pain characteristics and the warm/swollen-joint safety check are more
  // useful initially than a tongue observation or an assumed deficiency.
  const focused: readonly QuestionId[] = answers.focus === 'pain'
    ? [...(analysis.patterns.some(pattern => pattern.qualified) ? ['jointWarmth' as const] : []),...focusedPainQuestionIds,...(answers.painLocation === 'back_knees' ? ['backWeakness' as const] : [])]
    : initial.filter(id => !baseQuestionIds.includes(id));
  const feasible = analysis.patterns.filter(finding => {
    const definition = patternById.get(finding.id)!;
    // A known mismatch of a mandatory core cannot be repaired by collecting
    // unrelated supporting points. Unknown/withheld answers are not mismatches.
    return finding.supporting.some(item => !backgroundIds.includes(item.questionId))
      && definition.coreRules.every(rule => !isKnown(answers,rule.questionId) || rule.values.includes(answers[rule.questionId]!))
      && finding.opposing.reduce((sum,item) => sum + item.weight,0) < 5;
  });
  const missingForPatterns = feasible.slice(0,4).flatMap(finding => {
    const definition = patternById.get(finding.id)!;
    return [...definition.coreRules.map(rule => rule.questionId),...definition.requiredQuestionIds,...(!finding.qualified ? definition.supportingRules.map(rule => rule.questionId) : [])];
  });
  // Retain a general TCM picture even when six specific symptoms are already
  // known. Do not walk the whole bank after useful questions run out.
  const general = coreInterviewQuestions;
  return [...new Set([...getPendingInterviewBackgroundQuestions(answers),...focused,...missingForPatterns,...general])].filter(id => {
    const question = questionById.get(id);
    return question && isPublicQuestion(question) && !Object.hasOwn(answers,id);
  });
}

/** Meaningful, unseen follow-ups for both the interview and optional report completion. */
export function getInterviewCompletionQuestionIds(input: AnswerMap, analysis: PatternAnalysis): QuestionId[] {
  return remainingInterviewQuestionIds(input,analysis).slice(0,5);
}

/** Clarify a reference only after the independent differential supports it. */
export function getFormulaComparisonQuestionIds(input: AnswerMap, analysis: PatternAnalysis, catalog: readonly FormulaRecord[]): QuestionId[] {
  const answers = validateAnswers(input);
  if (getSafetyAssessment(answers).level !== 'clear' || analysis.status !== 'preliminary' || !analysis.primary) return [];
  const qualified = new Set(analysis.patterns.filter(pattern => pattern.qualified).map(pattern => pattern.id));
  const candidates = catalog.filter(formula => formula.active && formula.primaryPatternIds.includes(analysis.primary!.id) && formula.requiredPatternIds.every(id => qualified.has(id))).slice(0,3);
  // Ask about counterevidence as well as support. A missing answer stays
  // missing; neither catalog membership nor a question creates a match.
  return [...new Set(candidates.flatMap(formula => [...formula.requiredQuestionIds,...formula.opposingRules.map(rule => rule.questionId),...formula.supportingRules.map(rule => rule.questionId)]))].filter(id => {
    const question = questionById.get(id);
    return question && isPublicQuestion(question) && !Object.hasOwn(answers,id);
  });
}

/** Local fallback uses the same question bank without manufacturing symptoms from free text. */
export function getInterviewFallbackQuestions(input: AnswerMap, analysis: PatternAnalysis): QuestionId[] {
  return getInterviewCompletionQuestionIds(input,analysis).slice(0,3);
}
