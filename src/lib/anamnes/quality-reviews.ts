import 'server-only';
import { z } from 'zod';
import { getDb, transaction } from '../database';
import type { User } from '../types';
import { therapistAccess } from './cases';
import { AnamnesError } from './http';
import { qualityCases } from './quality-cases';
import { QualityReviewSchema, qualityDatasetVersion, type StoredQualityReview } from './quality-contract';

const prefix=`anamnes_quality_review:${qualityDatasetVersion}:`;
function authorize(actor:User){if(!therapistAccess(actor))throw new AnamnesError('Behandlarbehörighet krävs.',403);}
function parseStored(raw:unknown):StoredQualityReview|null {
  try {const value=JSON.parse(String(raw));const {reviewerId,reviewerName,reviewedAt,...fields}=value;const review=QualityReviewSchema.parse(fields);return {...review,...z.object({reviewerId:z.number().int().positive(),reviewerName:z.string(),reviewedAt:z.iso.datetime()}).parse({reviewerId,reviewerName,reviewedAt})};}catch{return null;}
}
export async function listQualityReviews(actor:User):Promise<StoredQualityReview[]> {
  authorize(actor);
  const rows=await getDb().prepare('SELECT key,value FROM app_meta WHERE key GLOB ?').all(`${prefix}*`);
  return rows.flatMap(row=>{const review=parseStored(row.value);return review&&row.key===prefix+review.caseId&&qualityCases.some(item=>item.id===review.caseId)?[review]:[];});
}
export async function saveQualityReview(actor:User,input:unknown):Promise<StoredQualityReview> {
  authorize(actor);
  const value=QualityReviewSchema.parse(input);
  if(!qualityCases.some(item=>item.id===value.caseId))throw new AnamnesError('Fallet finns inte.',404);
  return transaction(async()=>{
    const key=prefix+value.caseId,row=await getDb().prepare('SELECT value FROM app_meta WHERE key=?').get(key);
    const previous=row?parseStored(row.value):null;
    if(row&&!previous)throw new AnamnesError('Den sparade granskningen kunde inte läsas.',409);
    if((previous?.revision??0)!==value.revision)throw new AnamnesError('Granskningen har ändrats. Ladda om fallet.',409);
    const saved={...value,revision:value.revision+1,reviewerId:actor.id,reviewerName:actor.name,reviewedAt:new Date().toISOString()};
    if(row){const result=await getDb().prepare('UPDATE app_meta SET value=? WHERE key=? AND value=?').run(JSON.stringify(saved),key,String(row.value));if(result.changes!==1)throw new AnamnesError('Granskningen har ändrats. Ladda om fallet.',409);}
    else await getDb().prepare('INSERT INTO app_meta(key,value) VALUES(?,?)').run(key,JSON.stringify(saved));
    return saved;
  });
}
