import { z } from 'zod';
import { effectiveAnswer } from './answer-context';
import { type AnswerMap, type EvidenceRule, type PatternFinding, type QuestionId } from './types';
import { type PatternDefinition } from './patterns';

/** Engineering weights, not clinically validated likelihoods. Qualification gates remain unchanged. */
export const WeightingPolicySchema = z.object({
  coreMultiplier:z.number().min(1).max(3), generalMultiplier:z.number().min(0.1).max(1),
  oppositionMultiplier:z.number().min(1).max(3),
}).strict();
export const defaultWeightingPolicy = WeightingPolicySchema.parse({coreMultiplier:1.5,generalMultiplier:0.5,oppositionMultiplier:1.25});
export type WeightingPolicy = z.infer<typeof WeightingPolicySchema>;
const general = new Set<QuestionId>(['energy','sleep','emotion']);
const known = (answers:AnswerMap,id:QuestionId) => { const answer=effectiveAnswer(answers,id);return answer&&!['unknown','prefer_not'].includes(answer.value)?answer:null; };
const matches = (answers:AnswerMap,rule:EvidenceRule) => {const answer=known(answers,rule.questionId);return !!answer&&rule.values.includes(answer.value);};
const labels:Record<string,string> = {qi_deficiency:'Qi-brist',qi_stagnation:'Qi-stagnation',blood_deficiency:'Blodbrist',blood_stasis:'Blodstas',yin_deficiency:'Yin-brist',yang_deficiency:'Yang-brist',cold:'Kyla',heat:'Hetta',dampness:'Fukt',phlegm:'Slem',dryness:'Torrhet',bi:'Bi',exterior:'Yttre prägel',shen:'Shen-relaterade besvär',food:'Matstagnation',qi_sinking:'Sjunkande Qi'};
/** Tags describe the existing definitions; they cannot independently approve a syndrome. */
const components:Record<string,string[]> = {
  spleenQiDeficiency:['qi_deficiency'],liverQiStagnation:['qi_stagnation'],liverInvadesSpleen:['qi_stagnation','qi_deficiency'],
  spleenDampness:['qi_deficiency','dampness'],stomachQiStagnation:['qi_stagnation'],foodStagnation:['food'],
  liverFire:['heat'],phlegmHeat:['phlegm','heat'],bloodStasis:['blood_stasis'],qiSinking:['qi_deficiency','qi_sinking'],
  liverBloodDeficiency:['blood_deficiency'],heartBloodDeficiency:['blood_deficiency','shen'],qiBloodDeficiency:['qi_deficiency','blood_deficiency'],
  lungWeiQiDeficiency:['qi_deficiency','exterior'],kidneyYinDeficiency:['yin_deficiency'],yangDeficiency:['yang_deficiency','cold'],
  windColdDampBi:['cold','dampness','bi'],dampHeatLower:['dampness','heat'],dryness:['dryness'],exteriorWindHeat:['exterior','heat'],
  stomachYinDeficiency:['yin_deficiency','dryness'],heartSpleenDeficiency:['qi_deficiency','blood_deficiency','shen'],
  liverSpleenBloodDeficiency:['qi_stagnation','qi_deficiency','blood_deficiency'],chronicBiDeficiency:['bi','qi_deficiency'],
  liverBloodShenDisturbance:['blood_deficiency','shen'],kidneyYangColdDampBi:['yang_deficiency','cold','dampness','bi'],
  excessFireToxin:['heat'],qiBloodYangDeficiency:['qi_deficiency','blood_deficiency','yang_deficiency','cold'],
  spleenQiColdDampStagnation:['qi_deficiency','dampness','cold','qi_stagnation'],liverQiStasisHeat:['qi_stagnation','blood_stasis','heat'],
};
export function patternComponents(definition:PatternDefinition){return (components[definition.id]??[]).map(id=>({id,label:labels[id]}));}

