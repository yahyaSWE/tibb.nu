"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function DeleteSelfTestSubmission({id}:{id:string}) {
  const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function remove(){
    if(busy||!window.confirm('Vill du radera det här självtestet och dess kontaktuppgifter?'))return;
    setBusy(true);setError('');
    try{const response=await fetch(`/api/admin/inskickade-underlag/sjalvtest/${id}`,{method:'DELETE'});if(!response.ok)throw new Error();router.push('/admin/inskickade-underlag');router.refresh();}
    catch{setError('Underlaget kunde inte raderas. Försök igen.');setBusy(false);}
  }
  return <>{error&&<p role="alert">{error}</p>}<button type="button" className="button button-danger" disabled={busy} onClick={()=>void remove()}>{busy?'Raderar…':'Radera självtestet'}</button></>;
}
