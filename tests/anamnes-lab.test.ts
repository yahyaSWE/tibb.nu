import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LabCaseSchema, LabProposalSchema, assessLabPattern, buildLabResult, compareLabFormulas, planLabQuestions, labSafety, type LabCase, type LabEntry } from '../src/lib/anamnes/lab/engine';
import { fictionalAdultSafety, labExamples } from '../src/lib/anamnes/lab/examples';
import { labBook, labPatterns, labPatternById, labTopics, labTopicById } from '../src/lib/anamnes/lab/library';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import type { FormulaRecord } from '../src/lib/anamnes/types';

const entry=(topicId:string,value:string,note=''):LabEntry=>({topicId,value,note});
function sample(entries:LabEntry[]=[],narrative='Jag har håravfall.'):LabCase{return {narrative,context:'Helt fiktivt tekniskt test.',safety:{...fictionalAdultSafety},entries,fictional:true,finalize:false,aiConsent:false,consentVersion:null};}
test('lab vocabulary is independent, unique and internally valid; book verification is never invented',()=>{
  assert.ok(labPatterns.length>45);assert.ok(labTopics.length>100);
  assert.equal(new Set(labPatterns.map(p=>p.id)).size,labPatterns.length);assert.equal(new Set(labTopics.map(p=>p.id)).size,labTopics.length);
  for(const p of labPatterns){assert.equal(p.bookVerified,false);for(const r of [...p.support,...p.oppose,...p.core,...p.groups.flat()]){assert.ok(labTopicById.has(r.topic),`${p.id}/${r.topic}`);assert.ok(r.values.every(v=>labTopicById.get(r.topic)!.options.some(o=>o.value===v)));}}
  assert.equal(labBook.edition,3);assert.match(labBook.status,/inte granskade/);assert.ok(labPatternById.has('kidneyEssenceDeficiency'));
});
test('fictional scope, unique known questions, valid options and professional pulse boundaries are enforced',()=>{
  assert.equal(LabCaseSchema.safeParse({...sample(),fictional:false}).success,false);
  assert.equal(LabCaseSchema.safeParse(sample([entry('pulse','weak')])).success,false);
  assert.equal(LabCaseSchema.safeParse(sample([entry('priorAssessment','yes')])).success,false);
  assert.equal(LabCaseSchema.safeParse(sample([entry('energy','invented')])).success,false);
  assert.equal(LabCaseSchema.safeParse(sample([entry('energy','low'),entry('energy','normal')])).success,false);
});
test('a hair complaint opens competing hypotheses without turning narrative into confirmed points',()=>{
  const plan=planLabQuestions(sample());
  assert.ok(plan.candidates.some(p=>p.patternId==='kidneyEssenceDeficiency'));
  assert.ok(plan.candidates.some(p=>p.patternId==='liverBloodDeficiency'));
  assert.ok(plan.candidates.every(p=>!p.supported&&p.supporting.length===0));
  assert.deepEqual(plan.questions.slice(0,3).map(q=>q.topicId),['duration','onset','hairDistribution']);
  assert.ok(plan.questions.some(q=>q.topicId==='scalpCondition'));
});
test('ordinary descriptions of thinning and shedding follow the hair differential, including every hair example',()=>{
  for(const narrative of ['Jag tappar mer hår än tidigare.','Mitt hår har blivit tunnare.','Jag har tappat mycket hår.',...labExamples.filter(e=>e.id.startsWith('hair')||e.id==='no-pattern').map(e=>e.narrative)]){
    const plan=planLabQuestions(sample([],narrative));assert.equal(plan.complaint.hair,true,narrative);assert.ok(plan.questions.some(q=>q.topicId==='hairDistribution'));
  }
});
test('Jing requires distinct components and never inherits the Yin diagnosis from hair loss alone',()=>{
  const p=labPatternById.get('kidneyEssenceDeficiency')!;
  assert.equal(assessLabPattern(p,[entry('earlyGrey','yes')]).supported,false);
  const findings=labPatterns.map(p=>assessLabPattern(p,[entry('earlyGrey','yes'),entry('memoryChange','yes'),entry('tinnitus','yes')]));
  assert.equal(findings.find(f=>f.patternId==='kidneyEssenceDeficiency')!.supported,true);
  assert.equal(findings.find(f=>f.patternId==='kidneyYinDeficiency')!.supported,false);
  assert.equal(compareLabFormulas(sample([entry('earlyGrey','yes'),entry('memoryChange','yes'),entry('tinnitus','yes')]),findings,formulaSeed).matches.length,0);
});
test('unknown and withheld answers provide no support or negative evidence and are not repeated',()=>{
  const value=sample([entry('duration','unknown'),entry('onset','prefer_not'),entry('hairDistribution','unknown'),entry('pallor','unknown')]);
  const result=buildLabResult(value,[]);assert.ok(result.findings.every(f=>!f.supported));
  for(const q of result.questions)assert.ok(!value.entries.some(e=>e.topicId===q.topicId));
});
test('known opposing core findings remove a hypothesis instead of collecting unrelated confirmation',()=>{
  const cold=labPatternById.get('kidneyYangDeficiency')!;
  assert.equal(assessLabPattern(cold,[entry('temperature','hot'),entry('energy','low'),entry('backWeakness','yes')]).possible,false);
  const jing=labPatternById.get('kidneyEssenceDeficiency')!;
  assert.equal(assessLabPattern(jing,[entry('earlyGrey','no'),entry('teethWeakness','no'),entry('reproductiveChange','no')]).possible,false);
});
test('important discriminators remain available beyond 25 answers; there is no clinical count stop',()=>{
  const value=sample(labTopics.filter(q=>!Object.hasOwn(fictionalAdultSafety,q.id)&&!['earlyGrey','memoryChange','teethWeakness','reproductiveChange','tinnitus','backWeakness'].includes(q.id)).slice(0,30).map(q=>entry(q.id,'unknown')));
  const result=buildLabResult(value,[]);assert.equal(result.status,'continue');assert.ok(result.questions.length>0);
});
test('all fictional sample interviews terminate without repeating a topic or forcing an unsupported pattern',()=>{
  for(const example of labExamples){const value=sample([...example.entries],example.narrative);value.context=example.context;const seen=new Set(value.entries.map(e=>e.topicId));
    for(let round=0;round<=labTopics.length;round++){
      const result=buildLabResult(value,[]);
      if(result.status!=='continue'){assert.ok(['needs_examination','outside_scope','ready_for_review','safety_stop'].includes(result.status));break;}
      assert.ok(result.questions.length>0);assert.ok(round<labTopics.length);
      for(const q of result.questions){assert.equal(seen.has(q.topicId),false,`${example.id}/${q.topicId}`);seen.add(q.topicId);value.entries.push(entry(q.topicId,'unknown'));}
    }
    assert.equal(buildLabResult(value,[]).findings.some(f=>f.supported),false);
  }
});
test('normal sleep covers equivalent detailed questions without fabricating other denials',()=>{
  const plan=planLabQuestions(sample([entry('sleep','normal')],'Jag sover dåligt ibland.'));
  assert.ok(!plan.questions.some(q=>['sleepOnset','nightWaking','dreams'].includes(q.topicId)));
  assert.ok(!plan.canonicalEntries.some(e=>e.topicId==='nightSweats'));
});
test('a model can propose a new known differential before the legacy rule engine qualifies it',()=>{
  const proposal=LabProposalSchema.parse({patternIds:['kidneyEssenceDeficiency'],questions:[{topicId:'earlyGrey',prompt:'Har ditt hår grånat ovanligt tidigt?',purpose:'differentiate',targetPatternIds:['kidneyEssenceDeficiency']}],disposition:'continue'});
  const result=buildLabResult(sample([], 'Jag vill undersöka några långvariga förändringar.'),[],proposal,'ai');
  assert.equal(result.source,'ai');assert.ok(result.findings.some(f=>f.patternId==='kidneyEssenceDeficiency'));
  assert.equal(LabProposalSchema.safeParse({...proposal,patternIds:['invented_diagnosis']}).success,false);
});
test('model confidence never skips missing discriminators or fabricates a finished diagnosis',()=>{
  const result=buildLabResult(sample(),[],{patternIds:['kidneyEssenceDeficiency'],questions:[],disposition:'review'},'ai');
  assert.equal(result.status,'continue');assert.ok(result.findings.every(f=>!f.supported));
  const stopped=buildLabResult({...sample(),finalize:true},[]);assert.equal(stopped.status,'user_stopped');assert.equal(stopped.questions.length,0);assert.equal(stopped.formulas.matches.length,0);
});
test('a need for examination can end questioning without manufacturing a diagnosis',()=>{
  const result=buildLabResult(sample(),[],{patternIds:['kidneyEssenceDeficiency'],questions:[],disposition:'examination'},'ai');
  assert.equal(result.status,'needs_examination');assert.equal(result.questions.length,0);assert.ok(result.findings.every(f=>!f.supported));assert.equal(result.formulas.matches.length,0);
});

