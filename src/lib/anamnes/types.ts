import { z } from 'zod';

// IDs are the only medical vocabulary the model may return. Public prose comes
// from the reviewed-in-code question/pattern catalog, never from model output.
export const questionIds = [
  'adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags',
  'focus','duration','onset','trend','priorAssessment','temperature','thirst','sweating','energy','appetite','stool','sleep','emotion','pain','stressDigestion',
  'afterMealBloat','nausea','reflux','abdominalPain','bowelRelief','foodTrigger','stoolOdor','constipation','sinking',
  'weakVoice','exertion','frequentInfections','windSensitivity','cough','phlegm','breathing','chestTightness',
  'sleepOnset','nightWaking','dreams','rumination','palpitations','mentalFatigue','irritability','ribTension','stressRelief',
  'pallor','dizziness','dryEyes','hairNails','menstruation','menstrualFlow','menstrualPain',
  'nightSweats','hotPalms','dryMouth','tinnitus','backWeakness','urination','edema','heaviness',
  'painLocation','painCharacter','painWarmth','painMovement','weatherPain','jointWarmth','stiffness',
  'tongueColor','tongueShape','tongueCoating','tongueCracks','tongueTeeth','tongueMoisture','pulse','heatTiming','currentInfection',
] as const;
export const QuestionIdSchema = z.enum(questionIds);
export type QuestionId = z.infer<typeof QuestionIdSchema>;
export const patternIds = [
  'spleenQiDeficiency','liverQiStagnation','liverInvadesSpleen','spleenDampness','stomachQiStagnation',
  'foodStagnation','liverFire','phlegmHeat','bloodStasis','qiSinking','liverBloodDeficiency',
  'heartBloodDeficiency','qiBloodDeficiency','lungWeiQiDeficiency','kidneyYinDeficiency',
  'yangDeficiency','windColdDampBi','dampHeatLower','dryness','exteriorWindHeat',
  'stomachYinDeficiency','heartSpleenDeficiency','liverSpleenBloodDeficiency','chronicBiDeficiency','liverBloodShenDisturbance',
  'kidneyYangColdDampBi','excessFireToxin','qiBloodYangDeficiency','spleenQiColdDampStagnation','liverQiStasisHeat',
] as const;
export const PatternIdSchema = z.enum(patternIds);
export type PatternId = z.infer<typeof PatternIdSchema>;
export const AnswerMapSchema = z.partialRecord(QuestionIdSchema, z.string().min(1).max(60));
export type AnswerMap = z.infer<typeof AnswerMapSchema>;
export interface Question {
  id: QuestionId;
  section: string;
  prompt: string;
  help?: string;
  options: { value: string; label: string }[];
  professionalOnly: boolean;
  retired?: boolean;
}
export const EvidenceRuleSchema = z.object({
  questionId: QuestionIdSchema, values: z.array(z.string().min(1).max(60)).min(1).max(20), weight: z.number().int().min(1).max(5),
}).strict();
export type EvidenceRule = z.infer<typeof EvidenceRuleSchema>;
export const EvidenceSchema = z.object({ questionId: QuestionIdSchema, answer: z.string(), label: z.string(), weight: z.number() }).strict();
export type Evidence = z.infer<typeof EvidenceSchema>;
export const PatternFindingSchema = z.object({
  id: PatternIdSchema, name: z.string(), pinyin: z.string(), hanzi: z.string(), explanation: z.string(), score: z.number(),
  supporting: z.array(EvidenceSchema), opposing: z.array(EvidenceSchema), missingQuestionIds: z.array(QuestionIdSchema), qualified: z.boolean(),
}).strict();
export type PatternFinding = z.infer<typeof PatternFindingSchema>;
export const DimensionSchema = z.object({ value: z.string(), supporting: z.array(EvidenceSchema), opposing: z.array(EvidenceSchema) }).strict();
export const PatternAnalysisSchema = z.object({
  status: z.enum(['insufficient','conflicting','preliminary']), primary: PatternFindingSchema.nullable(), secondary: z.array(PatternFindingSchema).max(2),
  patterns: z.array(PatternFindingSchema), baGang: z.object({ yinYang: DimensionSchema, interiorExterior: DimensionSchema, coldHeat: DimensionSchema, deficiencyExcess: DimensionSchema }).strict(),
  zangFu: z.array(z.string()), missingQuestionIds: z.array(QuestionIdSchema), conflicts: z.array(z.string()),
}).strict();
export type PatternAnalysis = z.infer<typeof PatternAnalysisSchema>;
export const SafetyAssessmentSchema = z.object({
  level: z.enum(['emergency','medical_review','consultation','clear','incomplete']), blocksFormulas: z.boolean(), flags: z.array(z.string()), missingQuestionIds: z.array(QuestionIdSchema),
}).strict();
export type SafetyAssessment = z.infer<typeof SafetyAssessmentSchema>;

