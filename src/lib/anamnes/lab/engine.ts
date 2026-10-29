import { z } from 'zod';
import { labPatterns, labPatternById, labTopicById, labTopics, labVersion, type LabPattern, type LabRule } from './library';
import { NarrativeSchema, type AnswerMap, type EvidenceRule, type FormulaRecord, type QuestionId } from '../types';
import { getSafetyAssessment, safetyQuestionIds, canAnalyzePatterns, productVerificationComplete } from '../engine';
import { buildReport } from '../engine';

export const LabEntrySchema = z.object({ topicId: z.string().min(1).max(70), value: z.string().min(1).max(60), note: NarrativeSchema }).strict();
const SafetySchema = z.object({ adult: z.enum(['yes','no','unknown','prefer_not']), pregnancy: z.enum(['yes','no','unknown','prefer_not']),
  medication: z.enum(['yes','no','unknown','prefer_not']), chronicDisease: z.enum(['yes','no','unknown','prefer_not']), liverKidney: z.enum(['yes','no','unknown','prefer_not']),
  allergy: z.enum(['yes','no','unknown','prefer_not']), emergency: z.enum(['yes','no','unknown','prefer_not']), clinicalRedFlags: z.enum(['yes','no','unknown','prefer_not']) }).strict();
export const LabCaseSchema = z.object({ narrative: NarrativeSchema.min(1), context: NarrativeSchema, safety: SafetySchema,
  entries: z.array(LabEntrySchema).max(labTopics.length), finalize: z.boolean(), fictional: z.literal(true), aiConsent: z.boolean(), consentVersion: z.string().max(128).nullable() }).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const [index, entry] of value.entries.entries()) {
    const topic = labTopicById.get(entry.topicId);
    if (!topic || safetyQuestionIds.includes(entry.topicId as QuestionId) || !topic.options.some(o => o.value === entry.value) || seen.has(entry.topicId))
      ctx.addIssue({ code: 'custom', path: ['entries', index], message: 'Välj ett giltigt, unikt svar på en testfråga.' });
    seen.add(entry.topicId);
  }
});
export type LabCase = z.infer<typeof LabCaseSchema>;
export type LabEntry = z.infer<typeof LabEntrySchema>;
export const LabProposalSchema = z.object({
  patternIds: z.array(z.enum(labPatterns.map(p => p.id))).max(8),
  questions: z.array(z.object({ topicId: z.enum(labTopics.filter(q => !safetyQuestionIds.includes(q.id as QuestionId)).map(q => q.id)), prompt: z.string().trim().min(5).max(260),
    purpose: z.enum(['characterize','differentiate','counterevidence','clarify']), targetPatternIds: z.array(z.enum(labPatterns.map(p => p.id))).max(4) }).strict()).max(3),
  disposition: z.enum(['continue','review','examination','outside_scope']),
}).strict();
export type LabProposal = z.infer<typeof LabProposalSchema>;
export function labSafety(value: LabCase) {
  const order={clear:0,medication_review:1,incomplete:2,consultation:3,medical_review:4,emergency:5};
  return [value.narrative,value.context,...value.entries.map(e=>e.note)].map(text=>getSafetyAssessment(labLegacyAnswers(value),text))
    .sort((a,b)=>order[b.level]-order[a.level])[0];
}
const unknown = new Set(['unknown', 'prefer_not']);
export function labLegacyAnswers(value: LabCase): AnswerMap {
  const result: AnswerMap = { ...value.safety };
  for (const entry of value.entries) { const id = labTopicById.get(entry.topicId)?.legacyId; if (id) result[id] = entry.value; }
  return result;
}
function known(entries: LabEntry[], id: string) { const v = entries.find(e => e.topicId === id)?.value; return v && !unknown.has(v) ? v : null; }
function match(entries: LabEntry[], rule: LabRule) { const v = known(entries, rule.topic); return v !== null && rule.values.includes(v); }
function contradicted(entries: LabEntry[], rule: LabRule) { const v = known(entries, rule.topic); return v !== null && !rule.values.includes(v); }
export function assessLabPattern(pattern: LabPattern, entries: LabEntry[]) {
  const supporting = pattern.support.filter(rule => match(entries, rule));
  const opposing = pattern.oppose.filter(rule => match(entries, rule));
  const missingCore = [...pattern.core.filter(rule => !match(entries, rule)).map(rule => rule.topic), ...pattern.groups.filter(g => !g.some(rule => match(entries, rule))).flatMap(g => g.map(rule => rule.topic))];
  const coreConflict = pattern.core.some(rule => contradicted(entries, rule)) || pattern.groups.some(g => g.every(rule => contradicted(entries, rule)));
  const opposition = opposing.reduce((sum, rule) => sum + rule.weight, 0);
  const support = supporting.reduce((sum, rule) => sum + rule.weight, 0);
  const supported = new Set(supporting.map(rule => rule.topic)).size >= 3 && support - opposition >= 7 && opposition < 5 && !missingCore.length;
  const possible = !coreConflict && opposition < 5 && new Set(pattern.support.filter(r => match(entries,r) || !known(entries,r.topic)).map(r => r.topic)).size >= 3;
  return { patternId: pattern.id, name: pattern.name, supporting, opposing, missingCore: [...new Set(missingCore)], supported, possible, score: support - opposition, sources: pattern.sources, examination: pattern.examination };
}
export type LabFinding = ReturnType<typeof assessLabPattern>;
const complaintProfiles: [RegExp, string[]][] = [
  [/håravfall|hårförlust|(?:tappar|tappa|tappat|förlorar|förlora|förlorat).{0,30}\bhår\b|hår(?:et)?.{0,30}(?:tunnare|faller av)|alopec|hair loss|thinning hair/iu, ['liverBloodDeficiency','qiBloodDeficiency','kidneyEssenceDeficiency','kidneyYinDeficiency']],
  [/mag|buk|matsmält|uppblås|avför|diarr|förstopp|reflux/iu, ['spleenQiDeficiency','spleenDampness','stomachQiStagnation','foodStagnation']],
  [/sömn|somna|vaknar|insomni/iu, ['heartBloodDeficiency','heartSpleenDeficiency','heartYinDeficiency','liverBloodShenDisturbance']],
  [/nack|axl|käk|spänn|huvudvärk/iu, ['liverQiStagnation','bloodStasis','windColdDampBi','liverYangRising']],
  [/rygg|länd|knä/iu, ['kidneyYangDeficiency','kidneyYinDeficiency','windColdDampBi','bloodStasis']],
  [/trött|utmatt|kraftlös|orkes|fatigue/iu, ['spleenQiDeficiency','qiBloodDeficiency','yangDeficiency','lungQiDeficiency']],
  [/stress|oro|ångest|ängsl/iu, ['liverQiStagnation','heartBloodDeficiency','heartYinDeficiency','heartSpleenDeficiency']],
  [/host|andning|slem/iu, ['lungQiDeficiency','lungYinDeficiency','phlegmHeat','phlegmDamp']],
  [/urin|kiss|läckage/iu, ['kidneyQiDeficiency','kidneyYangDeficiency','dampHeatLower','gallbladderDampHeat']],
];
export function labComplaint(value: LabCase) {
  const text = `${value.narrative}\n${value.context}`;
  const routed = complaintProfiles.filter(([expression]) => expression.test(text)).flatMap(([, ids]) => ids);
  const hair = complaintProfiles[0][0].test(text);
  return { hair, patternIds: [...new Set(routed)], characterization: hair ? ['duration','onset','hairDistribution','scalpCondition','hairTrigger','hairFamily'] : ['duration','onset','symptomLocation','trend'] };
}
function topicRelevant(value: LabCase, id: string) {
  const a = labLegacyAnswers(value);
  if (a.menstruation !== 'yes' && ['menstrualFlow','menstrualPain'].includes(id)) return false;
  if (a.pain === 'no' && ['painLocation','painCharacter','painWarmth','painMovement','weatherPain','jointWarmth','stiffness','pressureRelief','warmthRelief'].includes(id)) return false;
  if (a.sleep === 'normal' && ['sleepOnset','nightWaking','dreams'].includes(id)) return false;
  return !safetyQuestionIds.includes(id as QuestionId);
}
function canonicalAnswers(value: LabCase): LabEntry[] {
  const entries = [...value.entries];
  const answers = labLegacyAnswers(value);
  const implied: [string, string | undefined][] = [
    ['sleepOnset', answers.sleep === 'difficulty' ? 'yes' : answers.sleep === 'normal' ? 'no' : undefined],
    ['nightWaking', answers.sleep === 'waking' ? 'yes' : answers.sleep === 'normal' ? 'no' : undefined],
    ['nightSweats', answers.sweating === 'night' ? 'yes' : undefined],
  ];
  for (const [topicId, v] of implied) if (v && !entries.some(e => e.topicId === topicId)) entries.push({ topicId, value: v, note: '' });
  return entries;
}
export function planLabQuestions(value: LabCase, proposal: LabProposal | null = null) {
  const entries = canonicalAnswers(value), answered = new Set(entries.map(e => e.topicId)), complaint = labComplaint(value);
  const all = labPatterns.map(p => assessLabPattern(p, entries));
  const signal = all.filter(p => p.supporting.length >= 2 && p.possible).sort((a,b) => Number(b.supported)-Number(a.supported) || b.score-a.score);
  const seeded = [...new Set([...signal.map(p => p.patternId), ...(proposal?.patternIds ?? []), ...complaint.patternIds])];
  const candidates = seeded.map(id => all.find(p => p.patternId === id)!).filter(p => p?.possible).slice(0,4);
  const ranked = new Map<string, { topicId: string; gain: number; purpose: 'characterize'|'differentiate'|'counterevidence'|'clarify'; targetPatternIds: string[] }>();
  const add = (id: string, gain: number, purpose: 'characterize'|'differentiate'|'counterevidence'|'clarify', targets: string[]) => {
    if (!labTopicById.has(id) || answered.has(id) || !topicRelevant(value,id)) return;
    const old = ranked.get(id); if (!old || old.gain < gain) ranked.set(id,{ topicId:id,gain,purpose,targetPatternIds:targets });
  };
  complaint.characterization.forEach((id, index) => add(id, 200-index, 'characterize', []));
  // Neutral, one-symptom statements are possible hypotheses, never evidence.
  for (const finding of candidates) {
    const pattern = labPatternById.get(finding.patternId)!;
    for (const rule of [...pattern.core,...pattern.groups.filter(g => !g.some(r => match(entries,r))).flat()]) add(rule.topic, 80 + rule.weight, 'differentiate', [pattern.id]);
    for (const rule of pattern.oppose) if (rule.weight >= 3) add(rule.topic, 65+rule.weight, 'counterevidence', [pattern.id]);
    if (!finding.supported) for (const rule of pattern.support) add(rule.topic, 35+rule.weight, 'differentiate', [pattern.id]);
  }
  // Cross-hypothesis value is based on different expected answers, not confidence.
  for (const item of ranked.values()) {
    const signatures = candidates.map(c => { const p = labPatternById.get(c.patternId)!;return JSON.stringify({ s:p.support.filter(r => r.topic===item.topicId).flatMap(r => r.values).sort(),o:p.oppose.filter(r => r.topic===item.topicId).flatMap(r => r.values).sort() }); });
    if (new Set(signatures).size > 1) item.gain += 12;
    item.targetPatternIds = candidates.filter(c => { const p=labPatternById.get(c.patternId)!;return [...p.support,...p.oppose].some(r => r.topic===item.topicId); }).map(c => c.patternId);
  }
  const basic = ['temperature','energy','sleep','appetite','stool','thirst','sweating','emotion','pain'];
  basic.forEach((id, index) => add(id, candidates.some(c => c.supported) ? 15-index/10 : 30-index/10, 'clarify', []));
  // An AI may open a new relevant differential before a rule hypothesis exists.
  // It cannot keep adding pure confirmations after useful discrimination ends.
  for (const q of proposal?.questions ?? []) if (!candidates.some(c => c.supported) || q.purpose !== 'clarify') add(q.topicId, q.purpose==='characterize'?150:55, q.purpose, q.targetPatternIds);
  const questions = [...ranked.values()].sort((a,b)=>b.gain-a.gain||a.topicId.localeCompare(b.topicId));
  return { candidates, all, questions, complaint, canonicalEntries: entries };
}

