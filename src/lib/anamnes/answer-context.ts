import type { AnswerMap, QuestionId } from './types';

// Only logically equivalent, explicitly selected structured options may cover
// a narrower question. Free text is never read here or turned into answers.
export function effectiveAnswer(answers: AnswerMap, id: QuestionId): { questionId: QuestionId; value: string } | null {
  if (Object.hasOwn(answers,id)) return {questionId:id,value:answers[id]!};
  if (id === 'sleepOnset' && answers.sleep === 'difficulty') return {questionId:'sleep',value:'yes'};
  if (id === 'nightWaking' && answers.sleep === 'waking') return {questionId:'sleep',value:'yes'};
  if (['sleepOnset','nightWaking'].includes(id) && answers.sleep === 'normal') return {questionId:'sleep',value:'no'};
  if (id === 'nightSweats' && answers.sweating === 'night') return {questionId:'sweating',value:'yes'};
  return null;
}

export function questionCovered(answers: AnswerMap, id: QuestionId): boolean {
  return effectiveAnswer(answers,id) !== null;
}

export function questionRelevant(answers: AnswerMap, id: QuestionId): boolean {
  if (answers.focus !== 'pain' && answers.pain === 'no' && ['painLocation','painCharacter','painWarmth','painMovement','weatherPain','jointWarmth','stiffness'].includes(id)) return false;
  if (answers.sleep === 'normal' && ['sleepOnset','nightWaking','dreams'].includes(id)) return false;
  if (answers.stool === 'normal' && id === 'stoolOdor') return false;
  return true;
}
