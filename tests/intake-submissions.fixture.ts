import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createCipheriv, randomBytes } from 'node:crypto';
import { createFirstAdmin, getDb, getUser } from '../src/lib/db';
import type { User } from '../src/lib/types';
import { SCHEMA_VERSION } from '../src/lib/schema';
import { anamnesSubmissionConsentVersion } from '../src/lib/anamnes/config';
import { getAnamnesCase, listAnamnesContacts, submitAnamnes } from '../src/lib/anamnes/cases';
import { decryptIntake } from '../src/lib/anamnes/secure-storage';
import { AnamnesError } from '../src/lib/anamnes/http';
import { selfTestSubmissionConfig, SubmitSelfTestSchema, submitSelfTest, getSelfTestCase, listSelfTestContacts, deleteSelfTestCase } from '../src/lib/five-phases/submissions';
import { calculateResult } from '../src/lib/five-phases/scoring';
import { QUESTIONS } from '../src/lib/five-phases/questions';
import { POST } from '../src/app/api/sjalvtest/submit/route';
import { GET as configGET } from '../src/app/api/sjalvtest/submission-config/route';
import { GET as retentionGET } from '../src/app/api/anamnes/retention/route';

assert.equal(process.env.INTAKE_SUBMISSION_FIXTURE,'1');
assert.match(process.env.TIBB_DATABASE_PATH??'',/tibb-intake-submissions-[^/\\]+[/\\]owned-fixture\.sqlite$/);
for(const key of Object.keys(process.env))assert.ok(!/^(TURSO_|VERCEL|STRIPE_|RESEND_|SMTP_|MAIL_|APP_URL$|SETUP_TOKEN$)/.test(key));
let admin:User,student:User,otherAdmin:User;
let networkRequests=0;
const originalFetch=globalThis.fetch;
const answers=QUESTIONS.map(question=>({questionId:question.id,value:3 as const}));
const contact={name:'SYNTHETIC PRIVATE VISITOR',email:'synthetic-private@example.test',phone:'+46 synthetic phone'};
const input=()=>({answers,contact,sendConsent:true,submissionConsentVersion:selfTestSubmissionConfig().consentVersion});
const forbidden=(error:unknown)=>error instanceof AnamnesError&&error.status===403;
function enable(){
  Object.assign(process.env,{
    ANAMNES_PRIVACY_REVIEWED:'1',ANAMNES_CLINICAL_REVIEWED:'1',ANAMNES_REGULATORY_REVIEWED:'1',
    ANAMNES_SUBMISSIONS_ENABLED:'1',ANAMNES_STORAGE_KEY:'45'.repeat(32),ANAMNES_THERAPIST_EMAILS:admin.email,
    ANAMNES_SUBMISSION_PRIVACY_NOTICE:'SYNTHETIC TEST ONLY: fictitious self-test and anamnes details stored in an owned isolated SQLite database.',
  });
}
before(async()=>{
  globalThis.fetch=async()=>{networkRequests++;throw new Error('Network forbidden in intake fixture.');};
  admin=await createFirstAdmin({name:'Synthetic authorized reviewer',email:'intake-reviewer@example.test',passwordHash:'not-a-real-password'});
  for(const role of ['student','admin'] as const){
    const inserted=await getDb().prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run('Synthetic nonreviewer',`intake-${role}@example.test`,'synthetic',role,new Date().toISOString());
    const user=(await getUser(Number(inserted.lastInsertRowid)))!;
    if(role==='student')student=user;else otherAdmin=user;
  }
  enable();
});
after(async()=>{assert.equal(networkRequests,0);globalThis.fetch=originalFetch;await getDb().close();});

test('requires complete, unique valid answers, active consent, required name/email and optional phone',()=>{
  assert.equal(SubmitSelfTestSchema.parse({...input(),contact:{name:'  Synthetic visitor  ',email:' visitor@example.test '}}).contact.phone,'');
  assert.equal(SubmitSelfTestSchema.parse({...input(),contact:{name:'  Synthetic visitor  ',email:' visitor@example.test '}}).contact.name,'Synthetic visitor');
  for(const changed of [
    {answers:answers.slice(1)},{answers:[...answers.slice(1),answers[1]]},
    {answers:[{questionId:999,value:3},...answers.slice(1)]},{answers:[{questionId:1,value:6},...answers.slice(1)]},
    {sendConsent:false},{sendConsent:undefined},{result:calculateResult(answers)},
    {contact:{...contact,name:'  '}},{contact:{...contact,email:'invalid'}},{contact:{...contact,name:'bad\nname'}},{contact:{...contact,role:'admin'}},
  ])assert.equal(SubmitSelfTestSchema.safeParse({...input(),...changed}).success,false,JSON.stringify(changed));
});