function catalogRule(value: LabCase, rule: EvidenceRule) {
  const entries=[...canonicalAnswers(value),...Object.entries(value.safety).map(([topicId,value])=>({topicId,value,note:''}))];
  const answer=known(entries,rule.questionId);return answer!==null&&rule.values.includes(answer);
}
export function compareLabFormulas(value: LabCase, findings: LabFinding[], catalog: readonly FormulaRecord[]) {
  const safety = labSafety(value);
  const entries=canonicalAnswers(value),allEntries=[...entries,...Object.entries(value.safety).map(([topicId,value])=>({topicId,value,note:''}))];
  if (safety.blocksFormulas) return { matches: [] as LabFormula[], excluded: [] as {id:string;name:string;reasons:string[]}[], status: 'safety_blocked' as const };
  const supported = findings.filter(f=>f.supported), supportedIds = new Set(supported.map(f=>labPatternById.get(f.patternId)?.legacyId).filter(Boolean));
  const excluded: {id:string;name:string;reasons:string[]}[] = [];
  const matches: LabFormula[] = [];
  for (const formula of catalog.filter(f=>f.active)) {
    if (!formula.primaryPatternIds.some(id=>supportedIds.has(id))) continue;
    const contraindicated=formula.contraindicationRules.filter(r=>catalogRule(value,r));
    const failedSafety=formula.requiredSafetyRules.filter(r=>{const v=known(allEntries,r.questionId);return v!==null&&!r.values.includes(v);});
    if (contraindicated.length || failedSafety.length) { excluded.push({id:formula.id,name:formula.name,reasons:[...contraindicated,...failedSafety].map(r=>labTopicById.get(r.questionId)!.prompt)}); continue; }
    const support=formula.supportingRules.filter(r=>catalogRule(value,r)), opposing=formula.opposingRules.filter(r=>catalogRule(value,r));
    const missingPatterns=formula.requiredPatternIds.filter(id=>!supportedIds.has(id));
    const missing=[...new Set([...formula.requiredQuestionIds.filter(id=>!known(allEntries,id)),...formula.requiredSafetyRules.filter(r=>!known(allEntries,r.questionId)).map(r=>r.questionId)])];
    const weight=support.reduce((s,r)=>s+r.weight,0), against=opposing.reduce((s,r)=>s+r.weight,0);
    // Missing ingredients/criteria never become a full match or an available product.
    const partial=missing.length>0||missingPatterns.length>0||opposing.length>0||support.length<2||weight<6||supported.some(f=>!formula.primaryPatternIds.includes(f.patternId as PatternIdLike)&&!formula.secondaryPatternIds.includes(f.patternId as PatternIdLike));
    if (against >= 5 || missingPatterns.length) { excluded.push({id:formula.id,name:formula.name,reasons:[...(against>=5?['Tydliga motfynd i katalogens regler']:[]),...missingPatterns.map(id=>`Mönsterkomponenten ${id} är inte underbyggd`)]}); continue; }
    matches.push({ id:formula.id,name:formula.name,classicalName:formula.supplierProfile?.formulaName??formula.pinyin,referenceKind:formula.referenceKind,
      supportedPatternIds:formula.primaryPatternIds.filter(id=>supportedIds.has(id)), supporting:support.map(r=>r.questionId), opposing:opposing.map(r=>r.questionId), missing,
      partial, score:weight-against, productVerified:productVerificationComplete(formula), notes:[formula.scopeLimitation,...formula.safetyNotes,...formula.contraindications,...formula.interactions,...(value.safety.medication==='yes'?['Terapeuten behöver kontrollera läkemedel och interaktioner före eventuellt örtval.']:[])] });
  }
  matches.sort((a,b)=>Number(a.partial)-Number(b.partial)||b.score-a.score||a.id.localeCompare(b.id));
  return { matches:matches.slice(0,3),excluded,status:matches.length?'references' as const:'no_match' as const };
}
type PatternIdLike = FormulaRecord['primaryPatternIds'][number];
export type LabFormula = { id:string;name:string;classicalName:string;referenceKind:'assortment'|'special_order';supportedPatternIds:string[];supporting:string[];opposing:string[];missing:string[];partial:boolean;score:number;productVerified:boolean;notes:string[] };

