import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, transaction } from "../database";
import type { User } from "../types";
import { anamnesAiConfig, anamnesRetentionDays, anamnesSubmissionsAvailable, anamnesSubmissionConsentVersion } from "./config";
import { AnamnesError } from "./http";
import { AnswerMapSchema, ConsultationDetailsSchema, MedicationNamesSchema, NarrativeSchema, DifferentialPatternIdSchema as PatternIdSchema, ReportSchema, emptyConsultationDetails, type AnswerMap, type ConsultationDetails, type Report } from "./types";
import { buildVisitorDifferential } from './public-differential';
import { validateAnswers } from "./questions";
import { getFormulaCatalogEntry, publicFormulaCatalog } from "./catalog";
import { AnalysisReceiptSchema, verifyAnalysisReceipt } from "./ai";
import { normalizeConsultationDetails } from "./consultation";
import { IntakeContactSchema as ContactSchema } from "../intake-contact";
import { encryptIntake as encrypt, decryptIntake as decrypt } from "./secure-storage";

const IdSchema = z.string().uuid();

export const SubmitAnamnesSchema = z.object({ answers: AnswerMapSchema, narrative: NarrativeSchema.default(""), consultation: ConsultationDetailsSchema.default(emptyConsultationDetails), medicationNames: MedicationNamesSchema.default(""), formulaReferencesEnabled: z.boolean().default(true), sendConsent: z.literal(true), submissionConsentVersion: z.string().regex(/^[a-f0-9]{64}$/), contact: ContactSchema, report: ReportSchema.optional(), receipt: AnalysisReceiptSchema.optional() }).strict().refine((value) => !!value.report === !!value.receipt, { message: "Rapportens underlag saknas." }).refine((value) => value.answers.medication !== "yes" || !!value.medicationNames, { path: ["medicationNames"], message: "Ange namnen på dina läkemedel eller kosttillskott." }).transform(value => ({ ...value, medicationNames: value.answers.medication === "yes" ? value.medicationNames : "", consultation: normalizeConsultationDetails(value.consultation, value.answers) }));
const ReviewFieldsSchema = z.object({ notes: z.string().max(10000), tongueNotes: z.string().max(5000), pulseNotes: z.string().max(5000), corrections: z.string().max(10000), finalAssessment: z.string().max(10000), selectedPrimaryPatternId: PatternIdSchema.nullable().default(null), selectedSecondaryPatternIds: z.array(PatternIdSchema).max(2).default([]), selectedFormulaId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/).nullable().default(null), formulaNotes: z.string().max(5000).default("") }).strict();
export const AnamnesReviewInputSchema = ReviewFieldsSchema.extend({ expectedRevision: z.number().int().min(0) }).superRefine((value, context) => {
  if (new Set(value.selectedSecondaryPatternIds).size !== value.selectedSecondaryPatternIds.length || value.selectedPrimaryPatternId && value.selectedSecondaryPatternIds.includes(value.selectedPrimaryPatternId))
    context.addIssue({ code: 'custom', path: ['selectedSecondaryPatternIds'], message: 'Välj olika huvud- och sekundärmönster.' });
});
export type AnamnesReviewInput = z.infer<typeof AnamnesReviewInputSchema>;
export type AnamnesReview = Omit<AnamnesReviewInput, "expectedRevision"> & { revision: number; authorId: number; authorName: string; reviewedAt: string };
const StoredConsentSchema = z.object({ submissionVersion: z.string(), submissionNotice: z.string(), recordedAt: z.string(), retentionDays: z.number().int(), aiNotice: z.string().nullable(), aiConsentVersion: z.string().nullable() }).strict();
const StoredProvenanceSchema = z.object({ source: z.enum(["rules", "ai"]), provider: z.string().nullable(), model: z.string().nullable(), analysisReceipt: AnalysisReceiptSchema.nullable() }).strict();
export type StoredAnamnesCase = { id: string; createdAt: string; expiresAt: string; revision: number; intake: { answers: AnswerMap; narrative: string; medicationNames: string; consultation: ConsultationDetails }; report: Report; contact: z.infer<typeof ContactSchema>; reviews: AnamnesReview[]; consent?: z.infer<typeof StoredConsentSchema>; provenance?: z.infer<typeof StoredProvenanceSchema> };
export function therapistAccess(user: User | null): boolean {
  const allowed = (process.env.ANAMNES_THERAPIST_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  return user?.role === "admin" && allowed.includes(user.email.toLowerCase());
}
function assertTherapist(actor: User) {
  if (!therapistAccess(actor)) throw new AnamnesError("Du har inte behörighet till denna vy.", 403);
}
const CasePayloadSchema = z.object({ intake: z.object({ answers: AnswerMapSchema, narrative: NarrativeSchema.default(""), medicationNames: MedicationNamesSchema.default(""), consultation: ConsultationDetailsSchema.default(emptyConsultationDetails) }).strict(), report: ReportSchema, contact: ContactSchema, sendConsentAt: z.string(), consent: StoredConsentSchema.optional(), provenance: StoredProvenanceSchema.optional() }).strict();
const ReviewPayloadSchema = ReviewFieldsSchema.extend({ revision: z.number().int().positive(), authorId: z.number().int().positive(), authorName: z.string(), reviewedAt: z.string() }).strict();
export async function pruneExpiredAnamnesCases(now = new Date()) {
  return (await getDb().prepare("DELETE FROM anamnes_cases WHERE expires_at<=?").run(now.toISOString())).changes;
}
export async function submitAnamnes(input: unknown): Promise<{ reference: string; expiresAt: string }> {
  const answers = validateAnswers(input && typeof input === "object" ? (input as Record<string, unknown>).answers : undefined);
  const value = SubmitAnamnesSchema.parse(input);
  if (!anamnesSubmissionsAvailable()) throw new AnamnesError("Inskickning till behandlare är inte aktiverad.", 503);
  if (value.submissionConsentVersion !== anamnesSubmissionConsentVersion()) throw new AnamnesError("Integritetsinformationen har ändrats. Ladda om formuläret och bekräfta ditt val igen.", 409);
  // Only a server-signed, short-lived original AI report may cross this
  // boundary. Missing reports are recomputed by rules without another AI call.
  if (value.report && value.receipt && (!verifyAnalysisReceipt(answers, value.report, value.receipt, value.narrative, value.consultation) || value.report.formulaReferencesEnabled !== value.formulaReferencesEnabled))
    throw new AnamnesError("Analysens underlag har ändrats eller löpt ut. Gör om analysen innan du skickar den.", 409);
  // A partial unsigned intake must not become a stronger hypothesis merely
  // because the server recomputes it for storage. Signed originals and already
  // stored historical cases retain their original reports unchanged.
  const report = value.report ?? buildVisitorDifferential({...value,answers},await publicFormulaCatalog(),null,'local',true).report;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const retentionDays = anamnesRetentionDays();
  const expiresAt = new Date(Date.parse(createdAt) + retentionDays * 86400000).toISOString();
  const ai = anamnesAiConfig();
  const consent = { submissionVersion: value.submissionConsentVersion, submissionNotice: process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE!.trim(), recordedAt: createdAt, retentionDays, aiNotice: report.source === "ai" ? ai.privacyNotice : null, aiConsentVersion: value.receipt?.aiConsentVersion ?? null };
  const provenance = { source: report.source, provider: report.source === "ai" ? ai.providerLabel : null, model: report.source === "ai" ? ai.model : null, analysisReceipt: value.receipt ?? null };
  const encrypted = encrypt({ intake: { answers, narrative: value.narrative, medicationNames: value.medicationNames, consultation: value.consultation }, report, contact: value.contact, sendConsentAt: createdAt, consent, provenance }, `case:${id}`);
  await transaction(async () => {
    await pruneExpiredAnamnesCases();
    await getDb().prepare("INSERT INTO anamnes_cases(id,encrypted_payload,created_at,expires_at) VALUES(?,?,?,?)").run(id, encrypted, createdAt, expiresAt);
  });
  return { reference: id, expiresAt };
}
export async function listAnamnesCases(actor: User): Promise<{ id: string; createdAt: string; expiresAt: string; revision: number }[]> {
  assertTherapist(actor);
  await pruneExpiredAnamnesCases();
  const rows = await getDb().prepare("SELECT id,created_at,expires_at,revision FROM anamnes_cases WHERE expires_at>? ORDER BY created_at DESC LIMIT 200").all(new Date().toISOString());
  return rows.map((row) => ({ id: String(row.id), createdAt: String(row.created_at), expiresAt: String(row.expires_at), revision: Number(row.revision) }));
}
export async function getAnamnesCase(actor: User, id: string): Promise<StoredAnamnesCase | null> {
  assertTherapist(actor);
  IdSchema.parse(id);
  await pruneExpiredAnamnesCases();
  const row = await getDb().prepare("SELECT * FROM anamnes_cases WHERE id=? AND expires_at>?").get(id, new Date().toISOString());
  if (!row) return null;
  const payload = CasePayloadSchema.parse(decrypt(String(row.encrypted_payload), `case:${id}`));
  const reviews = await getDb().prepare("SELECT revision,encrypted_payload FROM anamnes_case_reviews WHERE case_id=? ORDER BY revision").all(id);
  return { id, createdAt: String(row.created_at), expiresAt: String(row.expires_at), revision: Number(row.revision), intake: payload.intake, report: payload.report, contact: payload.contact, consent: payload.consent, provenance: payload.provenance, reviews: reviews.map((review) => ReviewPayloadSchema.parse(decrypt(String(review.encrypted_payload), `review:${id}:${review.revision}`))) };
}
export async function reviewAnamnesCase(actor: User, id: string, input: unknown): Promise<void> {
  assertTherapist(actor);
  IdSchema.parse(id);
  const value = AnamnesReviewInputSchema.parse(input);
  if (value.selectedFormulaId && !(await getFormulaCatalogEntry(value.selectedFormulaId))?.active)
    throw new AnamnesError("Välj en aktuell aktiv formel eller lämna formelvalet tomt.");
  const revision = value.expectedRevision + 1;
  const reviewedAt = new Date().toISOString();
  const { expectedRevision: _expected, ...notes } = value;
  const encrypted = encrypt({ ...notes, revision, reviewedAt, authorId: actor.id, authorName: actor.name }, `review:${id}:${revision}`);
  await transaction(async () => {
    const changed = await getDb().prepare("UPDATE anamnes_cases SET revision=? WHERE id=? AND revision=? AND expires_at>?").run(revision, id, value.expectedRevision, reviewedAt);
    if (changed.changes !== 1) throw new AnamnesError("Anamnesen har ändrats eller löpt ut. Ladda om sidan.", 409);
    await getDb().prepare("INSERT INTO anamnes_case_reviews(case_id,revision,encrypted_payload,reviewed_at,author_id) VALUES(?,?,?,?,?)").run(id, revision, encrypted, reviewedAt, actor.id);
  });
}
export async function deleteAnamnesCase(actor: User, id: string): Promise<void> {
  assertTherapist(actor);
  IdSchema.parse(id);
  await getDb().prepare("DELETE FROM anamnes_cases WHERE id=?").run(id);
}

/** Minimal contact DTO for the authorized, private combined intake list. */
export async function listAnamnesContacts(actor: User) {
  assertTherapist(actor);
  await pruneExpiredAnamnesCases();
  const rows=await getDb().prepare("SELECT id,encrypted_payload,created_at,expires_at FROM anamnes_cases WHERE expires_at>? ORDER BY created_at DESC LIMIT 100").all(new Date().toISOString());
  return rows.map(row => {
    const id=String(row.id);
    const payload=CasePayloadSchema.parse(decrypt(String(row.encrypted_payload),`case:${id}`));
    return {id,createdAt:String(row.created_at),expiresAt:String(row.expires_at),name:payload.contact.name,email:payload.contact.email};
  });
}
