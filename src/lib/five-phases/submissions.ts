import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb, transaction } from '../database';
import type { User } from '../types';
import { IntakeContactSchema } from '../intake-contact';
import { anamnesRetentionDays, anamnesSubmissionConsentVersion, getAnamnesConfigStatus } from '../anamnes/config';
import { therapistAccess } from '../anamnes/cases';
import { encryptIntake, decryptIntake } from '../anamnes/secure-storage';
import { AnamnesError } from '../anamnes/http';
import { QUESTIONS } from './questions';
import { calculateResult } from './scoring';
import { ELEMENTS } from './types';

const AnswerSchema=z.object({questionId:z.number().int(),value:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)])}).strict();
const AnswersSchema=z.array(AnswerSchema).length(QUESTIONS.length).superRefine((answers,ctx) => {
  try { calculateResult(answers); } catch { ctx.addIssue({code:'custom',message:'Besvara varje fråga i självtestet exakt en gång.'}); }
});
const ScoreSchema=z.object({element:z.enum(ELEMENTS),rawScore:z.number().int().min(8).max(40),percentage:z.number().int().min(0).max(100)}).strict();
const ResultSchema=z.object({scores:z.array(ScoreSchema).length(5),primary:ScoreSchema,secondary:ScoreSchema,isMixed:z.boolean(),tiedElements:z.array(z.enum(ELEMENTS)).min(1).max(5)}).strict();
export const SubmitSelfTestSchema=z.object({answers:AnswersSchema,contact:IntakeContactSchema,sendConsent:z.literal(true),submissionConsentVersion:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const PayloadSchema=z.object({
  version:z.literal(1),answers:AnswersSchema,result:ResultSchema,contact:IntakeContactSchema,
  questions:z.array(z.object({id:z.number().int(),text:z.string().max(1000),element:z.enum(ELEMENTS)}).strict()).length(QUESTIONS.length),
  consent:z.object({version:z.string(),notice:z.string(),recordedAt:z.string(),retentionDays:z.number().int().min(1).max(90)}).strict(),
}).strict();
export type SelfTestCase=z.infer<typeof PayloadSchema> & {id:string;createdAt:string;expiresAt:string};
const IdSchema=z.string().uuid();

export function selfTestSubmissionConfig() {
  const shared=getAnamnesConfigStatus().submissions;
  const notice=`Du väljer att skicka självtestets 40 svar, poängresultat och dina kontaktuppgifter till Tibb.nu (Joart Group AB, 559363-3893) som underlag inför kontakt eller konsultation. Underlaget lagras krypterat i högst ${shared.retentionDays} dagar och kan läsas av behörig administratör/behandlare. Inget skickas till en AI-leverantör. ${shared.available ? shared.notice : ''}`.trim();
  const consentVersion=createHash('sha256').update(JSON.stringify(['self-test-submission-v1',anamnesSubmissionConsentVersion(),notice])).digest('hex');
  return {available:shared.available,retentionDays:shared.retentionDays,notice,consentVersion};
}
function authorize(actor: User) {
  if (!therapistAccess(actor)) throw new AnamnesError('Du har inte behörighet till denna vy.',403);
}
export async function pruneExpiredSelfTests(now=new Date()) {
  return (await getDb().prepare('DELETE FROM self_test_cases WHERE expires_at<=?').run(now.toISOString())).changes;
}
export async function submitSelfTest(input: unknown) {
  const value=SubmitSelfTestSchema.parse(input);
  const config=selfTestSubmissionConfig();
  if (!config.available) throw new AnamnesError('Inskickning till behandlare är inte aktiverad.',503);
  if (value.submissionConsentVersion!==config.consentVersion) throw new AnamnesError('Informationen har ändrats. Ladda om formuläret och bekräfta ditt val igen.',409);
  const id=randomUUID();
  const createdAt=new Date().toISOString();
  const expiresAt=new Date(Date.parse(createdAt)+anamnesRetentionDays()*86400000).toISOString();
  // Recompute on the server. Never accept a claimed result or profile from the browser.
  const payload=PayloadSchema.parse({version:1,answers:value.answers,result:calculateResult(value.answers),contact:value.contact,
    questions:QUESTIONS.map(({id,text,element})=>({id,text,element})),
    consent:{version:value.submissionConsentVersion,notice:config.notice,recordedAt:createdAt,retentionDays:config.retentionDays}});
  const encrypted=encryptIntake(payload,`self-test:${id}`);
  await transaction(async () => {
    await pruneExpiredSelfTests();
    await getDb().prepare('INSERT INTO self_test_cases(id,encrypted_payload,created_at,expires_at) VALUES(?,?,?,?)').run(id,encrypted,createdAt,expiresAt);
  });
  return {reference:id,expiresAt};
}
export async function listSelfTestContacts(actor: User) {
  authorize(actor);
  await pruneExpiredSelfTests();
  const rows=await getDb().prepare('SELECT id,encrypted_payload,created_at,expires_at FROM self_test_cases WHERE expires_at>? ORDER BY created_at DESC LIMIT 100').all(new Date().toISOString());
  return rows.map(row => {
    const id=String(row.id);
    const payload=PayloadSchema.parse(decryptIntake(String(row.encrypted_payload),`self-test:${id}`));
    return {id,createdAt:String(row.created_at),expiresAt:String(row.expires_at),name:payload.contact.name,email:payload.contact.email};
  });
}
export async function getSelfTestCase(actor: User,id: string): Promise<SelfTestCase|null> {
  authorize(actor);IdSchema.parse(id);
  await pruneExpiredSelfTests();
  const row=await getDb().prepare('SELECT * FROM self_test_cases WHERE id=? AND expires_at>?').get(id,new Date().toISOString());
  if (!row) return null;
  const payload=PayloadSchema.parse(decryptIntake(String(row.encrypted_payload),`self-test:${id}`));
  return {...payload,id,createdAt:String(row.created_at),expiresAt:String(row.expires_at)};
}
export async function deleteSelfTestCase(actor: User,id: string) {
  authorize(actor);IdSchema.parse(id);
  await getDb().prepare('DELETE FROM self_test_cases WHERE id=?').run(id);
}
