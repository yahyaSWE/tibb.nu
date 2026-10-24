"use client";
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './tcm-anamnes.module.css';

export function AnamnesStartControls({aiAvailable,loading,providerLabel,privacyNotice,accepted,onAccepted,onStart}:{aiAvailable:boolean;loading:boolean;providerLabel:string;privacyNotice:string;accepted:boolean;onAccepted:(accepted:boolean)=>void;onStart:(ai:boolean)=>void}) {
  if(!aiAvailable)return <div>{!loading&&<p className={styles.smallNote}>AI är inte tillgänglig just nu. Du kan fortsätta med det enkla frågeflödet.</p>}<button type="button" className={styles.primary} disabled={loading} onClick={()=>onStart(false)}>{loading?'Förbereder formuläret…':'Starta simpel frågeställning'}<ArrowRight size={17} aria-hidden="true"/></button></div>;
  return <>
    <label className={styles.option}><input type="checkbox" checked={accepted} onChange={event=>onAccepted(event.target.checked)}/><span>Jag samtycker till AI-analys av min beskrivning och mina svar.</span></label>
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={!accepted} onClick={()=>onStart(true)}>Börja frågorna<ArrowRight size={17} aria-hidden="true"/></button></div>
    <details className={styles.reportDetails}><summary>Mer om AI och dina svar</summary><p>När du väljer AI-analys skickas din beskrivning, dina kompletteringar om besvären och dina formulärsvar via Tibb.nu till {providerLabel} för anpassade frågor och en preliminär analys. Det du skriver i de separata fälten för läkemedelsnamn, läkemedelsdetaljer, sjukdomar och allergier skickas inte till AI. Du kan avstå från att starta analysen.</p><p>{privacyNotice}</p><p>Att skicka rapporten till en behandlare är ett separat val. Ett lokalt utkast sparas bara om du väljer att spara det på din enhet. AI-samtycket sparas inte i utkastet.</p><Link href="/integritet" className={styles.productInfo} prefetch={false}>Integritetsinformation</Link></details>
  </>;
}
