import { z } from 'zod';
import { isPublicQuestion, questionById } from './questions';
import { QuestionIdSchema, type AnswerMap, type ConsultationDetails, type QuestionId } from './types';
import { consultationForAi } from './consultation';
import { questionCovered } from './answer-context';

const safetyIds=new Set(['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags']);
const SourceSchema=z.enum(['narrative','locations','dailyImpact','goal','previousCare','lifestyle','questionNote']);
export const ExtractionObservationSchema=z.object({
  questionId:QuestionIdSchema,answer:z.string().min(1).max(60).nullable(),certainty:z.enum(['explicit','uncertain']),
  polarity:z.enum(['affirmed','denied','unknown']),
  evidence:z.array(z.object({source:SourceSchema,sourceQuestionId:QuestionIdSchema.nullable(),excerpt:z.string().trim().min(1).max(300)}).strict()).min(1).max(3),
}).strict();
export const AiExtractionSchema=z.object({observations:z.array(ExtractionObservationSchema).max(20)}).strict();
export type ExtractionObservation=z.infer<typeof ExtractionObservationSchema>;
export type ObservationDecision={questionId:QuestionId;answer:string;use:boolean};

export function observationQuestionAllowed(id:QuestionId):boolean {
  const question=questionById.get(id);
  return !!question&&isPublicQuestion(question)&&!safetyIds.has(id);
}
export function extractionSourceTexts(narrative:string,consultation:ConsultationDetails) {
  const details=consultationForAi(consultation);
  return {narrative,locations:details.locations,dailyImpact:details.dailyImpact,goal:details.goal,previousCare:details.previousCare,lifestyle:details.lifestyle,
    questionNotes:details.questionNotes};
}
/** Quoted user text is evidence of what was written, never confirmation of a finding. */
export function validateExtractedObservations(input:unknown,answers:AnswerMap,narrative:string,consultation:ConsultationDetails):ExtractionObservation[] {
  const parsed=AiExtractionSchema.parse(input);
  const sources=extractionSourceTexts(narrative,consultation);
  const collected=new Map<QuestionId,ExtractionObservation>();
  for(const proposal of parsed.observations){
    if(!observationQuestionAllowed(proposal.questionId)||questionCovered(answers,proposal.questionId))continue;
    const question=questionById.get(proposal.questionId)!;
    if(proposal.answer!==null&&!question.options.some(option=>option.value===proposal.answer))continue;
    const evidence=proposal.evidence.filter(item=>{
      if(item.source!=='questionNote'&&item.sourceQuestionId!==null)return false;
      const original=item.source==='questionNote'?(item.sourceQuestionId&&!safetyIds.has(item.sourceQuestionId)?sources.questionNotes[item.sourceQuestionId]:''):sources[item.source];
      return !!original&&original.includes(item.excerpt)&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(item.excerpt);
    });
    if(!evidence.length)continue;
    const value={...proposal,evidence,answer:proposal.certainty==='uncertain'||proposal.polarity==='unknown'?null:proposal.answer};
    const previous=collected.get(value.questionId);
    if(previous){
      const same=previous.answer===value.answer;
      collected.set(value.questionId,{...previous,answer:same?previous.answer:null,certainty:same?previous.certainty:'uncertain',polarity:same?previous.polarity:'unknown',
        evidence:[...previous.evidence,...value.evidence].filter((item,index,all)=>all.findIndex(other=>other.source===item.source&&other.sourceQuestionId===item.sourceQuestionId&&other.excerpt===item.excerpt)===index).slice(0,3)});
    }else collected.set(value.questionId,value);
  }
  return [...collected.values()];
}

/** Only this explicit patient decision joins the ordinary AnswerMap. No model result is scored here. */
export function confirmObservations(answers:AnswerMap,consultation:ConsultationDetails,proposals:readonly ExtractionObservation[],decisions:readonly ObservationDecision[]) {
  const next={...answers};
  const origins=[...(consultation.confirmedObservations??[])];
  const seen=new Set<QuestionId>();
  const narrower=new Set(['sleepOnset','nightWaking','nightSweats']);
  for(const decision of [...decisions].sort((a,b)=>Number(narrower.has(a.questionId))-Number(narrower.has(b.questionId)))){
    if(!decision.use||seen.has(decision.questionId)||questionCovered(next,decision.questionId)||!observationQuestionAllowed(decision.questionId))continue;
    const proposal=proposals.find(item=>item.questionId===decision.questionId);
    const question=questionById.get(decision.questionId)!;
    if(!proposal||!question.options.some(option=>option.value===decision.answer))continue;
    seen.add(decision.questionId);next[decision.questionId]=decision.answer;
    origins.push({questionId:decision.questionId,answer:decision.answer,excerpt:proposal.evidence[0].excerpt,source:proposal.evidence[0].source,sourceQuestionId:proposal.evidence[0].sourceQuestionId,corrected:proposal.answer!==decision.answer});
  }
  return {answers:next,consultation:{...consultation,confirmedObservations:origins.slice(0,40)}};
}
export function removeConfirmedObservation(answers:AnswerMap,consultation:ConsultationDetails,id:QuestionId) {
  const next={...answers};
  const origin=consultation.confirmedObservations?.find(item=>item.questionId===id);
  if(origin&&next[id]===origin.answer)delete next[id];
  return {answers:next,consultation:{...consultation,confirmedObservations:(consultation.confirmedObservations??[]).filter(item=>item.questionId!==id)}};
}
