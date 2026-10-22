"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { IntakeContactFields } from '@/components/intake/contact-fields';
import { QUESTIONS } from '@/lib/five-phases/questions';
import type { Answer } from '@/lib/five-phases/types';
import styles from '@/components/intake/submission.module.css';

const ConfigSchema=z.object({available:z.boolean(),notice:z.string(),retentionDays:z.number().int().min(1).max(90),consentVersion:z.string()});
const ReceiptSchema=z.object({reference:z.string().uuid(),expiresAt:z.string().datetime()});
const labels=['','Stämmer inte alls','Stämmer ganska dåligt','Stämmer delvis','Stämmer ganska väl','Stämmer mycket väl'];
export function SelfTestSubmissionForm({answers}:{answers:readonly Answer[]}) {
  const [config,setConfig]=useState<z.infer<typeof ConfigSchema>|null>(null);
  const [contact,setContact]=useState({name:'',email:'',phone:''});
  const [consent,setConsent]=useState<string|null>(null);
  const [receipt,setReceipt]=useState<z.infer<typeof ReceiptSchema>|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  const errorRef=useRef<HTMLParagraphElement>(null);
  async function loadConfig() {
    const controller=new AbortController();request.current=controller;
    setBusy(true);setError('');setConsent(null);
    try {
      const response=await fetch('/api/sjalvtest/submission-config',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      if (!response.ok) throw new Error();
      const value=ConfigSchema.parse(await response.json());
      if (!controller.signal.aborted) setConfig(value);
    } catch { if (!controller.signal.aborted) setError('Informationen om inskickning kunde inte hämtas. Försök igen.'); }
    finally { if (!controller.signal.aborted) {setBusy(false);request.current=null;} }
  }
  useEffect(()=>{void loadConfig();return()=>request.current?.abort();},[]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || receipt || !config?.available || consent!==config.consentVersion) return;
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    try {
      const response=await fetch('/api/sjalvtest/submit',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),
        body:JSON.stringify({answers,contact,sendConsent:true,submissionConsentVersion:consent})});
      if(response.status===409){await loadConfig();setError('Informationen har uppdaterats. Läs den och bekräfta ditt val igen.');return;}
      if(!response.ok)throw new Error();
      const value=ReceiptSchema.parse(await response.json());
      if(!controller.signal.aborted){setReceipt(value);setConsent(null);}
    } catch {if(!controller.signal.aborted)setError('Inskickningen kunde inte bekräftas. Kontrollera uppgifterna och försök igen.');}
    finally {if(!controller.signal.aborted){setBusy(false);request.current=null;}}
  }
  return <details className={styles.panel}><summary>Skicka mina svar och mitt resultat till Tibb.nu</summary>
    <p>Vill du att vi ska kunna läsa självtestet inför kontakt eller konsultation? Fyll i dina kontaktuppgifter och välj att skicka. Du behöver inget elevkonto.</p>
    {error&&<p className={styles.error} role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    {!config ? <><p role="status">{busy?'Hämtar information…':'Inskickning kunde inte förberedas.'}</p><button type="button" className="button button-secondary" disabled={busy} onClick={()=>void loadConfig()}>Försök igen</button></> : receipt ? <div className={styles.success} role="status"><strong>Underlaget har tagits emot.</strong><p>Referens: <code>{receipt.reference}</code></p><p>Behörig administratör/behandlare kan läsa dina svar och resultat till {new Intl.DateTimeFormat('sv-SE',{dateStyle:'long',timeZone:'Europe/Stockholm'}).format(new Date(receipt.expiresAt))}.</p></div> : !config.available ? <p className={styles.notice}>Digital inskickning är inte aktiverad just nu. Du kan fortfarande läsa ditt resultat här.</p> : <>
      <details><summary>Vad skickas och hur sparas det?</summary><p>{config.notice}</p><p>Samtliga 40 svar och poängen för de fem faserna följer med. Resultatet är ett reflektionsunderlag, ingen diagnos.</p><ol>{QUESTIONS.map(question=><li key={question.id}>{question.text} <strong>{labels[answers.find(answer=>answer.questionId===question.id)?.value??0]}</strong></li>)}</ol></details>
      <form onSubmit={send}>
        <IntakeContactFields prefix="selftest-contact" value={contact} onChange={setContact} disabled={busy}/>
        <p className={styles.notice}>Underlaget lagras krypterat i högst {config.retentionDays} dagar och visas endast för behörig administratör/behandlare.</p>
        <label className={styles.consent}><input type="checkbox" required checked={consent===config.consentVersion} disabled={busy} onChange={event=>setConsent(event.target.checked?config.consentVersion:null)}/><span>Jag har läst informationen och väljer att skicka mina svar, mitt resultat och mina kontaktuppgifter till Tibb.nu inför kontakt eller konsultation.</span></label>
        <button type="submit" className="button button-primary" disabled={busy||consent!==config.consentVersion}>{busy?'Skickar…':'Skicka till Tibb.nu'}</button>
      </form>
    </>}
  </details>;
}
