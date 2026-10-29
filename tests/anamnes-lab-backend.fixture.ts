import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getDb } from '../src/lib/db';
import { labAiStatus, requestLabProposal, labInstructions } from '../src/lib/anamnes/lab/provider';
import { LabCaseSchema, type LabCase } from '../src/lib/anamnes/lab/engine';
import { fictionalAdultSafety } from '../src/lib/anamnes/lab/examples';
import { getAnamnesAnalysisMode } from '../src/lib/anamnes/settings';
assert.match(process.env.TIBB_DATABASE_PATH??'',/tibb-lab-backend-[^/\\]+[/\\]owned\.sqlite$/);
const originalFetch=globalThis.fetch;
const originalWarn=console.warn;
const diagnostics:unknown[][]=[];
const valid={patternIds:['kidneyEssenceDeficiency'],questions:[{topicId:'earlyGrey',prompt:'Har håret grånat tidigt?',purpose:'differentiate',targetPatternIds:['kidneyEssenceDeficiency']}],disposition:'continue'};
const envelope=(value:unknown)=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
function value():LabCase{return LabCaseSchema.parse({narrative:'Fiktivt exempel med håravfall.',context:'Syntetisk komplettering.',safety:{...fictionalAdultSafety},entries:[{topicId:'duration',value:'months',note:'Syntetiskt förtydligande.'}],fictional:true,aiConsent:true,consentVersion:labAiStatus().consentVersion,finalize:false});}
before(async()=>{
  console.warn=(...args:unknown[])=>{diagnostics.push(args);};
  Object.assign(process.env,{ANAMNES_AI_ENABLED:'1',ANAMNES_PRIVACY_REVIEWED:'1',ANAMNES_CLINICAL_REVIEWED:'1',ANAMNES_REGULATORY_REVIEWED:'1',ANAMNES_AI_PROVIDER:'responses-compatible',
    ANAMNES_AI_ENDPOINT:'https://synthetic-provider.example/responses',ANAMNES_AI_MODEL:'fixture-main-model',ANAMNES_LAB_AI_MODEL:'fixture-lab-model',ANAMNES_AI_API_KEY:'fixture-secret-do-not-echo',
    ANAMNES_AI_PRIVACY_NOTICE:'Only completely fictional test information is sent to a mocked provider.',ANAMNES_AI_DAILY_LIMIT:'1000'});
  getDb();
});
after(async()=>{
  globalThis.fetch=originalFetch;console.warn=originalWarn;
  // Diagnostics must never include free-form upstream, model or case content.
  assert.doesNotMatch(JSON.stringify(diagnostics),/fixture-secret|secret-do-not-leak|Syntetisk|Fiktivt|håravfall/);
  for(const [event,fields] of diagnostics){
    assert.equal(event,'anamnes_lab_ai_unavailable');
    assert.ok(Object.keys(fields as object).every(key=>['code','httpStatus','issues'].includes(key)));
    if(Object.hasOwn(fields as object,'issues'))for(const issue of (fields as {issues:{field:string;issue:string}[]}).issues){
      assert.ok(['root','patternIds','questions','questions.topicId','questions.prompt','questions.purpose','questions.targetPatternIds','disposition'].includes(issue.field));
      assert.ok(['invalid_type','invalid_value','too_big','too_small','unrecognized_keys','invalid_format','other'].includes(issue.issue));
    }
  }
  await getDb().close();
});
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
test('complete fenced JSON is accepted, but invalid contracts and unfinished output stay rejected',async()=>{
  globalThis.fetch=async()=>Response.json({status:'completed',output:[{type:'reasoning',content:[{type:'output_text',text:'ignored'}]},{type:'message',role:'assistant',content:[{type:'output_text',text:'```json\n'+JSON.stringify(valid)+'\n```'}]}]});
  assert.deepEqual(await requestLabProposal(value()),valid);
  const invalid:[unknown,string][]=[
    [{status:'incomplete',output:[]},'INCOMPLETE_RESPONSE'],
    [{status:'completed',output:[{type:'reasoning',content:[{type:'output_text',text:JSON.stringify(valid)}]}]},'MISSING_OUTPUT'],
    [envelope({...valid,dose:'secret-do-not-leak'}),'INVALID_SCHEMA'],
    [envelope({...valid,patternIds:['invented']}),'INVALID_SCHEMA'],
    [envelope({...valid,questions:[{...valid.questions[0],topicId:'pulse'}]}),'INVALID_SCHEMA'],
    [envelope({...valid,questions:[...Array(3).fill(valid.questions[0]),{...valid.questions[0],topicId:'invented-secret-do-not-leak'}]}),'INVALID_SCHEMA'],
    [{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',text:'secret-do-not-leak'}]}]},'REFUSAL'],
    [{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Here is secret-do-not-leak '+JSON.stringify(valid)}]}]},'INVALID_JSON'],
    [{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'```json\n'+JSON.stringify(valid).slice(0,-1)+'\n```'}]}]},'INVALID_JSON'],
  ];
  for(const [reply,code] of invalid){
    globalThis.fetch=async()=>Response.json(reply);
    await assert.rejects(requestLabProposal(value()),e=>e instanceof Error&&!/secret-do-not-leak|fixture-secret/.test(e.message)&&e.message.includes(`LAB_${code}`));
  }
});
test('excess valid questions are validated before selecting three unique topics; outbound cap stays three',async()=>{
  const questions=['duration','onset','hairDistribution','earlyGrey'].map(topicId=>({...valid.questions[0],topicId}));
  globalThis.fetch=async(_url,init)=>{
    const request=JSON.parse(String(init?.body));
    assert.equal(request.text.format.schema.properties.questions.maxItems,3);
    return Response.json(envelope({...valid,questions:[questions[0],...questions]}));
  };
  assert.deepEqual((await requestLabProposal(value())).questions,questions.slice(0,3));
  globalThis.fetch=async()=>Response.json(envelope({...valid,questions:[...questions,{...questions[0],dose:'secret-do-not-leak'}]}));
  await assert.rejects(requestLabProposal(value()),/LAB_INVALID_SCHEMA/);
  globalThis.fetch=async()=>Response.json(envelope({...valid,questions:Array(1000).fill(questions[0])}));
  await assert.rejects(requestLabProposal(value()),/LAB_INVALID_RESPONSE|LAB_INVALID_SCHEMA/);
});
test('HTTP failures identify actionable categories without echoing upstream bodies or retrying',async()=>{
  for(const status of [400,401,402,403,404,422,429,500,502,503]){
    let calls=0;globalThis.fetch=async()=>{calls++;return new Response('fixture-secret-do-not-echo',{status});};
    await assert.rejects(requestLabProposal(value()),e=>e instanceof Error&&e.message.includes(`LAB_UPSTREAM_HTTP_${status}`)&&e.message.includes('Dina testuppgifter finns kvar')&&!e.message.includes('fixture-secret'));
    assert.equal(calls,1);assert.deepEqual(diagnostics.at(-1),['anamnes_lab_ai_unavailable',{code:'upstream_http',httpStatus:status}]);
  }
});
test('network, timeout and malformed provider responses have distinct safe diagnostics',async()=>{
  for(const name of ['TimeoutError','AbortError','TypeError']){
    globalThis.fetch=async()=>{const error=new Error('fixture-secret-do-not-echo');error.name=name;throw error;};
    await assert.rejects(requestLabProposal(value()),new RegExp(name==='TypeError'?'LAB_NETWORK':'LAB_TIMEOUT'));
  }
  globalThis.fetch=async()=>new Response('fixture-secret-do-not-echo',{headers:{'Content-Type':'application/json'}});
  await assert.rejects(requestLabProposal(value()),/LAB_INVALID_RESPONSE/);
  globalThis.fetch=async()=>Response.json({status:'completed',output:'fixture-secret-do-not-echo'});
  await assert.rejects(requestLabProposal(value()),/LAB_INVALID_RESPONSE/);
});
test('shared provider budget pauses the test instead of manufacturing a diagnosis',async()=>{
  process.env.ANAMNES_AI_DAILY_LIMIT='1';let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(envelope(valid));};
  await assert.rejects(requestLabProposal(value()),/AI-budgeten är uppnådd/);assert.equal(calls,0);assert.match(labInstructions,/intern tankekedja/);
});
