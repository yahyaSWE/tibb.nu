import 'server-only';
import { IntakeRequestSchema, InterviewRequestSchema, InterviewResponseSchema, type InterviewResponse } from './types';
import { validateAnswers } from './questions';
import { canAnalyzePatterns } from './engine';
import { publicFormulaCatalog } from './catalog';
import { anamnesAiConfig } from './config';
import { getAnamnesAnalysisMode } from './settings';
import { createAnalysisReceipt } from './ai';
import { normalizeConsultationDetails } from './consultation';
import { buildVisitorDifferential, visitorDifferentialCase, pendingDifferentialSafetyQuestions, visitorSafety } from './public-differential';
import { requestVisitorProposal } from './lab/provider';

export async function interviewDifferential(input:unknown):Promise<InterviewResponse> {
  const answers=validateAnswers(input&&typeof input==='object'?(input as Record<string,unknown>).answers:undefined);
  const value=InterviewRequestSchema.parse(input);
  const consultation=normalizeConsultationDetails(value.consultation,answers),intake={...value,answers,consultation};
  const catalog=await publicFormulaCatalog(),config=anamnesAiConfig();
  const deferredForSafety=pendingDifferentialSafetyQuestions(intake).length>0;
  const permitted=!deferredForSafety&&value.aiConsent&&value.aiConsentVersion===config.consentVersion&&config.available&&await getAnamnesAnalysisMode()==='ai'&&canAnalyzePatterns(visitorSafety(intake));
  let proposal=null;
  if(permitted) {
    try {proposal=await requestVisitorProposal({...visitorDifferentialCase(intake,value.finalize),aiConsent:true,consentVersion:config.consentVersion});}
    catch { /* Fixed diagnostics are emitted by the provider. No intake text is logged. */ }
  }
  const {report,result}=buildVisitorDifferential(intake,catalog,proposal,proposal?'ai':'local',value.finalize);
  const complete=value.finalize||result.status!=='continue';
  const receipt=complete?createAnalysisReceipt(answers,report,value.narrative,consultation):null;
  return InterviewResponseSchema.parse({report,questionIds:complete?[]:result.questions.map(q=>q.topicId),
    questionPrompts:complete?{}:Object.fromEntries(result.questions.map(q=>[q.topicId,q.prompt])),complete,
    reason:result.status==='safety_stop'?'safety':!proposal&&value.aiConsent&&!deferredForSafety?'fallback':complete?(result.status==='ready_for_review'?'enough':'exhausted'):'continue',...(receipt?{receipt}:{})});
}
export async function analyzeDifferential(input:unknown) {
  const value=IntakeRequestSchema.parse(input);
  const result=await interviewDifferential({...value,round:0,finalize:true});
  return {report:result.report,...(result.receipt?{receipt:result.receipt}:{})};
}
