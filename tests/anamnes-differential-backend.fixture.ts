import assert from 'node:assert/strict';
import {before,beforeEach,after,test} from 'node:test';
import {getDb} from '../src/lib/db';
import {anamnesAiConfig,anamnesSubmissionConsentVersion} from '../src/lib/anamnes/config';
import {interviewAnamnes,analyzeAnamnes} from '../src/lib/anamnes/service';
import {POST as interviewPOST} from '../src/app/api/anamnes/interview/route';
import {submitAnamnes,getAnamnesCase,AnamnesReviewInputSchema} from '../src/lib/anamnes/cases';
import {verifyAnalysisReceipt} from '../src/lib/anamnes/ai';
import {emptyConsultationDetails,ReportSchema,type AnswerMap} from '../src/lib/anamnes/types';
import {fictionalAdultSafety} from '../src/lib/anamnes/lab/examples';
import {formatAnamnesSummary} from '../src/lib/anamnes/summary';
import type {User} from '../src/lib/types';
assert.match(process.env.TIBB_DATABASE_PATH??'',/tibb-differential-backend-[^/\\]+[/\\]owned\.sqlite$/);
const originalFetch=globalThis.fetch,originalWarn=console.warn;
let calls=0,body:Record<string,unknown>={},warnings:unknown[][]=[];
const proposal={patternIds:['kidneyEssenceDeficiency'],questions:[],disposition:'review'};
let reply:unknown=proposal,httpStatus=200;
const completeAnswers:AnswerMap={...fictionalAdultSafety,duration:'months',onset:'gradual',hairDistribution:'diffuse',scalpCondition:'normal',hairTrigger:'none',hairFamily:'no',earlyGrey:'yes',memoryChange:'yes',tinnitus:'yes'};
const intake=()=>({answers:{...completeAnswers},narrative:'Helt fiktivt håravfall för ett tekniskt test.',consultation:emptyConsultationDetails(),aiConsent:true,aiConsentVersion:anamnesAiConfig().consentVersion,formulaReferencesEnabled:true,round:0,finalize:false});
before(()=>{
  Object.assign(process.env,{ANAMNES_AI_ENABLED:'1',ANAMNES_PRIVACY_REVIEWED:'1',ANAMNES_CLINICAL_REVIEWED:'1',ANAMNES_REGULATORY_REVIEWED:'1',ANAMNES_AI_PROVIDER:'responses-compatible',
    ANAMNES_AI_ENDPOINT:'https://synthetic-provider.example/responses',ANAMNES_AI_MODEL:'fixture-public-model',ANAMNES_LAB_AI_MODEL:'fixture-lab-model',ANAMNES_AI_API_KEY:'fixture-secret-not-for-output',ANAMNES_AI_DAILY_LIMIT:'1000',
    ANAMNES_AI_PRIVACY_NOTICE:'Completely fictional data sent to a mocked provider for an isolated technical test.',ANAMNES_STORAGE_KEY:'f0'.repeat(32),ANAMNES_SUBMISSIONS_ENABLED:'1',
    ANAMNES_THERAPIST_EMAILS:'therapist@example.test',ANAMNES_SUBMISSION_PRIVACY_NOTICE:'Completely fictional intake encrypted in an isolated disposable technical test database.'});
  getDb();console.warn=(...args:unknown[])=>{warnings.push(args);};
  globalThis.fetch=async(url,init)=>{
    assert.equal(String(url),'https://synthetic-provider.example/responses');calls++;body=JSON.parse(String(init?.body));
    return httpStatus===200?Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(reply)}]}]}):new Response('fixture-secret-not-for-output',{status:httpStatus});
  };
});
beforeEach(async()=>{
  calls=0;body={};warnings=[];reply=proposal;httpStatus=200;
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES('anamnes_analysis_mode','ai') ON CONFLICT(key) DO UPDATE SET value='ai'").run();
});
after(async()=>{globalThis.fetch=originalFetch;console.warn=originalWarn;await getDb().close();});
test('official anonymous endpoint uses the extended engine and public model, never the admin fictional instruction',async()=>{
  const request=new Request('https://site.example.test/api/anamnes/interview',{method:'POST',headers:{origin:'https://site.example.test','content-type':'application/json'},body:JSON.stringify(intake())});
  const response=await interviewPOST(request);assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.complete,true);assert.equal(result.report.source,'ai');
  assert.ok(result.report.differential.findings.some((f:{id:string;supported:boolean})=>f.id==='kidneyEssenceDeficiency'&&f.supported));
  assert.equal(body.model,'fixture-public-model');assert.equal(body.store,false);assert.doesNotMatch(String(body.instructions),/fiktiva TCM-fall/);
  const payload=JSON.parse((body.input as {content:{text:string}[]}[])[0].content[0].text);
  assert.equal(payload.kind,'untrusted_visitor_intake');assert.ok(!Object.hasOwn(payload,'catalog'));assert.ok(!Object.hasOwn(payload,'formulas'));assert.equal(calls,1);
});
test('new question answers and notes reach the provider while medication and contact details do not',async()=>{
  const value=intake();value.answers.medication='yes';value.consultation.questionNotes.earlyGrey='SYNTHETIC_NEW_TOPIC_NOTE';value.consultation.medicationDetails='DO_NOT_SEND_MEDICATION_NAMES';
  await interviewAnamnes(value);const serialized=JSON.stringify(body);
  assert.match(serialized,/SYNTHETIC_NEW_TOPIC_NOTE/);assert.doesNotMatch(serialized,/DO_NOT_SEND_MEDICATION_NAMES/);
  assert.match(serialized,/earlyGrey/);
});
test('consent, mode, incomplete screens and safety text guard all provider calls',async()=>{
  for(const patch of [{aiConsent:false},{aiConsentVersion:'stale'},{answers:{...completeAnswers,adult:'unknown'}},{narrative:'Pågående bröstsmärta.'},{consultation:{...emptyConsultationDetails(),conditionDetails:'Svår andnöd just nu.'},answers:{...completeAnswers,chronicDisease:'yes'}}]){
    const result=await interviewAnamnes({...intake(),...patch});assert.equal(result.report.source,'rules');assert.equal(calls,0);
  }
  await getDb().prepare("UPDATE app_meta SET value='rules' WHERE key='anamnes_analysis_mode'").run();
  await interviewAnamnes(intake());assert.equal(calls,0);
});
test('unknown topics, professional pulse and client model overrides are rejected before a provider call',async()=>{
  await assert.rejects(interviewAnamnes({...intake(),answers:{...completeAnswers,pulse:'weak'}}));
  await assert.rejects(interviewAnamnes({...intake(),answers:{...completeAnswers,invented:'yes'}}));
  await assert.rejects(interviewAnamnes({...intake(),model:'client-model'}));assert.equal(calls,0);
});
test('musculoskeletal safety is clarified before AI; unknown or positive joint answers do not authorize matching',async()=>{
  const value={...intake(),narrative:'Fiktivt fall med värk i nacke och axlar.'};
  const pending=await interviewAnamnes(value);assert.deepEqual(pending.questionIds,['jointWarmth']);assert.equal(pending.complete,false);assert.equal(pending.reason,'continue');assert.equal(calls,0);
  for(const jointWarmth of ['unknown','prefer_not','yes']){
    const stopped=await interviewAnamnes({...value,answers:{...value.answers,jointWarmth}});
    assert.equal(stopped.report.safety.blocksFormulas,true);assert.equal(stopped.report.formulaMatches.length,0);assert.equal(calls,0);
  }
  const manual=await interviewAnamnes({...value,finalize:true});assert.equal(manual.report.safety.blocksFormulas,true);assert.equal(calls,0);
});
test('long complementary context is preserved and screened without clipping any fields',async()=>{
  const value=intake();Object.assign(value.consultation,{locations:'x'.repeat(500),dailyImpact:'y'.repeat(1200),goal:'z'.repeat(1000),previousCare:'a'.repeat(1500),lifestyle:'b'.repeat(1400)+'SYNTHETIC_CONTEXT_END'});
  await interviewAnamnes(value);assert.match(JSON.stringify(body),/SYNTHETIC_CONTEXT_END/);assert.equal(calls,1);
  calls=0;value.consultation.lifestyle='b'.repeat(1400)+' bröstsmärta';
  await interviewAnamnes(value);assert.equal(calls,0);
});
test('completion cannot fabricate support and current findings survive a signed original submission',async()=>{
  const value=intake(),result=await interviewAnamnes(value);assert.ok(result.receipt);
  assert.equal(verifyAnalysisReceipt(value.answers,result.report,result.receipt,value.narrative,value.consultation),true);
  const altered=structuredClone(result.report);altered.differential!.findings[0].name='ALTERED';
  assert.equal(verifyAnalysisReceipt(value.answers,altered,result.receipt,value.narrative,value.consultation),false);
  const sent=await submitAnamnes({answers:value.answers,narrative:value.narrative,consultation:value.consultation,formulaReferencesEnabled:true,sendConsent:true,submissionConsentVersion:anamnesSubmissionConsentVersion(),contact:{name:'Fiktivt Tekniktest',email:'fictional@example.test',phone:''},report:result.report,receipt:result.receipt});
  const stored=await getAnamnesCase({role:'admin',email:'therapist@example.test'} as User,sent.reference);assert.ok(stored);
  assert.equal(stored.intake.answers.earlyGrey,'yes');assert.deepEqual(stored.report,result.report);
  const summary=formatAnamnesSummary(stored.report,stored.intake.answers,stored.intake.narrative,'',stored.intake.consultation);
  assert.match(summary,/Njure-Jing/);assert.match(summary,/PRELIMINÄRA TCM-MÖNSTER/);
  assert.equal(ReportSchema.safeParse(result.report).success,true);
  assert.equal(AnamnesReviewInputSchema.safeParse({notes:'',tongueNotes:'',pulseNotes:'',corrections:'',finalAssessment:'',selectedPrimaryPatternId:'kidneyEssenceDeficiency',selectedSecondaryPatternIds:[],selectedFormulaId:null,expectedRevision:0}).success,true);
});
test('manual finalization and provider failures retain an honest local snapshot',async()=>{
  const {round:_round,finalize:_finalize,...input}=intake();
  const final=await analyzeAnamnes(input);assert.equal(final.report.differential?.status,'user_stopped');
  httpStatus=402;const fallback=await interviewAnamnes(intake());assert.equal(fallback.reason,'fallback');assert.equal(fallback.report.source,'rules');assert.ok(fallback.report.differential);
  assert.doesNotMatch(JSON.stringify(warnings),/fixture-secret|Fiktivt|håravfall/);
});