const characterizedHair=[entry('duration','months'),entry('onset','gradual'),entry('hairDistribution','diffuse'),entry('scalpCondition','normal'),entry('hairTrigger','none'),entry('hairFamily','no')];
test('a characterized AI review does not exhaust unrelated standard questions or invent support',()=>{
  const value=sample(characterizedHair),proposal={patternIds:['kidneyEssenceDeficiency'],questions:[],disposition:'review'} as const;
  const result=buildLabResult(value,[],LabProposalSchema.parse(proposal),'ai');
  assert.equal(result.status,'needs_examination');assert.equal(result.questions.length,0);assert.equal(result.completionReason,'ai_review');
  assert.ok(result.findings.every(f=>!f.supported));assert.ok(result.unresolved.length>0);assert.equal(result.formulas.matches.length,0);
  assert.ok(!planLabQuestions(value).questions.some(q=>q.topicId==='pain'));
});
test('supported AI review stops for therapist review while retaining unresolved alternatives',()=>{
  const value=sample([...characterizedHair,entry('earlyGrey','yes'),entry('memoryChange','yes'),entry('tinnitus','yes')]);
  const result=buildLabResult(value,[],{patternIds:['kidneyEssenceDeficiency'],questions:[],disposition:'review'},'ai');
  assert.equal(result.status,'ready_for_review');assert.equal(result.questions.length,0);assert.ok(result.findings.some(f=>f.patternId==='kidneyEssenceDeficiency'&&f.supported));
  assert.equal(result.formulas.matches.length,0);
});
test('fresh explicit discriminators remain available and take priority over broad local supporting topics',()=>{
  const value=sample(characterizedHair);
  const result=buildLabResult(value,[],{patternIds:['kidneyYangDeficiency'],questions:[{topicId:'coldLimbs',prompt:'Är dina händer eller fötter ofta kalla?',purpose:'differentiate',targetPatternIds:['kidneyYangDeficiency']}],disposition:'review'},'ai');
  assert.equal(result.status,'continue');assert.equal(result.questions[0].topicId,'coldLimbs');assert.equal(result.questions.length,1);
  assert.ok(result.questions.every(q=>!characterizedHair.some(e=>e.topicId===q.topicId)));
});
test('answered AI topics cannot repeat and an unsafe generated question uses the neutral template',()=>{
  const result=buildLabResult(sample([entry('onset','gradual')]),[],{patternIds:[],questions:[{topicId:'duration',prompt:'Ska du ta 5 mg tabletter?',purpose:'characterize',targetPatternIds:[]},{topicId:'onset',prompt:'Hur började besvären?',purpose:'characterize',targetPatternIds:[]}],disposition:'continue'},'ai');
  assert.ok(!result.questions.some(q=>q.topicId==='onset'));assert.equal(result.questions.find(q=>q.topicId==='duration')!.prompt,labTopicById.get('duration')!.prompt);
});
test('safety screening includes narrative, complementary text and per-answer notes before AI',()=>{
  assert.equal(labSafety({...sample(),context:'Pågående bröstsmärta.'}).level,'emergency');
  assert.equal(labSafety(sample([entry('energy','low','Jag har svår andnöd nu.')])).level,'emergency');
  const result=buildLabResult({...sample(),safety:{...fictionalAdultSafety,clinicalRedFlags:'yes'}},formulaSeed);
  assert.equal(result.status,'safety_stop');assert.equal(result.questions.length,0);assert.equal(result.formulas.matches.length,0);
});
test('scalp red flags and familial alternatives are retained without being counted as a deficiency',()=>{
  const result=buildLabResult(sample([entry('hairDistribution','patches'),entry('scalpCondition','inflamed'),entry('hairFamily','yes')]),[]);
  assert.equal(result.medicalNotes.length,2);assert.ok(result.findings.every(f=>!f.supported));
});
const qiBlood=sample([entry('energy','low'),entry('pallor','yes'),entry('weakVoice','yes'),entry('dizziness','yes'),entry('temperature','neutral')]);
const formula:FormulaRecord={...formulaSeed[0],id:'fixture-lab-formula',name:'Synthetic reference',active:true,primaryPatternIds:['qiBloodDeficiency'],secondaryPatternIds:[],requiredPatternIds:['qiBloodDeficiency'],
  supportingRules:[{questionId:'energy',values:['low'],weight:4},{questionId:'pallor',values:['yes'],weight:4}],opposingRules:[],requiredQuestionIds:['energy','pallor'],requiredSafetyRules:[],contraindicationRules:[]};
