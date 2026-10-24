import { effectiveAnswer, questionCovered, questionRelevant } from './answer-context';
import { patternById } from './patterns';
import { isPublicQuestion, questionById } from './questions';
import { type AnswerMap, type EvidenceRule, type PatternAnalysis, type PatternId, type QuestionId } from './types';

const background=new Set(['focus','duration','onset','trend','priorAssessment']);
const safety=new Set(['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags']);
const known=(answers:AnswerMap,id:QuestionId)=>{const answer=effectiveAnswer(answers,id);return answer&&!['unknown','prefer_not'].includes(answer.value)?answer.value:null;};
const matches=(answers:AnswerMap,rule:EvidenceRule)=>{const value=known(answers,rule.questionId);return !!value&&rule.values.includes(value);};
export type RankedQuestion={questionId:QuestionId;diagnosticInformationGain:number;mandatory:boolean;reasons:string[]};

/** Content-based shortlist. A compound with three components needs evidence of
 * at least two before collecting points for its remaining component. */
export function competingPatterns(answers:AnswerMap,analysis:PatternAnalysis) {
  return analysis.patterns.filter(finding=>{
    const definition=patternById.get(finding.id)!;
    return finding.supporting.filter(item=>!background.has(item.questionId)).length>=2
      && definition.coreRules.every(rule=>!known(answers,rule.questionId)||matches(answers,rule))
      && definition.requiredEvidenceGroups.every(group=>group.some(rule=>!known(answers,rule.questionId)||matches(answers,rule)))
      && definition.requiredEvidenceGroups.filter(group=>group.some(rule=>matches(answers,rule))).length>=Math.min(2,Math.max(0,definition.requiredEvidenceGroups.length-1))
      && finding.opposing.reduce((sum,item)=>sum+item.weight,0)<5;
  }).sort((a,b)=>Number(b.qualified)-Number(a.qualified)||(b.assessment?.normalizedSupport??0)-(a.assessment?.normalizedSupport??0)||a.id.localeCompare(b.id)).slice(0,3);
}

/** Transparent ordinal heuristic: disagreement of accepted values, missing
 * mandatory components and high-weight counterevidence. It is not entropy or
 * a calibrated probability of a medical diagnosis. No formula data enters. */
export function diagnosticInformationGain(questionId:QuestionId,answers:AnswerMap,analysis:PatternAnalysis):{value:number;reasons:string[];core:boolean} {
  if(questionCovered(answers,questionId))return {value:0,reasons:[],core:false};
  const candidates=competingPatterns(answers,analysis),reasons:string[]=[];
  let value=0,core=false;
  const signatures:string[]=[];
  for(const finding of candidates){
    const definition=patternById.get(finding.id)!;
    const required=definition.coreRules.filter(rule=>rule.questionId===questionId);
    const groups=definition.requiredEvidenceGroups.filter(group=>!group.some(rule=>matches(answers,rule))&&group.some(rule=>rule.questionId===questionId));
    if(required.length||groups.length){value+=4;core=true;reasons.push(`Saknat kärnfynd: ${finding.id}`);}
    const supports=definition.supportingRules.filter(rule=>rule.questionId===questionId);
    const opposes=definition.opposingRules.filter(rule=>rule.questionId===questionId);
    if(opposes.some(rule=>rule.weight>=4)){value+=3;reasons.push(`Prövar motfynd: ${finding.id}`);}
    if(supports.length&&finding.supporting.length<3){value+=2;reasons.push(`Otillräckligt undersökt stöd: ${finding.id}`);}
    signatures.push(JSON.stringify({support:[...new Set(supports.flatMap(rule=>rule.values))].sort(),opposition:[...new Set(opposes.flatMap(rule=>rule.values))].sort()}));
  }
  if(new Set(signatures).size>1){value+=5;reasons.push('Skiljer konkurrerande kriterier åt');}
  return {value,reasons,core};
}

export function differentialDecision(answers:AnswerMap,analysis:PatternAnalysis,pool:readonly QuestionId[],mandatory:readonly QuestionId[]=[]) {
  const candidates=competingPatterns(answers,analysis);
  const ids=[...new Set([...mandatory,...pool,...candidates.flatMap(finding=>{
    const definition=patternById.get(finding.id)!;
    return [...definition.coreRules,...definition.requiredEvidenceGroups.filter(group=>!group.some(rule=>matches(answers,rule))).flat(),...definition.opposingRules.filter(rule=>rule.weight>=4)].map(rule=>rule.questionId);
  })])];
  const symptomCount=Object.keys(answers).filter(id=>!safety.has(id)&&!background.has(id)).length;
  const hasSupport=analysis.status==='preliminary'&&analysis.patterns.some(finding=>finding.qualified);
  const ranked:RankedQuestion[]=ids.filter(id=>{
    const question=questionById.get(id);return question&&isPublicQuestion(question)&&!questionCovered(answers,id)&&questionRelevant(answers,id);
  }).flatMap((questionId,index)=>{
    const gain=diagnosticInformationGain(questionId,answers,analysis),required=mandatory.includes(questionId);
    // A soft budget discounts pure confirmation. Missing core/safety is never
    // discarded because of question count, and unknown answers are never repeated.
    const useful=required||gain.core||gain.value>=3||(!hasSupport&&symptomCount<15)||symptomCount<9;
    if(!useful)return [];
    return [{questionId,mandatory:required,diagnosticInformationGain:(required?100:0)+gain.value+(symptomCount<15?1:0)-index/1000,
      reasons:required?['Obligatorisk bakgrund eller riktad säkerhetsfråga',...gain.reasons]:gain.reasons.length?gain.reasons:['Grundläggande kartläggning']}];
  }).sort((a,b)=>b.diagnosticInformationGain-a.diagnosticInformationGain);
  return {candidatePatternIds:candidates.map(finding=>finding.id) as PatternId[],rankedQuestions:ranked,
    shouldStop:ranked.length===0,reason:ranked.length?'continue' as const:hasSupport&&analysis.status!=='conflicting'?'supported' as const:'uncertain' as const,
    answeredSymptomCount:symptomCount,softQuestionTarget:[15,25] as const};
}