const SourcePagesSchema = z.array(z.number().int().positive().max(10000)).min(1).max(128);
export const SupplierFactSchema = z.object({ text: z.string().min(1).max(8000), pages: SourcePagesSchema, kind: z.enum(['supplier','interpretation','unverified']) }).strict();
export const SupplierProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  supplier: z.string().min(1).max(160), document: z.string().min(1).max(200), documentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  productName: z.string().min(1).max(160), pdfProductName: z.string().min(1).max(160), formulaName: z.string().min(1).max(160), chineseName: z.string().max(100).nullable(), pages: SourcePagesSchema,
  ingredients: z.array(z.object({ pinyin: z.string().min(1).max(200), botanicalName: z.string().min(1).max(300), pages: SourcePagesSchema }).strict()).min(1).max(80),
  actions: z.array(SupplierFactSchema).max(100), traditionalPatterns: z.array(SupplierFactSchema).max(100), indications: z.array(SupplierFactSchema).max(100), explanation: z.array(SupplierFactSchema).max(100), temperature: z.array(SupplierFactSchema).max(100), cautions: z.array(SupplierFactSchema).max(100),
  verificationIssues: z.array(z.object({ code: z.string().min(1).max(100), message: z.string().min(1).max(2000), pages: SourcePagesSchema }).strict()).max(30), unverifiedFields: z.array(z.string().min(1).max(1000)).max(50),
}).strict();
export type SupplierProfile = z.infer<typeof SupplierProfileSchema>;
export const ReferenceSourceSchema = z.object({
  id:z.string().regex(/^special-book-[0-9]{3}$/),productName:z.string().min(1).max(200),document:z.string().min(1).max(200),documentSha256:z.string().regex(/^[a-f0-9]{64}$/),
  pages:SourcePagesSchema,ingredientStatement:z.string().max(10000),traditionalDescription:z.string().max(16000),
}).strict();
export type ReferenceSource = z.infer<typeof ReferenceSourceSchema>;
export const FormulaRecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/), name: z.string().min(1).max(160), pinyin: z.string().max(160), hanzi: z.string().max(100), swedishName: z.string().max(200), active: z.boolean(),
  primaryPatternIds: z.array(PatternIdSchema).min(1).max(patternIds.length), secondaryPatternIds: z.array(PatternIdSchema).max(patternIds.length), requiredPatternIds: z.array(PatternIdSchema).max(patternIds.length),
  supportingRules: z.array(EvidenceRuleSchema).max(40), opposingRules: z.array(EvidenceRuleSchema).max(40), requiredQuestionIds: z.array(QuestionIdSchema).max(questionIds.length),
  contraindicationRules: z.array(EvidenceRuleSchema).max(40).default([]),
  requiredSafetyRules: z.array(EvidenceRuleSchema).max(40).default([]),
  theoryExplanation: z.string().max(2000), scopeLimitation: z.string().max(2000), safetyNotes: z.array(z.string().max(1000)).max(20), contraindications: z.array(z.string().max(1000)).max(20), interactions: z.array(z.string().max(1000)).max(20),
  ingredients: z.array(z.string().max(200)).max(80), tongueIndicators: z.array(z.string().max(500)).max(20).default([]), pulseIndicators: z.array(z.string().max(500)).max(20).default([]), classicalSource: z.string().max(2000), identityEvidence: z.string().max(4000), ingredientEvidence: z.string().max(4000), safetyEvidence: z.string().max(4000), regulatoryEvidence: z.string().max(4000),
  productId: z.number().int().positive().nullable(), productUrl: z.string().max(300).nullable().optional(), productIdentityVerified: z.boolean(), ingredientsVerified: z.boolean(), safetyVerified: z.boolean(), regulatoryVerified: z.boolean(), updatedAt: z.string().max(40).optional(),
  supplierProfile: SupplierProfileSchema.nullable().default(null), requiresVerification: z.boolean().default(false), verificationResolution: z.string().trim().max(4000).default(''),
  referenceKind:z.enum(['assortment','special_order']).default('assortment'),referenceSource:ReferenceSourceSchema.nullable().default(null),
}).strict();
export type FormulaRecord = z.infer<typeof FormulaRecordSchema>;
export const FormulaMatchSchema = z.object({
  formulaId: z.string(), name: z.string(), pinyin: z.string(), hanzi: z.string(), swedishName: z.string(), score: z.number(),
  explanation: z.string(), supporting: z.array(EvidenceSchema), opposing: z.array(EvidenceSchema), missingQuestionIds: z.array(QuestionIdSchema),
  partial: z.boolean(), limitation: z.string(), safetyNotes: z.array(z.string()), productAvailable: z.boolean(), productId: z.number().nullable(), productUrl: z.string().nullable(),
  classicalName: z.string().max(160).default(''), requiresVerification: z.boolean().default(false), verificationNotes: z.array(z.string().max(1000)).max(10).default([]),
  referenceKind:z.enum(['assortment','special_order']).default('assortment'),
}).strict();
export type FormulaMatch = z.infer<typeof FormulaMatchSchema>;
export const ReportSchema = z.object({
  version: z.literal(2), analysis: PatternAnalysisSchema, safety: SafetyAssessmentSchema, formulaMatches: z.array(FormulaMatchSchema).max(3),
  formulaExclusions: z.array(z.object({ formulaId: z.string().max(80), name: z.string().max(160), reasons: z.array(z.string().max(1000)).min(1).max(40) }).strict()).max(200).default([]),
  formulaStatus: z.enum(['matched','no_match','safety_blocked','insufficient','disabled']), formulaReferencesEnabled: z.boolean(), source: z.enum(['rules','ai']), followUpQuestionIds: z.array(QuestionIdSchema).max(5),
}).strict();
export type Report = z.infer<typeof ReportSchema>;
// Fritext är opålitlig användardata, inte instruktioner eller bekräftade fynd.
// Behåll vanliga radbrytningar, men avvisa osynliga kontroll-/riktningskoder.
export const NarrativeSchema = z.string().trim().max(4000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/u.test(value), 'Ta bort osynliga kontrolltecken från beskrivningen.');
// Visitor-supplied names are retained for the therapist, never interpreted as
// clinical findings or included in an external model request.
export const MedicationNamesSchema = z.string().trim().max(1000, 'Ange högst 1 000 tecken.').refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/u.test(value), 'Ta bort osynliga kontrolltecken från läkemedelsnamnen.');
const consultationText = (maximum: number) => z.string().trim().max(maximum).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/u.test(value), 'Ta bort osynliga kontrolltecken från kompletteringen.');
const ConsultationQuestionNotesSchema = z.unknown().superRefine((value, context) => {
  // Inspect raw keys before record parsing can discard reserved object keys.
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => key === 'pulse' || !questionIds.includes(key as QuestionId))) {
    context.addIssue({ code: 'custom', message: 'Kompletteringarna måste tillhöra formulärets besökarfrågor.' });
  }
}).pipe(z.partialRecord(QuestionIdSchema.exclude(['pulse']), consultationText(400)));
export const ConsultationDetailsSchema = z.object({
  locations: consultationText(500).default(''), intensity: z.number().min(0).max(10).nullable().default(null),
  frequency: z.enum(['','daily','several_week','weekly','occasional','variable']).default(''),
  dailyImpact: consultationText(1200).default(''), goal: consultationText(1000).default(''),
  previousCare: consultationText(1500).default(''), lifestyle: consultationText(1500).default(''),
  medicationDetails: consultationText(1500).default(''), conditionDetails: consultationText(1500).default(''), allergyDetails: consultationText(1500).default(''),
  questionNotes: ConsultationQuestionNotesSchema.default({}),
}).strict().superRefine((value, context) => {
  if (Object.values(value.questionNotes).reduce((total, note) => total + (note?.length ?? 0), 0) > 6000) context.addIssue({ code: 'custom', path: ['questionNotes'], message: 'Ange sammanlagt högst 6 000 tecken i frågekommentarerna.' });
});
export type ConsultationDetails = z.infer<typeof ConsultationDetailsSchema>;
export function emptyConsultationDetails(): ConsultationDetails { return ConsultationDetailsSchema.parse({}); }
export const IntakeRequestSchema = z.object({ answers: AnswerMapSchema, narrative: NarrativeSchema.default(''), consultation: ConsultationDetailsSchema.default(emptyConsultationDetails), aiConsent: z.boolean().default(false), aiConsentVersion: z.string().max(128).optional(), formulaReferencesEnabled: z.boolean().default(true) }).strict();
export const AiDifferentialSchema = z.object({
  patternIds: z.array(PatternIdSchema).max(6), followUpQuestionIds: z.array(QuestionIdSchema).max(5),
}).strict();
export type AiDifferential = z.infer<typeof AiDifferentialSchema>;
// A transport counter, never a clinical stopping rule. The finite reviewed
// vocabulary and no-repeat selection bound the actual interview.
export const InterviewRoundSchema = z.number().int().min(0).max(1000);
export const InterviewRequestSchema = z.object({
  answers: AnswerMapSchema, narrative: NarrativeSchema.default(''), consultation: ConsultationDetailsSchema.default(emptyConsultationDetails), aiConsent: z.boolean().default(false), aiConsentVersion: z.string().max(128).optional(),
  round: InterviewRoundSchema, finalize: z.boolean().default(false), formulaReferencesEnabled: z.boolean().default(true),
}).strict();
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;
export const AiInterviewSchema = z.object({ patternIds: z.array(PatternIdSchema).max(6), questionIds: z.array(QuestionIdSchema).max(3), sufficient: z.boolean() }).strict();
export type AiInterview = z.infer<typeof AiInterviewSchema>;
export const InterviewResponseSchema = z.object({
  report: ReportSchema, questionIds: z.array(QuestionIdSchema).max(3), complete: z.boolean(), reason: z.enum(['continue','enough','exhausted','limit','fallback','safety']),
  receipt: z.object({ expiresAt: z.iso.datetime(), signature: z.string().regex(/^[a-f0-9]{64}$/), aiConsentVersion: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(),
}).strict();
export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;