function componentRequirements(definition:PatternDefinition,id:string):EvidenceRule[][]|null {
  const g=definition.requiredEvidenceGroups,c=definition.coreRules;
  if(definition.id==='spleenQiColdDampStagnation')return id==='qi_deficiency'?[g[0]]:id==='dampness'?[g[1]]:id==='qi_stagnation'?[g[2]]:id==='cold'?[c]:null;
  if(definition.id==='qiBloodYangDeficiency')return id==='qi_deficiency'?[g[0]]:id==='blood_deficiency'?[g[1]]:id==='cold'?[c]:id==='yang_deficiency'?[c,g[0]]:null;
  if(definition.id==='liverQiStasisHeat')return [g[id==='qi_stagnation'?0:id==='blood_stasis'?1:2]];
  if(definition.id==='kidneyYangColdDampBi')return id==='cold'?[[c[0]]]:id==='yang_deficiency'?[[c[0]],[c[1]]]:id==='bi'?[[c[2]],[c[3]]]:null;
  return null;
}

export function assessPattern(definition:PatternDefinition,finding:PatternFinding,answers:AnswerMap,policy:WeightingPolicy=defaultWeightingPolicy):NonNullable<PatternFinding['assessment']> {
  const weights=WeightingPolicySchema.parse(policy);
  const coreIds=new Set([...definition.coreRules,...definition.requiredEvidenceGroups.flat()].flatMap(rule=>[rule.questionId,effectiveAnswer(answers,rule.questionId)?.questionId??rule.questionId]));
  const factor=(id:QuestionId)=>coreIds.has(id)?weights.coreMultiplier:general.has(id)?weights.generalMultiplier:1;
  // Deduplicate logical aliases against their actual source observation, including denominator.
  const criterionWeights=new Map<string,number>();
  for(const rule of definition.supportingRules){const key=effectiveAnswer(answers,rule.questionId)?.questionId??rule.questionId;criterionWeights.set(key,Math.max(criterionWeights.get(key)??0,rule.weight*factor(rule.questionId)));}
  const weighted=(values:PatternFinding['supporting'])=>values.reduce((sum,item)=>sum+item.weight*factor(item.questionId),0);
  const supportWeight=weighted(finding.supporting),oppositionWeight=weighted(finding.opposing)*weights.oppositionMultiplier;
  const totalWeight=[...criterionWeights.values()].reduce((sum,value)=>sum+value,0);
  const missing=new Set<QuestionId>(),contradicted=new Set<QuestionId>();
  for(const rule of definition.coreRules){if(!known(answers,rule.questionId))missing.add(rule.questionId);else if(!matches(answers,rule))contradicted.add(rule.questionId);}
  for(const group of definition.requiredEvidenceGroups){
    if(group.some(rule=>matches(answers,rule)))continue;
    const unknown=group.filter(rule=>!known(answers,rule.questionId));
    for(const rule of unknown.length?unknown:group)(unknown.length?missing:contradicted).add(rule.questionId);
  }
  const state=finding.qualified?'supported_pattern':contradicted.size||finding.opposing.reduce((sum,item)=>sum+item.weight,0)>=5?'conflicting_evidence':'insufficient_evidence';
  return {state,totalCriteria:criterionWeights.size,assessedCriteria:[...criterionWeights.keys()].filter(id=>known(answers,id as QuestionId)).length,
    supportWeight,oppositionWeight,normalizedSupport:totalWeight?(supportWeight-oppositionWeight)/totalWeight:0,
    missingCoreQuestionIds:[...missing],contradictedCoreQuestionIds:[...contradicted],
    components:patternComponents(definition).map(component=>{
      const groups=componentRequirements(definition,component.id);
      const ids=groups?new Set(groups.flat().map(rule=>effectiveAnswer(answers,rule.questionId)?.questionId??rule.questionId)):null;
      const supported=groups?groups.every(group=>group.some(rule=>matches(answers,rule))):finding.qualified;
      const opposed=groups?.some(group=>group.every(rule=>known(answers,rule.questionId)&&!matches(answers,rule)))??false;
      return {...component,state:supported?'supported' as const:opposed?'opposed' as const:'unknown' as const,
        supportingQuestionIds:finding.supporting.filter(item=>!ids||ids.has(item.questionId)).map(item=>item.questionId),
        opposingQuestionIds:finding.opposing.filter(item=>!ids||ids.has(item.questionId)).map(item=>item.questionId)};
    }),
  };
}
