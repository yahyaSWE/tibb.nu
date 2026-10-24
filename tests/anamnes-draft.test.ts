import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnamnesDraftSchema, draftLifetimeMs, draftResumeCursor, EncryptedAnamnesDraftStore, type AnamnesDraft, type DraftStorage, type EncryptedDraft } from '../src/lib/anamnes/draft';
import { emptyConsultationDetails } from '../src/lib/anamnes/types';

function memory(){
  let record:EncryptedDraft|null=null;
  const storage:DraftStorage={read:async()=>record,replace:async(value,expected)=>{if((record?.revision??null)!==expected)throw new Error('Concurrent edit');record=structuredClone(value);},remove:async expected=>{if(expected===undefined||(record?.revision??null)===expected)record=null;}};
  return {storage,get record(){return record;},set record(value:EncryptedDraft|null){record=value;}};
}
const example=():AnamnesDraft=>({version:1,answers:{adult:'yes',pregnancy:'no',medication:'yes',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',focus:'digestion',duration:'months',onset:'gradual',trend:'stable',energy:'low'},
  narrative:'FICTIONAL_PRIVATE_STORY',medicationNames:'FICTIONAL_PRIVATE_MEDICATION',consultation:{...emptyConsultationDetails(),dailyImpact:'FICTIONAL_PRIVATE_CONTEXT'},flow:'ai',position:{stage:'interview',questionId:'stool',index:2,history:['energy','appetite','stool','temperature'],followups:[],round:2}});

test('an opted-in encrypted draft survives a new store and preserves the exact question without plaintext health data',async()=>{
  const db=memory(),writer=new EncryptedAnamnesDraftStore(db.storage);
  const expiry=await writer.save(example());assert.ok(expiry&&expiry>Date.now());
  assert.equal(db.record?.key.extractable,false);assert.ok(db.record?.ciphertext instanceof ArrayBuffer);
  assert.equal(JSON.stringify(db.record).includes('FICTIONAL_PRIVATE'),false);
  await assert.rejects(crypto.subtle.exportKey('raw',db.record!.key));
  const reader=new EncryptedAnamnesDraftStore(db.storage),loaded=await reader.load();assert.deepEqual(loaded?.draft,example());
  const cursor=draftResumeCursor(loaded!.draft);assert.equal(cursor.history[cursor.index].id,'stool');assert.deepEqual(cursor.history.map(question=>question.id),['energy','appetite','stool']);
});

test('draft schema cannot persist contact details, provider/send consent, reports or receipts',()=>{
  for(const key of ['contact','aiConsent','aiConsentVersion','sendConsentVersion','receipt','report','config'])assert.equal(AnamnesDraftSchema.safeParse({...example(),[key]:'must never persist'}).success,false,key);
  assert.equal(AnamnesDraftSchema.safeParse({...example(),answers:{pulse:'weak'}}).success,false);
  assert.equal(AnamnesDraftSchema.safeParse({...example(),answers:{energy:'invented_answer'}}).success,false);
  assert.equal(AnamnesDraftSchema.safeParse({...example(),answers:JSON.parse('{"__proto__":"yes"}')}).success,false);
  assert.equal(AnamnesDraftSchema.safeParse({...example(),position:{...example().position,history:['pulse']}}).success,false);
  assert.equal(AnamnesDraftSchema.safeParse({...example(),position:{...example().position,history:['stool','stool']}}).success,false);
});

test('expired and tampered drafts are purged, including an edited expiration time',async()=>{
  let now=100000;const db=memory(),writer=new EncryptedAnamnesDraftStore(db.storage,crypto,()=>now);
  await writer.save(example());now+=draftLifetimeMs+1;
  assert.equal(await new EncryptedAnamnesDraftStore(db.storage,crypto,()=>now).load(),null);assert.equal(await db.storage.read(),null);
  await writer.clear();await writer.save(example());db.record={...db.record!,expiresAt:now+draftLifetimeMs-1000};
  assert.equal(await new EncryptedAnamnesDraftStore(db.storage,crypto,()=>now).load(),null);assert.equal(await db.storage.read(),null);
  await writer.clear();await writer.save(example());new Uint8Array(db.record!.ciphertext)[0]^=1;
  assert.equal(await new EncryptedAnamnesDraftStore(db.storage,crypto,()=>now).load(),null);assert.equal(await db.storage.read(),null);
});

test('clearing during slow encryption prevents resurrection of sensitive draft data',async()=>{
  let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
  const delayed={getRandomValues:crypto.getRandomValues.bind(crypto),randomUUID:crypto.randomUUID.bind(crypto),subtle:{generateKey:crypto.subtle.generateKey.bind(crypto.subtle),decrypt:crypto.subtle.decrypt.bind(crypto.subtle),encrypt:async(...args:Parameters<SubtleCrypto['encrypt']>)=>{entered();await gate;return crypto.subtle.encrypt(...args);}}} as Crypto;
  const db=memory(),store=new EncryptedAnamnesDraftStore(db.storage,delayed),saving=store.save(example());await started;
  const clearing=store.clear();release();await Promise.all([saving,clearing]);assert.equal(await db.storage.read(),null);
});

test('another tab cannot silently replace a newer draft with an older snapshot',async()=>{
  const db=memory(),first=new EncryptedAnamnesDraftStore(db.storage);await first.save(example());
  const second=new EncryptedAnamnesDraftStore(db.storage);await second.load();
  await first.save({...example(),narrative:'LATEST_FICTIONAL_STORY'});
  await assert.rejects(second.save({...example(),narrative:'STALE_FICTIONAL_STORY'}),/Concurrent/);
  assert.equal((await new EncryptedAnamnesDraftStore(db.storage).load())?.draft.narrative,'LATEST_FICTIONAL_STORY');
});

test('resuming a review or followup keeps its current question and reconsiders pending questions',()=>{
  const review={...example(),position:{...example().position,stage:'questions' as const,history:['focus','duration','energy','pallor'] as const,questionId:'pallor' as const,index:3}};
  const cursor=draftResumeCursor({...review,position:{...review.position,history:[...review.position.history]}});assert.equal(cursor.history[cursor.index].id,'pallor');
  const followup=draftResumeCursor({...example(),position:{...example().position,stage:'followup',followups:['heaviness','tongueColor'],questionId:'tongueColor',index:1}});
  assert.deepEqual(followup.history.map(question=>question.id),['heaviness','tongueColor']);assert.equal(followup.index,1);
});

test('save errors leave an existing encrypted draft intact instead of falling back to plaintext',async()=>{
  const db=memory(),store=new EncryptedAnamnesDraftStore(db.storage);await store.save(example());const original=db.record!.revision;
  db.storage.replace=async()=>{throw new Error('Storage full');};
  await assert.rejects(store.save({...example(),narrative:'Unsaved update'}),/Storage full/);
  assert.equal(db.record!.revision,original);assert.equal(JSON.stringify(db.record).includes('Unsaved update'),false);
  await store.clear();assert.equal(await db.storage.read(),null);
});