test('disabled configuration, missing key and stale consent fail closed before insert',async()=>{
  const before=(await getDb().prepare('SELECT count(*) n FROM self_test_cases').get())!.n;
  const stale=input();process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE+=' changed';
  await assert.rejects(submitSelfTest(stale),(error:unknown)=>error instanceof AnamnesError&&error.status===409);
  enable();process.env.ANAMNES_SUBMISSIONS_ENABLED='0';
  assert.equal(selfTestSubmissionConfig().available,false);
  await assert.rejects(submitSelfTest(input()),(error:unknown)=>error instanceof AnamnesError&&error.status===503);
  enable();delete process.env.ANAMNES_STORAGE_KEY;
  assert.equal(selfTestSubmissionConfig().available,false);
  await assert.rejects(submitSelfTest(input()));
  enable();assert.equal((await getDb().prepare('SELECT count(*) n FROM self_test_cases').get())!.n,before);
  assert.notEqual(selfTestSubmissionConfig().consentVersion,anamnesSubmissionConsentVersion());
});

test('server computes results, snapshots questions and encrypts contact, answers and consent',async()=>{
  const receipt=await submitSelfTest(input());
  assert.deepEqual(Object.keys(receipt).sort(),['expiresAt','reference']);
  const row=(await getDb().prepare('SELECT * FROM self_test_cases WHERE id=?').get(receipt.reference))!;
  assert.match(String(row.encrypted_payload),/^v1\./);
  for(const value of Object.values(contact))assert.ok(!JSON.stringify(row).includes(value));
  assert.ok(!JSON.stringify(row).includes(QUESTIONS[0].text));
  const item=(await getSelfTestCase(admin,receipt.reference))!;
  assert.deepEqual(item.result,calculateResult(answers));assert.equal(item.result.tiedElements.length,5);
  assert.deepEqual(item.answers,answers);assert.deepEqual(item.contact,contact);
  assert.deepEqual(item.questions,QUESTIONS.map(({id,text,element})=>({id,text,element})));
  assert.equal(item.consent.version,selfTestSubmissionConfig().consentVersion);
  assert.match(item.consent.notice,/Självtest|självtest/);
  assert.equal(Date.parse(item.expiresAt)-Date.parse(item.createdAt),30*86400000);
  const list=(await listSelfTestContacts(admin)).find(value=>value.id===item.id)!;
  assert.deepEqual(Object.keys(list).sort(),['createdAt','email','expiresAt','id','name']);
  assert.equal(list.email,contact.email);
  assert.throws(()=>decryptIntake(String(row.encrypted_payload),`case:${item.id}`));
  assert.throws(()=>decryptIntake(String(row.encrypted_payload),`self-test:${randomUUID()}`));
});

test('read, metadata listing and deletion require both admin role and therapist allowlist',async()=>{
  const receipt=await submitSelfTest(input());
  for(const actor of [student,otherAdmin]){
    await assert.rejects(getSelfTestCase(actor,receipt.reference),forbidden);
    await assert.rejects(listSelfTestContacts(actor),forbidden);
    await assert.rejects(listAnamnesContacts(actor),forbidden);
    await assert.rejects(deleteSelfTestCase(actor,receipt.reference),forbidden);
  }
  process.env.ANAMNES_THERAPIST_EMAILS+=`,${student.email}`;
  await assert.rejects(getSelfTestCase(student,receipt.reference),forbidden);
  enable();await deleteSelfTestCase(admin,receipt.reference);assert.equal(await getSelfTestCase(admin,receipt.reference),null);
});

test('wrong encryption key and modified ciphertext never yield contact or answers',async()=>{
  const receipt=await submitSelfTest(input());
  const row=(await getDb().prepare('SELECT encrypted_payload FROM self_test_cases WHERE id=?').get(receipt.reference))!;
  process.env.ANAMNES_STORAGE_KEY='67'.repeat(32);
  await assert.rejects(getSelfTestCase(admin,receipt.reference));
  enable();const parts=String(row.encrypted_payload).split('.');parts[3]=(parts[3][0]==='a'?'b':'a')+parts[3].slice(1);
  await getDb().prepare('UPDATE self_test_cases SET encrypted_payload=? WHERE id=?').run(parts.join('.'),receipt.reference);
  await assert.rejects(getSelfTestCase(admin,receipt.reference));
  await deleteSelfTestCase(admin,receipt.reference);
});

