import type { DraftStorage, EncryptedDraft } from './draft';

/** One encrypted draft per origin/browser. No localStorage plaintext or server. */
export function browserDraftStorage():DraftStorage {
  if(typeof indexedDB==='undefined'||!globalThis.crypto?.subtle)throw new Error('Draft storage unavailable');
  let connection:Promise<IDBDatabase>|null=null;
  const database=()=>connection??=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('tibb-anamnes-draft',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('drafts');};
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(new Error('Draft storage unavailable'));
    request.onblocked=()=>reject(new Error('Draft storage blocked'));
  });
  const access=async<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,done:(value:T)=>void,fail:()=>void)=>void):Promise<T>=>{
    const db=await database();return new Promise<T>((resolve,reject)=>{
      const transaction=db.transaction('drafts',mode);let value:T;
      transaction.oncomplete=()=>resolve(value);transaction.onerror=transaction.onabort=()=>reject(new Error('Draft storage unavailable or changed in another tab'));
      work(transaction.objectStore('drafts'),result=>{value=result;},()=>transaction.abort());
    });
  };
  return {
    read:()=>access<EncryptedDraft|null>('readonly',(store,done)=>{const request=store.get('current');request.onsuccess=()=>done(request.result??null);}),
    replace:(value,expectedRevision)=>access<void>('readwrite',(store,done,fail)=>{
      const request=store.get('current');request.onsuccess=()=>{
        if((request.result?.revision??null)!==expectedRevision){fail();return;}
        try{store.put(value,'current');done();}catch{fail();}
      };
    }),
    remove:expected=>access<void>('readwrite',(store,done)=>{
      const request=store.get('current');request.onsuccess=()=>{if(expected===undefined||(request.result?.revision??null)===expected)store.delete('current');done();};
    }),
  };
}