const qiFindings=()=>[assessLabPattern(labPatternById.get('qiBloodDeficiency')!,qiBlood.entries)];
test('formula comparison uses the same independently supported profile, honors activation and returns at most three',()=>{
  const findings=qiFindings();assert.equal(findings[0].supported,true);
  const result=compareLabFormulas(qiBlood,findings,[...Array.from({length:5},(_,i)=>({...formula,id:`test-${i}`})),{...formula,id:'inactive',active:false}]);
  assert.equal(result.matches.length,3);assert.ok(result.matches.every(f=>f.supportedPatternIds.includes('qiBloodDeficiency')));assert.ok(!result.matches.some(f=>f.id==='inactive'));
});
test('unknown required criteria are partial, explicit contraindications exclude, and no product URL or dose is generated',()=>{
  const partial=compareLabFormulas(qiBlood,qiFindings(),[{...formula,requiredQuestionIds:['nightSweats']}]).matches[0];assert.equal(partial.partial,true);assert.ok(partial.missing.includes('nightSweats'));assert.equal(partial.productVerified,false);
  const medication=compareLabFormulas({...qiBlood,safety:{...fictionalAdultSafety,medication:'yes'}},qiFindings(),[{...formula,contraindicationRules:[{questionId:'medication',values:['yes'],weight:5}]}]);
  assert.equal(medication.matches.length,0);assert.equal(medication.excluded.length,1);
  assert.ok(!Object.hasOwn(partial,'productUrl'));assert.ok(!Object.hasOwn(partial,'dose'));
});
