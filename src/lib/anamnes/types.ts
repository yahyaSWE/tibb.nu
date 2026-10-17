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
  'tongueColor','tongueShape','tongueCoating','tongueCracks','tongueTeeth','tongueMoisture','pulse',
] as const;
export const QuestionIdSchema = z.enum(questionIds);
export type QuestionId = z.infer<typeof QuestionIdSchema>;
export const patternIds = [
  'spleenQiDeficiency','liverQiStagnation','liverInvadesSpleen','spleenDampness','stomachQiStagnation',
  'foodStagnation','liverFire','phlegmHeat','bloodStasis','qiSinking','liverBloodDeficiency',
  'heartBloodDeficiency','qiBloodDeficiency','lungWeiQiDeficiency','kidneyYinDeficiency',
  'yangDeficiency','windColdDampBi','dampHeatLower','dryness','exteriorWindHeat',
  'stomachYinDeficiency','heartSpleenDeficiency','liverSpleenBloodDeficiency','chronicBiDeficiency','liverBloodShenDisturbance',
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

export const FormulaRecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/), name: z.string().min(1).max(160), pinyin: z.string().max(160), hanzi: z.string().max(100), swedishName: z.string().max(200), active: z.boolean(),
  primaryPatternIds: z.array(PatternIdSchema).min(1).max(25), secondaryPatternIds: z.array(PatternIdSchema).max(25), requiredPatternIds: z.array(PatternIdSchema).max(25),
  supportingRules: z.array(EvidenceRuleSchema).max(40), opposingRules: z.array(EvidenceRuleSchema).max(40), requiredQuestionIds: z.array(QuestionIdSchema).max(78),
  theoryExplanation: z.string().max(2000), scopeLimitation: z.string().max(2000), safetyNotes: z.array(z.string().max(1000)).max(20), contraindications: z.array(z.string().max(1000)).max(20), interactions: z.array(z.string().max(1000)).max(20),
  ingredients: z.array(z.string().max(200)).max(80), tongueIndicators: z.array(z.string().max(500)).max(20).default([]), pulseIndicators: z.array(z.string().max(500)).max(20).default([]), classicalSource: z.string().max(2000), identityEvidence: z.string().max(4000), ingredientEvidence: z.string().max(4000), safetyEvidence: z.string().max(4000), regulatoryEvidence: z.string().max(4000),
  productId: z.number().int().positive().nullable(), productUrl: z.string().max(300).nullable().optional(), productIdentityVerified: z.boolean(), ingredientsVerified: z.boolean(), safetyVerified: z.boolean(), regulatoryVerified: z.boolean(), updatedAt: z.string().max(40).optional(),
}).strict();
export type FormulaRecord = z.infer<typeof FormulaRecordSchema>;
export const FormulaMatchSchema = z.object({
  formulaId: z.string(), name: z.string(), pinyin: z.string(), hanzi: z.string(), swedishName: z.string(), score: z.number(),
  explanation: z.string(), supporting: z.array(EvidenceSchema), opposing: z.array(EvidenceSchema), missingQuestionIds: z.array(QuestionIdSchema),
  partial: z.boolean(), limitation: z.string(), safetyNotes: z.array(z.string()), productAvailable: z.boolean(), productId: z.number().nullable(), productUrl: z.string().nullable(),
}).strict();
export type FormulaMatch = z.infer<typeof FormulaMatchSchema>;
export const ReportSchema = z.object({
  version: z.literal(2), analysis: PatternAnalysisSchema, safety: SafetyAssessmentSchema, formulaMatches: z.array(FormulaMatchSchema).max(3),
  formulaStatus: z.enum(['matched','no_match','safety_blocked','insufficient','disabled']), formulaReferencesEnabled: z.boolean(), source: z.enum(['rules','ai']), followUpQuestionIds: z.array(QuestionIdSchema).max(5),
}).strict();
export type Report = z.infer<typeof ReportSchema>;
// Fritext är opålitlig användardata, inte instruktioner eller bekräftade fynd.
// Behåll vanliga radbrytningar, men avvisa osynliga kontroll-/riktningskoder.
export const NarrativeSchema = z.string().trim().max(4000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}]/u.test(value), 'Ta bort osynliga kontrolltecken från beskrivningen.');
export const IntakeRequestSchema = z.object({ answers: AnswerMapSchema, narrative: NarrativeSchema.default(''), aiConsent: z.boolean().default(false), aiConsentVersion: z.string().max(128).optional(), formulaReferencesEnabled: z.boolean().default(true) }).strict();
export const AiDifferentialSchema = z.object({
  patternIds: z.array(PatternIdSchema).max(6), followUpQuestionIds: z.array(QuestionIdSchema).max(5),
}).strict();
export type AiDifferential = z.infer<typeof AiDifferentialSchema>;
export const InterviewRoundSchema = z.number().int().min(0).max(5);
export const InterviewRequestSchema = z.object({
  answers: AnswerMapSchema, narrative: NarrativeSchema.default(''), aiConsent: z.boolean().default(false), aiConsentVersion: z.string().max(128).optional(),
  round: InterviewRoundSchema, formulaReferencesEnabled: z.boolean().default(true),
}).strict();
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;
export const AiInterviewSchema = z.object({ patternIds: z.array(PatternIdSchema).max(6), questionIds: z.array(QuestionIdSchema).max(3), sufficient: z.boolean() }).strict();
export type AiInterview = z.infer<typeof AiInterviewSchema>;
export const InterviewResponseSchema = z.object({
  report: ReportSchema, questionIds: z.array(QuestionIdSchema).max(3), complete: z.boolean(), reason: z.enum(['continue','enough','limit','fallback','safety']),
  receipt: z.object({ expiresAt: z.iso.datetime(), signature: z.string().regex(/^[a-f0-9]{64}$/), aiConsentVersion: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(),
}).strict();
export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;
