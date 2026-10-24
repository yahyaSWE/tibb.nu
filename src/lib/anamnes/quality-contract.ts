import { z } from 'zod';
import { AnswerMapSchema, PatternIdSchema } from './types';
export const qualityDatasetVersion='tcm-engineering-cases-2026-10-23-v1';
export const QualityCaseSchema=z.object({id:z.string().regex(/^case-\d{3}$/),category:z.enum(['single','compound','neighbor','conflict','incomplete','changes','abstain']),narrative:z.string(),answers:AnswerMapSchema,
  constructionNote:z.string(),engineeringTarget:PatternIdSchema.nullable()}).strict();
export type QualityCase=z.infer<typeof QualityCaseSchema>;
export const QualityReviewSchema=z.object({datasetVersion:z.literal(qualityDatasetVersion),caseId:z.string().regex(/^case-\d{3}$/),
  expectedStatus:z.enum(['supported_pattern','conflicting_evidence','insufficient_evidence']),expectedPatterns:z.array(PatternIdSchema).max(30),
  notes:z.string().trim().min(10).max(4000),approved:z.literal(true),revision:z.number().int().nonnegative(),
}).strict().refine(value=>value.expectedStatus!=='supported_pattern'||value.expectedPatterns.length>0,'Välj minst ett mönster för ett underbyggt utfall.').refine(value=>new Set(value.expectedPatterns).size===value.expectedPatterns.length,'Varje mönster får endast väljas en gång.');
export type QualityReview=z.infer<typeof QualityReviewSchema>;
export type StoredQualityReview=QualityReview&{reviewerId:number;reviewerName:string;reviewedAt:string};
