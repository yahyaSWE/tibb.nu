import { safetyQuestionIds } from './engine';
import { baseQuestionIds, getInitialQuestions, questionById, validateAnswers } from './questions';
import { InterviewRoundSchema, type AnswerMap, type PatternAnalysis, type QuestionId, type Report } from './types';

export const INTERVIEW_MAX_ROUNDS = 5;
export const mandatoryInterviewQuestions: readonly QuestionId[] = ['emergency','clinicalRedFlags','adult','pregnancy','medication','chronicDisease','liverKidney','allergy'];
export const mandatoryInterviewBackgroundQuestions: readonly QuestionId[] = ['focus','duration','trend','priorAssessment'];
const backgroundIds: readonly QuestionId[] = [...mandatoryInterviewBackgroundQuestions,'onset'];
const undecided = new Set(['unknown','prefer_not']);
const isKnown = (answers: AnswerMap, id: QuestionId) => Object.hasOwn(answers,id) && !undecided.has(answers[id]!);

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
export function sanitizeInterviewQuestionIds(ids: readonly unknown[], input: AnswerMap): QuestionId[] {
  const answers = validateAnswers(input);
  const pendingSafety = getPendingInterviewSafetyQuestions(answers);
  // A model or stale client cannot skip the fixed safety questions.
  if (pendingSafety.length) return pendingSafety.slice(0,3);
  const unique = new Set<QuestionId>();
  for (const id of [...getPendingInterviewBackgroundQuestions(answers),...ids]) {
    if (typeof id !== 'string') continue;
    const question = questionById.get(id as QuestionId);
    if (question && !question.professionalOnly && !Object.hasOwn(answers,question.id)) unique.add(question.id);
    if (unique.size === 3) break;
  }
  return [...unique];
}

/** Independent minimum prevents the model declaring an almost empty interview sufficient. */
export function interviewHasEnoughAnswers(input: AnswerMap): boolean {
  const answers = validateAnswers(input);
  const safetyClear = answers.adult === 'yes' && safetyQuestionIds.filter(id => id !== 'adult').every(id => answers[id] === 'no');
  if (!safetyClear || !mandatoryInterviewBackgroundQuestions.every(id => isKnown(answers,id))) return false;
  const symptomIds = Object.keys(answers).filter(id => !safetyQuestionIds.includes(id as QuestionId) && !backgroundIds.includes(id as QuestionId));
  return symptomIds.filter(id => isKnown(answers,id as QuestionId)).length >= 6;
}

/** Round 0..4 may ask one batch; round 5 always produces the current, possibly incomplete, report. */
export function interviewReachedLimit(round: number): boolean {
  return InterviewRoundSchema.parse(round) === INTERVIEW_MAX_ROUNDS;
}

/** Stopping early cannot turn an unfinished interview into a confident report. */
export function finalizeInterviewReport(report: Report, input: AnswerMap): Report {
  const answers = validateAnswers(input);
  if (interviewHasEnoughAnswers(answers)) return {...report,followUpQuestionIds:[]};
  const missingBackground = mandatoryInterviewBackgroundQuestions.filter(id => !isKnown(answers,id));
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

/** Local fallback uses the same question bank without manufacturing symptoms from free text. */
export function getInterviewFallbackQuestions(input: AnswerMap, analysis: PatternAnalysis): QuestionId[] {
  const answers = validateAnswers(input);
  const pendingSafety = getPendingInterviewSafetyQuestions(answers);
  if (pendingSafety.length) return pendingSafety.slice(0,3);
  const initial = getInitialQuestions(answers).map(question => question.id);
  const focused = initial.filter(id => !baseQuestionIds.includes(id));
  const missingForPatterns = analysis.patterns.slice(0,4).flatMap(pattern => pattern.missingQuestionIds);
  return sanitizeInterviewQuestionIds([...backgroundIds,...focused,...missingForPatterns,...initial,'temperature','thirst','sweating','energy','appetite','stool','sleep','emotion','pain'],answers);
}
