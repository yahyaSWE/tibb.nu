import { analyzePatterns, analyzePatternsBaseline, getSafetyAssessment, safetyQuestionIds } from './engine';
import { getInterviewCompletionQuestionIds, getInterviewCompletionQuestionIdsBaseline, getInterviewDecision, getFormulaComparisonQuestionIds } from './interview';
import { formulaSeed } from './catalog-seed';
import { specialOrderSeed } from './special-order-catalog';
import { type AnswerMap, type PatternAnalysis, type PatternId, type QuestionId } from './types';
import { validateAnswers } from './questions';
import { effectiveAnswer } from './answer-context';

export * from './quality-contract';
import { qualityDatasetVersion, type QualityCase, type StoredQualityReview } from './quality-contract';
const background=new Set(['focus','duration','onset','trend','priorAssessment']);
const regressionCatalog=[...formulaSeed,...specialOrderSeed];
export const assessmentState=(analysis:PatternAnalysis):'conflicting_evidence'|'supported_pattern'|'insufficient_evidence'=>analysis.status==='conflicting'?'conflicting_evidence':analysis.status==='preliminary'?'supported_pattern':'insufficient_evidence';

/** Offline deterministic replay. Missing scripted responses become unknown,
 * never fabricated negative answers. No actual provider or patient is used. */
export function replayQualityCase(item:QualityCase,mode:'baseline'|'adaptive',order:'ranked'|'reversed'='ranked') {
  const available=validateAnswers(item.answers),answers:AnswerMap={};
  for(const id of safetyQuestionIds)if(available[id])answers[id]=available[id];
  const history:QuestionId[]=[],conclusions:(PatternId|null)[]=[];
  let repeats=0,zeroGain=0;
  const engine=mode==='baseline'?analyzePatternsBaseline:analyzePatterns;
  let analysis=engine(answers);
  for(let round=0;round<100;round++){
    const safety=getSafetyAssessment(answers);
    if(safety.level==='emergency')break;
    let ids=mode==='baseline'?getInterviewCompletionQuestionIdsBaseline(answers,analysis):getInterviewCompletionQuestionIds(answers,analysis);
    const reference=getFormulaComparisonQuestionIds(answers,analysis,regressionCatalog);
    ids=[...new Set([...ids,...reference])];
    if(order==='reversed'){
      // Alternate eligible choices, rather than merely reversing an identical
      // batch. Fixed background/safety keeps precedence in both variants.
      const mandatory=new Set(getInterviewDecision(answers,analysis).rankedQuestions.filter(question=>question.mandatory).map(question=>question.questionId));
      ids=[...ids.filter(id=>mandatory.has(id)),...ids.filter(id=>!mandatory.has(id)).reverse()];
    }
    ids=ids.slice(0,3);
    if(!ids.length)break;
    const decision=getInterviewDecision(answers,analysis);
    let changed=false;
    for(const id of ids){
      if(Object.hasOwn(answers,id)){repeats++;continue;}
      const ranked=decision.rankedQuestions.find(question=>question.questionId===id);
      if(!background.has(id)&&!ranked?.mandatory&&(!ranked||ranked.reasons.includes('Grundläggande kartläggning')))zeroGain++;
      history.push(id);answers[id]=effectiveAnswer(available,id)?.value??'unknown';changed=true;
    }
    if(!changed)break;
    analysis=engine(answers);conclusions.push(analysis.primary?.id??null);
  }
  const ids=analysis.patterns.filter(pattern=>pattern.qualified).map(pattern=>pattern.id).sort();
  return {analysis,patternIds:ids,state:assessmentState(analysis),primary:analysis.primary?.id??null,history,
    symptomQuestions:history.filter(id=>!safetyQuestionIds.includes(id)&&!background.has(id)).length,
    safetyQuestions:safetyQuestionIds.filter(id=>Object.hasOwn(answers,id)).length,repeats,lowGainQuestionProxy:zeroGain,
    conclusionChanges:conclusions.filter((id,index)=>index>0&&id!==conclusions[index-1]).length,
    abstained:analysis.status!=='preliminary',answers};
}
export function compareQualityCases(cases:readonly QualityCase[],reviews:readonly StoredQualityReview[]=[]) {
  const rows=cases.map(item=>{
    const baseline=replayQualityCase(item,'baseline'),adaptive=replayQualityCase(item,'adaptive'),variant=replayQualityCase(item,'adaptive','reversed');
    const review=reviews.find(review=>review.caseId===item.id&&review.datasetVersion===qualityDatasetVersion&&review.approved);
    const agreement=(result:typeof baseline)=>review?result.state===review.expectedStatus&&JSON.stringify(result.patternIds)===JSON.stringify([...review.expectedPatterns].sort()):null;
    return {id:item.id,baseline,adaptive,orderStable:JSON.stringify(adaptive.patternIds)===JSON.stringify(variant.patternIds)&&adaptive.state===variant.state,
      baselineAgreement:agreement(baseline),adaptiveAgreement:agreement(adaptive),reviewed:!!review};
  });
  const summary=(mode:'baseline'|'adaptive')=>{
    const numbers=rows.map(row=>row[mode].symptomQuestions).sort((a,b)=>a-b),reviewed=rows.filter(row=>row.reviewed);
    return {medianSymptomQuestions:numbers.length?numbers[Math.floor(numbers.length/2)]:0,minSymptomQuestions:numbers[0]??0,maxSymptomQuestions:numbers.at(-1)??0,
      repeatedQuestions:rows.reduce((sum,row)=>sum+row[mode].repeats,0),lowGainQuestionProxy:rows.reduce((sum,row)=>sum+row[mode].lowGainQuestionProxy,0),
      conclusionChanges:rows.reduce((sum,row)=>sum+row[mode].conclusionChanges,0),abstentions:rows.filter(row=>row[mode].abstained).length,
      exactAgreement:reviewed.length?reviewed.filter(row=>row[`${mode}Agreement`]).length/reviewed.length:null};
  };
  return {datasetVersion:qualityDatasetVersion,total:rows.length,reviewed:rows.filter(row=>row.reviewed).length,baseline:summary('baseline'),adaptive:summary('adaptive'),
    orderStableCases:rows.filter(row=>row.orderStable).length,rows};
}
