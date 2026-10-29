"use client";
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import styles from './tcm-anamnes.module.css';

export function AnamnesStartControls({aiAvailable,loading,providerLabel,privacyNotice,onStart,children}:{aiAvailable:boolean;loading:boolean;providerLabel:string;privacyNotice:string;onStart:(ai:boolean)=>void;children?:ReactNode}) {
  if(!aiAvailable)return <><div>{!loading&&<p className={styles.smallNote}>AI är inte tillgänglig just nu. Du kan fortsätta med det enkla frågeflödet.</p>}<button type="button" className={styles.primary} disabled={loading} onClick={()=>onStart(false)}>{loading?'Förbereder formuläret…':'Starta simpel frågeställning'}<ArrowRight size={17} aria-hidden="true"/></button></div>{children}</>;
  return <>
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={loading} onClick={()=>onStart(true)}>Börja frågorna<ArrowRight size={17} aria-hidden="true"/></button></div>
    {children}
    <details className={styles.reportDetails}><summary>Mer om AI och dina svar</summary><p>Genom att välja ”Börja frågorna” samtycker du till att din beskrivning, dina kompletteringar om besvären och dina formulärsvar skickas via Tibb.nu till {providerLabel} för anpassade frågor och en preliminär analys. Det du skriver i de separata fälten för läkemedelsnamn, läkemedelsdetaljer, sjukdomar och allergier skickas inte till AI. Du kan avstå från att starta analysen.</p><p>{privacyNotice}</p><p>Att skicka rapporten till en behandlare är ett separat val. Ett krypterat utkast sparas automatiskt i den här webbläsaren i 24 timmar efter senaste sparningen. AI-samtycket sparas inte i utkastet.</p><Link href="/integritet" className={styles.productInfo} prefetch={false}>Integritetsinformation</Link></details>
  </>;
}
