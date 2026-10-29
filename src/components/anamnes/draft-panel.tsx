"use client";
import { useState } from 'react';
import type { AnamnesDraft } from '@/lib/anamnes/draft';
import type { AnamnesDraftControls } from './use-anamnes-draft';
import styles from './tcm-anamnes.module.css';

export function AnamnesDraftPanel({controls,aiAvailable,busy,onResume}:{controls:AnamnesDraftControls;aiAvailable:boolean;busy:boolean;onResume:(draft:AnamnesDraft,useAi:boolean)=>void}) {
  const [accepted,setAccepted]=useState(false);
  if(!controls.ready&&!controls.message)return null;
  const needsAiChoice=!!controls.available&&controls.available.draft.flow==='ai'&&!['intro','report'].includes(controls.available.draft.position.stage)&&aiAvailable;
  if(controls.available)return <aside className={styles.notice} aria-label="Sparat utkast">
    <strong>Ett sparat utkast finns på den här enheten</strong><p>Du kan fortsätta där du slutade. Dina sparade svar visas först när du fortsätter och ersätter eventuella nya svar som du har fyllt i här.</p>
    {needsAiChoice&&<><label className={styles.option}><input type="checkbox" checked={accepted} disabled={busy} onChange={event=>setAccepted(event.target.checked)}/><span>Jag vill fortsätta med AI-analys av mina svar.</span></label><p className={styles.smallNote}>Läs ”Mer om AI och dina svar” nedan innan du fortsätter.</p></>}
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy||(needsAiChoice&&!accepted)} onClick={()=>{const draft=controls.resume();if(draft)onResume(draft,needsAiChoice&&accepted);}}>Fortsätt där du slutade</button><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void controls.clear()}>Radera utkastet</button></div>
  </aside>;
  return <aside className={styles.draftPanel} aria-label="Sparade framsteg">
    {controls.ready&&controls.enabled&&<p className={styles.smallNote}>Dina framsteg sparas automatiskt i den här webbläsaren i 24 timmar. Inget skickas till behandlaren förrän du väljer att skicka in.</p>}
    {controls.ready&&<details className={styles.reportDetails}><summary>Om sparandet på den här enheten</summary><p>Berättelsen och svaren innehåller hälsouppgifter och sparas krypterat i den här webbläsaren. Andra som använder samma webbläsarprofil kan återuppta utkastet. Utkastet kan återupptas i 24 timmar efter senaste sparningen; utgångna utkast rensas när du återkommer. De separata kontaktfälten och dina samtycken sparas inte. Radera utkastet här eller välj ”Rensa svar och börja om”. Sparandet börjar igen när du ändrar svaren. Inget utkast skickas till servern eller kopplas till ditt elevkonto.</p></details>}
    {(controls.saving||controls.expiresAt||controls.message)&&<p className={styles.smallNote} role="status">{controls.message|| (controls.saving?'Sparar utkast…':`Utkast sparat. Kan återupptas till ${new Date(controls.expiresAt!).toLocaleString('sv-SE')}.`)}</p>}
    {(controls.expiresAt||controls.message)&&controls.ready&&<button type="button" disabled={busy} className={styles.secondary} onClick={()=>void controls.clear()}>Radera sparat utkast</button>}
  </aside>;
}
