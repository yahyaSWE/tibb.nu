import { buildDifferentialResult, labComplaint, type DifferentialCase, type LabProposal } from './lab/engine';
import { labVersion } from './lab/library';
import { buildReport, getSafetyAssessment, canAnalyzePatterns, safetyQuestionIds } from './engine';
import { consultationForAi, normalizeConsultationDetails } from './consultation';
import { questionById } from './questions';
import { ReportSchema, type AnswerMap, type ConsultationDetails, type Evidence, type FormulaRecord, type QuestionId } from './types';

type Intake={answers:AnswerMap;narrative:string;consultation:ConsultationDetails;formulaReferencesEnabled?:boolean};
export function pendingDifferentialSafetyQuestions(value:Intake):QuestionId[] {
  const pain=value.answers.focus==='pain'||value.answers.pain==='yes'||['muscles','joints','back'].includes(value.answers.painLocation??'')||/\b(?:ledvärk|ledsmärta|knä|knän|rygg|nacke|nacken|axlar|axlarna|muskelvärk)\b/iu.test(value.narrative);
  return pain&&!Object.hasOwn(value.answers,'jointWarmth')?['jointWarmth']:[];
}
export function visitorSafety(value:Intake) {
  const safety=getSafetyAssessment(value.answers,value.narrative,value.consultation);
  if(['clear','medication_review'].includes(safety.level)&&['unknown','prefer_not'].includes(value.answers.jointWarmth??''))return {
    ...safety,level:'incomplete' as const,blocksFormulas:true,missingQuestionIds:[...safety.missingQuestionIds,'jointWarmth' as const],flags:[...safety.flags,'Uppgiften om en röd, varm eller svullen led är osäker och behöver klargöras vid konsultationen.']};
  return safety;
}
export function visitorDifferentialCase(value:Intake,finalize=false):DifferentialCase {
  const consultation=normalizeConsultationDetails(value.consultation,value.answers);
  return {narrative:value.narrative,context:JSON.stringify(consultationForAi(consultation)),
    safety:Object.fromEntries(safetyQuestionIds.map(id=>[id,value.answers[id]??'unknown'])) as DifferentialCase['safety'],
    entries:Object.entries(value.answers).filter(([id])=>id!=='pulse'&&id!=='priorAssessment'&&!safetyQuestionIds.includes(id as QuestionId)).map(([topicId,answer])=>({topicId,value:answer!,note:consultation.questionNotes[topicId as keyof typeof consultation.questionNotes]??''})),
    finalize,aiConsent:false,consentVersion:null};
}
export function buildVisitorDifferential(value:Intake,catalog:readonly FormulaRecord[],proposal:LabProposal|null=null,source:'ai'|'local'='local',finalize=false) {
  const intake=visitorDifferentialCase(value,finalize);
  const result=buildDifferentialResult(intake,catalog,proposal,source);
  const baseline=buildReport(value.answers,catalog,{narrative:value.narrative,consultation:value.consultation,formulaReferencesEnabled:value.formulaReferencesEnabled});
  baseline.safety=visitorSafety(value);
  if(finalize&&pendingDifferentialSafetyQuestions(value).length&&['clear','medication_review'].includes(baseline.safety.level))baseline.safety={
    level:'incomplete',blocksFormulas:true,missingQuestionIds:['jointWarmth'],flags:[...baseline.safety.flags,'Uppgiften om en röd, varm eller svullen led är inte genomgången. Säkerheten behöver klargöras vid konsultationen.']};
  const safe=canAnalyzePatterns(baseline.safety);
  const safetyQuestions=safe&&!finalize?pendingDifferentialSafetyQuestions(value):[];
  const nextQuestions=safetyQuestions.length?safetyQuestions.map(id=>({topicId:id,prompt:questionById.get(id)!.prompt})):safe?result.questions:[];
  const missingHistory=labComplaint(intake).characterization.filter(id=>!Object.hasOwn(value.answers,id));
  const characterized=!finalize||missingHistory.length===0;
  const evidence=(topicId:string,weight=3):Evidence=>{
    const id=topicId as QuestionId,question=questionById.get(id),answer=value.answers[id]??'';
    return {questionId:id,answer,label:`${question?.prompt??id} ${question?.options.find(o=>o.value===answer)?.label??'Ej besvarat'}`,weight};
  };
  const references=characterized&&value.formulaReferencesEnabled!==false&&!baseline.safety.blocksFormulas&&safe?result.formulas.matches:[];
  const findings=safe?result.findings:[];
  const report=ReportSchema.parse({...baseline,source:source==='ai'&&safe?'ai':'rules',
    // The legacy comparison is not an alternative headline assessment.
    analysis:{...baseline.analysis,primary:null,secondary:[],patterns:[],status:characterized&&findings.some(f=>f.supported)?'preliminary':'insufficient',missingQuestionIds:[]},
    differential:{version:labVersion,status:safetyQuestions.length?'continue':safe?result.status:'safety_stop',completionReason:result.completionReason,medicalNotes:result.medicalNotes,
      findings:findings.map(f=>({id:f.patternId,name:f.name,supported:characterized&&f.supported,supporting:f.supporting.map(r=>evidence(r.topic,r.weight)),opposing:f.opposing.map(r=>evidence(r.topic,r.weight)),missingQuestionIds:[...new Set([...f.missingCore,...(!characterized?missingHistory:[])])]}))},
    formulaMatches:references.map(match=>{
      const formula=catalog.find(f=>f.id===match.id)!;
      return {formulaId:match.id,name:match.name,pinyin:formula.pinyin,hanzi:formula.hanzi,swedishName:formula.swedishName,score:match.score,
        explanation:'Jämförd efter den oberoende mönsterbedömningen. En terapeut behöver bedöma individuell lämplighet.',
        supporting:match.supporting.map(id=>evidence(id)),opposing:match.opposing.map(id=>evidence(id)),missingQuestionIds:match.missing,
        partial:match.partial,limitation:formula.scopeLimitation,safetyNotes:match.notes,productAvailable:false,productId:formula.productId,productUrl:null,
        classicalName:match.classicalName,requiresVerification:!match.productVerified,verificationNotes:!match.productVerified?['Faktiskt innehåll och säkerhet är inte fullständigt verifierade.']:[],referenceKind:match.referenceKind};
    }),
    formulaExclusions:safe?result.formulas.excluded.map(f=>({formulaId:f.id,name:f.name,reasons:f.reasons})):[],
    formulaStatus:value.formulaReferencesEnabled===false?'disabled':baseline.safety.blocksFormulas?'safety_blocked':references.length?'matched':characterized&&findings.some(f=>f.supported)?'no_match':'insufficient',
    followUpQuestionIds:nextQuestions.map(q=>q.topicId),
  });
  return {report,result:{...result,status:report.differential!.status,questions:nextQuestions}};
}