test('anamnes still stores full report and contact; new inbox reads the same encrypted record',async()=>{
  const receipt=await submitAnamnes({answers:{adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'},narrative:'SYNTHETIC_ANAMNES_DESCRIPTION',contact,sendConsent:true,submissionConsentVersion:anamnesSubmissionConsentVersion()});
  const item=(await getAnamnesCase(admin,receipt.reference))!;
  assert.equal(item.intake.narrative,'SYNTHETIC_ANAMNES_DESCRIPTION');assert.deepEqual(item.contact,contact);assert.ok(item.report.analysis);
  const metadata=(await listAnamnesContacts(admin)).find(row=>row.id===item.id)!;
  assert.deepEqual(Object.keys(metadata).sort(),['createdAt','email','expiresAt','id','name']);
  const row=(await getDb().prepare('SELECT encrypted_payload FROM anamnes_cases WHERE id=?').get(item.id))!;
  assert.ok(!String(row.encrypted_payload).includes(contact.name));
  // A pre-extraction v1 AES-GCM record remains readable, including absent optional fields.
  const oldId=randomUUID(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(process.env.ANAMNES_STORAGE_KEY!,'hex'),iv);
  cipher.setAAD(Buffer.from(`case:${oldId}`));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify({intake:{answers:item.intake.answers},report:item.report,contact:{name:'Historical synthetic visitor',email:'historical@example.test',phone:''},sendConsentAt:item.createdAt})),cipher.final()]);
  const encrypted=`v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  await getDb().prepare('INSERT INTO anamnes_cases(id,encrypted_payload,created_at,expires_at) VALUES(?,?,?,?)').run(oldId,encrypted,item.createdAt,item.expiresAt);
  assert.equal((await getAnamnesCase(admin,oldId))!.contact.name,'Historical synthetic visitor');
});

test('HTTP submission enforces same-origin, bounds, validation, no-store and rate limits',async()=>{
  const request=(body:unknown=input(),headers:Record<string,string>={})=>new Request('https://owned.example.test/api/sjalvtest/submit',{method:'POST',headers:{origin:'https://owned.example.test','content-type':'application/json',...headers},body:JSON.stringify(body)});
  await getDb().prepare("DELETE FROM rate_limits WHERE key LIKE 'anamnes:%'").run();
  const config=await configGET(new Request('https://owned.example.test/api/sjalvtest/submission-config'));
  assert.equal(config.status,200);assert.match(config.headers.get('cache-control')!,/no-store/);
  assert.ok(!JSON.stringify(await config.json()).includes(contact.email));
  assert.equal((await POST(request(input(),{origin:'https://attacker.invalid'}))).status,403);
  assert.equal((await POST(request(input(),{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await POST(request({result:{forged:true}}))).status,400);
  const response=await POST(request());assert.equal(response.status,201);
  assert.match(response.headers.get('cache-control')!,/no-store/);assert.match(response.headers.get('x-robots-tag')!,/noindex/);
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.deepEqual(Object.keys(await response.json()).sort(),['expiresAt','reference']);
  assert.equal((await POST(request({oversized:'x'.repeat(128*1024)}))).status,413);
  assert.equal((await POST(request(input(),{'content-type':'text/plain'}))).status,400);
  assert.equal((await POST(request())).status,429);
  await getDb().prepare("DELETE FROM rate_limits WHERE key LIKE 'anamnes:%'").run();
});

test('retention removes both kinds, rejects unauthenticated cleanup and hides expired records',async()=>{
  const self=await submitSelfTest(input());
  const anamnes=(await listAnamnesContacts(admin))[0];
  await getDb().prepare('UPDATE self_test_cases SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',self.reference);
  await getDb().prepare('UPDATE anamnes_cases SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',anamnes.id);
  process.env.CRON_SECRET='owned-synthetic-retention-key-at-least-32';
  assert.equal((await retentionGET(new Request('https://owned.example.test/api/anamnes/retention'))).status,403);
  const response=await retentionGET(new Request('https://owned.example.test/api/anamnes/retention',{headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:2});
  assert.equal(await getSelfTestCase(admin,self.reference),null);assert.equal(await getAnamnesCase(admin,anamnes.id),null);
  const expired=await submitSelfTest(input());
  await getDb().prepare('UPDATE self_test_cases SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',expired.reference);
  assert.equal(await getSelfTestCase(admin,expired.reference),null);
});

test('version eleven upgrades additively, preserving existing users and encrypted submissions',async()=>{
  const anamnes=(await listAnamnesContacts(admin))[0];
  const before=(await getDb().prepare('SELECT encrypted_payload FROM anamnes_cases WHERE id=?').get(anamnes.id))!;
  await getDb().exec('DROP TABLE self_test_cases; PRAGMA user_version=11;');
  await getDb().close();await getDb().initialize();
  assert.equal((await getDb().prepare('PRAGMA user_version').get())!.user_version,SCHEMA_VERSION);
  assert.deepEqual(await getDb().prepare('SELECT encrypted_payload FROM anamnes_cases WHERE id=?').get(anamnes.id),before);
  assert.ok(await getUser(admin.id));
  assert.deepEqual(await listSelfTestContacts(admin),[]);
  const submitted=await submitSelfTest({...input(),contact:{name:'No phone synthetic visitor',email:'no-phone@example.test'}});
  assert.equal((await getSelfTestCase(admin,submitted.reference))!.contact.phone,'');
});
