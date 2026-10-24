import { z } from 'zod';
import { getInitialQuestions, isPublicQuestion, questionById, validateAnswers } from './questions';
import { AnswerMapSchema, ConsultationDetailsSchema, MedicationNamesSchema, NarrativeSchema, QuestionIdSchema } from './types';

export const draftLifetimeMs=24*60*60*1000;
const publicIds=z.array(QuestionIdSchema).max(80).refine(ids=>new Set(ids).size===ids.length&&ids.every(id=>{const question=questionById.get(id);return question&&isPublicQuestion(question);}), 'Utkastet innehåller ogiltiga frågor.');
const draftAnswers=z.unknown().superRefine((value,context)=>{try{validateAnswers(value);}catch{context.addIssue({code:'custom',message:'Utkastets svar kunde inte läsas.'});}}).pipe(AnswerMapSchema);
/** Deliberately excludes contact data, provider consent, send consent, catalog,
 * model proposals, reports and signed receipts. A draft grants no authority. */
export const AnamnesDraftSchema=z.object({
  version:z.literal(1),answers:draftAnswers,narrative:NarrativeSchema,medicationNames:MedicationNamesSchema,consultation:ConsultationDetailsSchema,
  flow:z.enum(['ai','rules']),position:z.object({stage:z.enum(['intro','safety','questions','followup','interview','report']),
    questionId:QuestionIdSchema.refine(id=>{const question=questionById.get(id);return question&&isPublicQuestion(question);}).nullable(),index:z.number().int().min(0).max(80),history:publicIds,followups:publicIds,
    round:z.number().int().min(0).max(1000)}).strict(),
}).strict();
export type AnamnesDraft=z.infer<typeof AnamnesDraftSchema>;
export function draftResumeCursor(input:AnamnesDraft){
  const draft=AnamnesDraftSchema.parse(input);
  const ids=draft.position.stage==='followup'?draft.position.followups:draft.position.history.length?draft.position.history:getInitialQuestions(draft.answers).filter(question=>!['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags'].includes(question.id)).map(question=>question.id);
  const current=draft.position.questionId?ids.indexOf(draft.position.questionId):-1;
  const position=Math.max(0,Math.min(current>=0?current:draft.position.index,ids.length-1));
  // Reconsider pending questions after the current one using current rules.
  const history=ids.slice(0,position+1).map(id=>questionById.get(id)!).filter(isPublicQuestion);
  return {history,index:Math.max(0,history.length-1)};
}
export type EncryptedDraft={version:1;revision:string;expiresAt:number;key:CryptoKey;iv:Uint8Array<ArrayBuffer>;ciphertext:ArrayBuffer};
export type DraftStorage={read:()=>Promise<EncryptedDraft|null>;replace:(value:EncryptedDraft,expectedRevision:string|null)=>Promise<void>;remove:(expectedRevision?:string|null)=>Promise<void>};
const associatedData=(expiresAt:number)=>new TextEncoder().encode(`tibb.anamnes.local-draft.v1:${expiresAt}`);

/** Serializes save/erase so a slow encryption cannot resurrect a cleared draft. */
export class EncryptedAnamnesDraftStore {
  private queue:Promise<unknown>=Promise.resolve();
  private revision:string|null=null;
  private key:CryptoKey|null=null;
  private generation=0;
  constructor(private storage:DraftStorage,private crypto:Crypto=globalThis.crypto,private now:()=>number=Date.now){}
  private run<T>(operation:()=>Promise<T>):Promise<T>{const result=this.queue.then(operation);this.queue=result.catch(()=>{});return result;}
  cancelPendingSaves(){this.generation++;}
  load():Promise<{draft:AnamnesDraft;expiresAt:number}|null>{return this.run(async()=>{
    const record=await this.storage.read();if(!record)return null;
    try {
      if(record.version!==1||!Number.isFinite(record.expiresAt)||record.expiresAt<=this.now()||record.expiresAt>this.now()+draftLifetimeMs+60000
        ||!record.key||record.key.extractable||record.key.algorithm.name!=='AES-GCM'||record.ciphertext.byteLength>128*1024)throw new Error('Invalid draft');
      const plaintext=await this.crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:associatedData(record.expiresAt)},record.key,record.ciphertext);
      const draft=AnamnesDraftSchema.parse(JSON.parse(new TextDecoder().decode(plaintext)));
      this.key=record.key;this.revision=record.revision;
      return {draft,expiresAt:record.expiresAt};
    }catch{await this.storage.remove(typeof record.revision==='string'?record.revision:null);this.key=null;this.revision=null;return null;}
  });}
  save(value:AnamnesDraft):Promise<number|null>{
    const generation=this.generation;
    // Snapshot before queuing: later edits must not mutate an earlier save.
    const snapshot=JSON.stringify(AnamnesDraftSchema.parse(value));
    return this.run(async()=>{
      if(generation!==this.generation)return null;
      const key=this.key??await this.crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=this.crypto.getRandomValues(new Uint8Array(12)),expiresAt=this.now()+draftLifetimeMs;
      const ciphertext=await this.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:associatedData(expiresAt)},key,new TextEncoder().encode(snapshot));
      if(generation!==this.generation)return null;
      const revision=this.crypto.randomUUID();
      await this.storage.replace({version:1,revision,expiresAt,key,iv,ciphertext},this.revision);
      this.key=key;this.revision=revision;return expiresAt;
    });
  }
  clear():Promise<void>{this.cancelPendingSaves();return this.run(async()=>{await this.storage.remove();this.key=null;this.revision=null;});}
}
