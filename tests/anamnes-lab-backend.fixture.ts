import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getDb } from '../src/lib/db';
import { labAiStatus, requestLabProposal, labInstructions } from '../src/lib/anamnes/lab/provider';
import { LabCaseSchema, type LabCase } from '../src/lib/anamnes/lab/engine';
import { fictionalAdultSafety } from '../src/lib/anamnes/lab/examples';
import { getAnamnesAnalysisMode } from '../src/lib/anamnes/settings';
assert.match(process.env.TIBB_DATABASE_PATH??'',/tibb-lab-backend-[^/\\]+[/\\]owned\.sqlite$/);
const originalFetch=globalThis.fetch;
const valid={patternIds:['kidneyEssenceDeficiency'],questions:[{topicId:'earlyGrey',prompt:'Har håret grånat tidigt?',purpose:'differentiate',targetPatternIds:['kidneyEssenceDeficiency']}],disposition:'continue'};
const envelope=(value:unknown)=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
function value():LabCase{return LabCaseSchema.parse({narrative:'Fiktivt exempel med håravfall.',context:'Syntetisk komplettering.',safety:{...fictionalAdultSafety},entries:[{topicId:'duration',value:'months',note:'Syntetiskt förtydligande.'}],fictional:true,aiConsent:true,consentVersion:labAiStatus().consentVersion,finalize:false});}
before(async()=>{
  Object.assign(process.env,{ANAMNES_AI_ENABLED:'1',ANAMNES_PRIVACY_REVIEWED:'1',ANAMNES_CLINICAL_REVIEWED:'1',ANAMNES_REGULATORY_REVIEWED:'1',ANAMNES_AI_PROVIDER:'responses-compatible',
    ANAMNES_AI_ENDPOINT:'https://synthetic-provider.example/responses',ANAMNES_AI_MODEL:'fixture-main-model',ANAMNES_LAB_AI_MODEL:'fixture-lab-model',ANAMNES_AI_API_KEY:'fixture-secret-do-not-echo',
    ANAMNES_AI_PRIVACY_NOTICE:'Only completely fictional test information is sent to a mocked provider.',ANAMNES_AI_DAILY_LIMIT:'1000'});
  getDb();
});
after(async()=>{globalThis.fetch=originalFetch;await getDb().close();});
test('lab uses its separate configured model without changing the public analysis setting or sending products',async()=>{
  assert.equal(await getAnamnesAnalysisMode(),'rules');let calls=0;
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(String(url),'https://synthetic-provider.example/responses');
    const body=JSON.parse(String(init?.body));assert.equal(body.model,'fixture-lab-model');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.match(body.instructions,/opålitliga data/);assert.match(body.instructions,/fulltext.*INTE/);assert.match(body.instructions,/Inga doser/);
    const payload=JSON.parse(body.input[0].content[0].text);assert.equal(payload.complement,'Syntetisk komplettering.');assert.equal(payload.transcript[0].note,'Syntetiskt förtydligande.');
    assert.ok(payload.profiles.some((p:{id:string})=>p.id==='kidneyEssenceDeficiency'));assert.ok(payload.topics.some((q:{id:string})=>q.id==='hairDistribution'));
    assert.ok(!Object.hasOwn(payload,'catalog'));assert.ok(!Object.hasOwn(payload,'formulas'));assert.ok(!Object.hasOwn(payload,'apiKey'));
    return Response.json(envelope(valid));
  };
  assert.deepEqual(await requestLabProposal(value()),valid);assert.equal(calls,1);assert.equal(await getAnamnesAnalysisMode(),'rules');
});
test('missing and stale consent and unsafe notes do not call the provider',async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(envelope(valid));};
  await assert.rejects(requestLabProposal({...value(),aiConsent:false}),/Välj AI på nytt/);
  await assert.rejects(requestLabProposal({...value(),consentVersion:'stale'}),/Välj AI på nytt/);
  await assert.rejects(requestLabProposal({...value(),context:'Pågående bröstsmärta.'}),/säkerhetsuppgifter/);assert.equal(calls,0);
});
test('model changes invalidate consent without leaking the key',()=>{
  const old=labAiStatus();process.env.ANAMNES_LAB_AI_MODEL='fixture-second-model';const changed=labAiStatus();assert.notEqual(old.consentVersion,changed.consentVersion);
  assert.equal(Object.hasOwn(changed,'apiKey'),false);process.env.ANAMNES_LAB_AI_MODEL='fixture-lab-model';
});
test('reasoning-only, unfinished, extra fields, unknown IDs and upstream secret text fail generically',async()=>{
  const invalid=[{status:'incomplete',output:[]},{status:'completed',output:[{type:'reasoning',content:[{type:'output_text',text:JSON.stringify(valid)}]}]},envelope({...valid,dose:'secret-do-not-leak'}),envelope({...valid,patternIds:['invented']}),envelope({...valid,questions:[{...valid.questions[0],topicId:'pulse'}]})];
  for(const reply of invalid){globalThis.fetch=async()=>Response.json(reply);await assert.rejects(requestLabProposal(value()),e=>e instanceof Error&&!/secret-do-not-leak|fixture-secret/.test(e.message)&&/ogiltigt svar/.test(e.message));}
  globalThis.fetch=async()=>new Response('fixture-secret-do-not-echo',{status:402});await assert.rejects(requestLabProposal(value()),/AI-anropet kunde inte slutföras/);
});
test('shared provider budget pauses the test instead of manufacturing a diagnosis',async()=>{
  process.env.ANAMNES_AI_DAILY_LIMIT='1';let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(envelope(valid));};
  await assert.rejects(requestLabProposal(value()),/AI-budgeten är uppnådd/);assert.equal(calls,0);assert.match(labInstructions,/intern tankekedja/);
});