export function buildLabResult(input: LabCase, catalog: readonly FormulaRecord[], proposal: LabProposal | null = null, source: 'ai'|'local' = 'local') {
  const value=LabCaseSchema.parse(input), legacy=labLegacyAnswers(value), safety=labSafety(value);
  const plan=planLabQuestions(value,proposal), formulas=compareLabFormulas(value,plan.candidates,catalog);
  const safe=canAnalyzePatterns(safety);
  let questions=plan.questions;
  // Product checks enter after the independent differential, never its prompt.
  if (!questions.length && plan.candidates.some(p=>p.supported)) {
    const ids=formulas.matches.flatMap(f=>f.missing).filter(id=>!plan.canonicalEntries.some(e=>e.topicId===id)&&topicRelevant(value,id));
    questions=[...new Set(ids)].map(topicId=>({topicId,gain:10,purpose:'clarify' as const,targetPatternIds:[]}));
  }
  const outside=proposal?.disposition==='outside_scope'&&!plan.all.some(p=>p.supported);
  const status=!safe?'safety_stop':value.finalize?'user_stopped':outside?'outside_scope':proposal?.disposition==='examination'?'needs_examination':questions.length?'continue':plan.candidates.some(p=>p.supported)?'ready_for_review':'needs_examination';
  const prompts=new Map(proposal?.questions.map(q=>[q.topicId,q])??[]);
  const next=status==='continue'?questions.slice(0,3).map(q=>{
    const topic=labTopicById.get(q.topicId)!, suggestion=prompts.get(q.topicId)?.prompt;
    const unsafe=/https?:|www\.|[<>]|\b(?:dosering|ordination|milligram|köp)\b|\d+\s*(?:mg|g|ml)\b|(?:sluta|ändra|höj|sänk).{0,40}(?:dos|medicin|läkemedel)|(?:ta|använd).{0,30}(?:örter|örtform|tablett|kapsel)/iu;
    const prompt=suggestion&&suggestion.endsWith('?')&&!unsafe.test(suggestion)?suggestion:topic.prompt;
    return {...q,prompt,options:topic.options};
  }):[];
  const medicalNotes=plan.complaint.hair?[...(known(value.entries,'hairDistribution')==='patches'?['Kala fläckar behöver medicinsk bedömning.']:[]),...(['inflamed'].includes(known(value.entries,'scalpCondition')??'')?['Röd eller öm hårbotten behöver bedömas.']:[]),...(known(value.entries,'hairTrigger')==='medication'?['Möjligt samband med läkemedelsändring behöver följas upp; ändra inte läkemedel utifrån testet.']:[])]:[];
  return { version:labVersion,source,status,questions:next,findings:safe?plan.candidates:[],formulas:safe?formulas:{...formulas,matches:[],status:'safety_blocked' as const},
    safety,medicalNotes,baseline:buildReport(legacy,catalog,{narrative:value.narrative}),unavailableMethods:['Puls och palpation','Behandlarens egen inspektion, lyssnande och undersökning'],
    unresolved:plan.candidates.flatMap(f=>f.missingCore.map(topicId=>({patternId:f.patternId,topicId}))),
    contextUsed:{narrative:!!value.narrative,complement:!!value.context,notes:value.entries.filter(e=>e.note).length,answers:value.entries.length},
  };
}
export type LabResult=ReturnType<typeof buildLabResult>;
