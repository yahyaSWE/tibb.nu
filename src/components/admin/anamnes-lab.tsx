"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { labBook, labCoverage, labPatterns, labSources, labTopicById, labTopics, labVersion } from '@/lib/anamnes/lab/library';
import { LabCaseSchema, labLegacyAnswers, type LabCase, type LabEntry, type LabFinding, type LabResult } from '@/lib/anamnes/lab/engine';
import { labExamples, fictionalAdultSafety } from '@/lib/anamnes/lab/examples';
import { safetyQuestionIds } from '@/lib/anamnes/engine';
import { AnamnesReport } from '@/components/anamnes/report';
import styles from './anamnes-lab.module.css';

type Props={ai:{available:boolean;model:string;providerLabel:string;privacyNotice:string;consentVersion:string}};
const emptySafety=()=>Object.fromEntries(safetyQuestionIds.map(id=>[id,'unknown'])) as LabCase['safety'];
const labels:Record<LabResult['status'],string>={continue:'Fler särskiljande frågor',ready_for_review:'Underlag för terapeutens granskning',needs_examination:'Mer undersökning behövs',outside_scope:'Utanför testbibliotekets täckning',user_stopped:'Du har avslutat med det underlag som finns',safety_stop:'Säkerhetsuppgifter behöver följas upp'};
const purposes={characterize:'Klargör huvudbesväret',differentiate:'Skiljer hypoteser åt',counterevidence:'Prövar motfynd',clarify:'Kompletterar underlaget'};
export function AnamnesLab({ai}:Props) {
  const [narrative,setNarrative]=useState(''),[context,setContext]=useState(''),[safety,setSafety]=useState<LabCase['safety']>(emptySafety);
  const [entries,setEntries]=useState<LabEntry[]>([]),[choices,setChoices]=useState<Record<string,{value:string;note:string}>>({});
  const [fictional,setFictional]=useState(false),[useAi,setUseAi]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<LabResult|null>(null),[filter,setFilter]=useState(''),[review,setReview]=useState(''),[copied,setCopied]=useState(false);
  const run=useRef(0),controller=useRef<AbortController|null>(null),output=useRef<HTMLDivElement>(null);
  useEffect(()=>()=>{controller.current?.abort();run.current++;},[]);
  function changed(){setResult(null);setError('');setCopied(false);}
  function example(id:string){
    const e=labExamples.find(e=>e.id===id);if(!e)return;
    controller.current?.abort();run.current++;setBusy(false);setNarrative(e.narrative);setContext(e.context);setSafety({...fictionalAdultSafety});setEntries([...e.entries]);setChoices({});setReview('');changed();
  }
  async function analyze(next=entries,finalize=false){
    if(busy)return;
    setError('');setCopied(false);
    const parsed=LabCaseSchema.safeParse({narrative,context,safety,entries:next,fictional,finalize,aiConsent:useAi,consentVersion:useAi?ai.consentVersion:null});
    if(!parsed.success){setError('Beskriv ett fiktivt fall och bekräfta att testet endast innehåller påhittade uppgifter. Kontrollera svaren.');return;}
    const current=++run.current;controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);
    try{
      const response=await fetch('/api/admin/anamnes/lab',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(55000)]),body:JSON.stringify(parsed.data)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Testet kunde inte slutföras.');
      if(current!==run.current)return;
      setEntries(next);setResult(data as LabResult);setChoices({});
      requestAnimationFrame(()=>{output.current?.focus({preventScroll:true});output.current?.scrollIntoView({block:'start',behavior:'instant'});});
    }catch(e){if(current===run.current&&!request.signal.aborted)setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'Testet tog för lång tid. Uppgifterna finns kvar; försök igen.');}
    finally{if(current===run.current){setBusy(false);controller.current=null;}}
  }
  function next(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!result)return;
    const pending=result.questions.map(q=>({topicId:q.topicId,value:choices[q.topicId]?.value??'',note:choices[q.topicId]?.note??''}));
    if(pending.some(e=>!e.value)){setError('Besvara frågorna. Vet inte och Vill inte svara är giltiga val.');return;}
    const value=[...entries.filter(e=>!pending.some(p=>p.topicId===e.topicId)),...pending];
    // Keep new answers even when the following request fails.
    setEntries(value);void analyze(value);
  }
  function exportText(){return JSON.stringify({modelVersion:labVersion,book:{...labBook,criteriaVerified:false},case:{narrative,context,safety,entries},result,review,expertApproved:false},null,2);}
  function download(){const url=URL.createObjectURL(new Blob([exportText()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tibb-modelltest.json';a.click();URL.revokeObjectURL(url);}
  async function copy(){try{await navigator.clipboard.writeText(exportText());setCopied(true);}catch{setError('Kopiering kunde inte slutföras. Använd Ladda ned testet.');}}
  function reset(){controller.current?.abort();run.current++;setBusy(false);setNarrative('');setContext('');setSafety(emptySafety());setEntries([]);setChoices({});setResult(null);setReview('');setFictional(false);setUseAi(false);setError('');setCopied(false);}
  const profiles=labPatterns.filter(p=>`${p.name} ${p.family} ${p.id}`.toLocaleLowerCase('sv-SE').includes(filter.toLocaleLowerCase('sv-SE')));
  return <div className={styles.lab}>
    <section className={styles.intro} aria-labelledby="lab-intro"><p className={styles.eyebrow}>Separat testmodell · {labVersion}</p><h2 id="lab-intro">Pröva en hypotesstyrd anamnes</h2>
      <p>Testa följdfrågor, konkurrerande TCM-mönster och referenser ur din aktiva formelkatalog. Besökarnas befintliga anamnes byts inte ut.</p>
      <p><strong>Endast fiktiva fall.</strong> Ingen klinisk validering eller fastställd diagnos. Testuppgifterna hålls i sidans minne och sparas inte som patientärenden.</p>
      <details><summary>Plan och bokunderlag</summary><ol><li>Kartlägg huvudbesvär och sammanhang.</li><li>Pröva flera mönster med stöd, motfynd och saknade kärnfynd.</li><li>Ställ särskiljande följdfrågor; avsluta med osäkerhet när undersökning krävs.</li><li>Jämför därefter den aktiva formelkatalogen.</li><li>Jämför med dagens modell och granska resultatet själv.</li></ol>
        <p>Vald granskningsreferens: <a href={labBook.url} target="_blank" rel="noreferrer">{labBook.title}, tredje upplagan ({labBook.year})</a>.</p><p><strong>{labBook.status}</strong> Artiklar av Maciocia anges separat och är inte samma källa som boken. Inga bokdefinitioner eller påhittade sidnummer har importerats.</p>
      </details>
    </section>
    <section className={styles.panel} aria-labelledby="lab-case-title"><h2 id="lab-case-title">Ditt testfall</h2>
      <label className={styles.field}>Välj ett fiktivt exempel<select aria-label="Välj ett fiktivt exempel" defaultValue="" disabled={busy} onChange={e=>example(e.target.value)}><option value="">Välj exempel eller skriv ett eget</option>{labExamples.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <form onSubmit={e=>{e.preventDefault();void analyze();}}>
        <label className={styles.field}>Beskrivning med egna ord<textarea required rows={5} maxLength={4000} disabled={busy} value={narrative} onChange={e=>{setNarrative(e.target.value);changed();}} placeholder="Skriv ett helt påhittat fall utan namn eller kontaktuppgifter."/></label>
        <label className={styles.field}>Kompletterande bakgrund och det som behöver klargöras<textarea rows={3} maxLength={4000} disabled={busy} value={context} onChange={e=>{setContext(e.target.value);changed();}}/></label>
        <details className={styles.safety}><summary>Trygghetsuppgifter för testfallet</summary><button type="button" className="button button-secondary" disabled={busy} onClick={()=>{setSafety({...fictionalAdultSafety});changed();}}>Använd standarduppgifter för fiktivt vuxenfall</button><div className={styles.grid}>{safetyQuestionIds.map(id=><label key={id} className={styles.field}>{labTopicById.get(id)!.prompt}<select value={safety[id as keyof typeof safety]} disabled={busy} onChange={e=>{setSafety({...safety,[id]:e.target.value});changed();}}>{labTopicById.get(id)!.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}</div></details>
        <label className={styles.check}><input type="checkbox" required checked={fictional} disabled={busy} onChange={e=>setFictional(e.target.checked)}/><span>Jag använder endast helt fiktiva uppgifter utan personuppgifter i detta test.</span></label>
        <label className={styles.check}><input type="checkbox" checked={useAi} disabled={busy||!ai.available} onChange={e=>{setUseAi(e.target.checked);changed();}}/><span>Använd AI för detta test: {ai.available?`${ai.providerLabel} (${ai.model})`:'AI är inte konfigurerad'}. Jag väljer att testbeskrivning, kompletteringar och testsvar skickas till leverantören.</span></label>
        <details><summary>Om AI-testet och datan</summary><p>{ai.privacyNotice}</p><p>Valet gäller detta test. Det lokala jämförelseläget skickar inga uppgifter till en AI-leverantör. AI-testet har samma serverstyrda leverantör och gemensamma kostnadsbudget som anamnesen. Vid ett tekniskt fel behålls svaren; inget färdigt resultat hittas på.</p></details>
        <div className={styles.actions}><button type="submit" className="button button-primary" disabled={busy}>{busy?'Bearbetar testfallet…':result?'Uppdatera bedömningen':entries.length?'Fortsätt med mina testsvar':'Starta modelltest'}</button><button type="button" className="button button-secondary" disabled={busy} onClick={reset}>Rensa testet</button></div>
      </form>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
    </section>
    {result&&<div ref={output} tabIndex={-1} className={styles.output}>
      <section className={styles.panel}><p className={styles.eyebrow}>{result.source==='ai'?'AI-assisterad testmodell':'Lokalt testläge – inget nytt AI-anrop'}</p><h2>{labels[result.status]}</h2>
        <p>{result.contextUsed.answers} testsvar. Berättelse: {result.contextUsed.narrative?'medtagen':'saknas'}. Komplettering: {result.contextUsed.complement?'medtagen':'saknas'}. {result.contextUsed.notes} svar med egna förtydliganden.</p>
        {result.status==='safety_stop'&&<div className={styles.error}>{result.safety.flags.map(f=><p key={f}>{f}</p>)}</div>}
        {result.medicalNotes.length>0&&<div className={styles.notice}><strong>Följ upp utanför TCM-modellen</strong>{result.medicalNotes.map(n=><p key={n}>{n}</p>)}</div>}
        {result.status!=='continue'&&result.status!=='safety_stop'&&<p>Detta är ett preliminärt granskningsunderlag. Mer chatt kan inte ersätta behandlarens undersökning. Inget mönster eller örtval är fastställt.</p>}
      </section>
      {result.questions.length>0&&<section className={styles.panel} aria-labelledby="lab-questions"><h2 id="lab-questions">Nästa frågor</h2><p>Frågorna ska särskilja hypoteser. Vet inte och Vill inte svara räknas inte som nej.</p><form onSubmit={next}>{result.questions.map(q=><fieldset key={q.topicId} className={styles.question}><legend>{q.prompt}</legend><p className={styles.eyebrow}>{purposes[q.purpose]}</p>
          {q.targetPatternIds.length>0&&<p className={styles.hint}>Prövar: {q.targetPatternIds.map(id=>labPatterns.find(p=>p.id===id)?.name).filter(Boolean).join(', ')}.</p>}
          <label className={styles.field}>Ditt testsvar<select required disabled={busy} value={choices[q.topicId]?.value??''} onChange={e=>setChoices({...choices,[q.topicId]:{value:e.target.value,note:choices[q.topicId]?.note??''}})}><option value="">Välj svar</option>{q.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className={styles.field}>Förtydliga med egna ord · valfritt<textarea disabled={busy} rows={2} maxLength={500} value={choices[q.topicId]?.note??''} onChange={e=>setChoices({...choices,[q.topicId]:{value:choices[q.topicId]?.value??'',note:e.target.value}})}/></label>
        </fieldset>)}<div className={styles.actions}><button type="submit" className="button button-primary" disabled={busy}>{busy?'Bearbetar…':'Besvara och fortsätt'}</button><button type="button" className="button button-secondary" disabled={busy} onClick={()=>void analyze(entries,true)}>Avsluta och granska nu</button></div></form></section>}
      <section className={styles.panel}><h2>Mönster att pröva</h2><p>Hypoteser och regelkontroller visas öppet. Poäng är inte sannolikheter eller medicinska diagnoser.</p>{!result.findings.length&&<p>Inget relevant mönster har underbyggts i biblioteket. Fortsätt relevanta frågor eller markera att extern bedömning behövs.</p>}
        <div className={styles.findings}>{result.findings.map(f=><Finding key={f.patternId} finding={f}/>)}</div>
        <details><summary>Vad behöver terapeuten undersöka?</summary><ul>{result.unavailableMethods.map(m=><li key={m}>{m}</li>)}</ul><p>Njure, Lever och Blod används här som TCM-begrepp och fastställer inte medicinsk njursjukdom, leversjukdom eller anemi.</p></details>
      </section>
      <section className={styles.panel}><h2>Örtformler att diskutera efter mönsteranalysen</h2><p>Endast aktiva poster från din katalog. Högst tre referenser. Ingen ordination, individuell dosering eller direktköpsrekommendation.</p>
        {result.formulas.status==='safety_blocked'?<p>Formeljämförelsen är spärrad av testets säkerhetsuppgifter.</p>:!result.formulas.matches.length?<p>Ingen aktiv formel kan kopplas till de underbyggda mönstren. Modellen väljer inte en Yin-formel enbart för att Jing-brist övervägs.</p>:result.formulas.matches.map(f=><article className={styles.reference} key={f.id}><h3>{f.name}</h3><p>{f.classicalName} · {f.referenceKind==='special_order'?'Specialbeställningsreferens':'Ordinarie sortiment'}</p><strong>{f.partial?'Delvis överensstämmelse – inte hela symtombilden':'Teoretisk överensstämmelse för terapeutens granskning'}</strong>
          <p>Stöd: {f.supporting.map(id=>labTopicById.get(id)?.prompt).join(' · ')||'Otillräckliga specifika katalogfynd'}.</p><p>Motfynd: {f.opposing.map(id=>labTopicById.get(id)?.prompt).join(' · ')||'Inga av katalogens motfynd bekräftade; det innebär inte att produkten är säker'}.</p>{f.missing.length>0&&<p>Behöver klargöras: {f.missing.map(id=>labTopicById.get(id)?.prompt).join(' · ')}.</p>}
          <p>{f.productVerified?'Katalogens produktverifieringar är dokumenterade. Individuell lämplighet återstår.':'Produktens faktiska innehåll och säkerhet är inte fullständigt verifierade. Visas som referens, inte som tillgänglig produkt.'}</p><details><summary>Begränsningar och säkerhetsuppgifter</summary><ul>{f.notes.filter(Boolean).map((n,i)=><li key={i}>{n}</li>)}</ul></details></article>)}
        {result.formulas.excluded.length>0&&<details><summary>Referenser som talar emot matchning ({result.formulas.excluded.length})</summary>{result.formulas.excluded.map(f=><p key={f.id}><strong>{f.name}:</strong> {f.reasons.join(' · ')}</p>)}</details>}
      </section>
      <details className={styles.panel}><summary>Jämför med dagens regelmodell – samma bekräftade svar</summary><p>Nya testämnen som saknas i dagens modell kan inte överföras. Fritext fyller inte automatiskt i gamla svar.</p><AnamnesReport report={result.baseline} answers={labLegacyAnswers({narrative,context,safety,entries,fictional:true,finalize:false,aiConsent:false,consentVersion:null})} showAnswers={false}/></details>
      <section className={styles.panel}><h2>Din granskning</h2><label className={styles.field}>Vad blev rätt, vad saknas och vilka frågor borde ha ställts?<textarea rows={5} value={review} maxLength={8000} onChange={e=>setReview(e.target.value)} placeholder="Ange gärna mönster, relevanta motfynd, formelbedömning och kapitel/sida i Maciocia tredje upplagan som du har kontrollerat."/></label><p>Anteckningen sparas inte på servern. Exporten innehåller testfall, resultat, källstatus och din granskning; den markeras inte som expertgodkänd automatiskt.</p><div className={styles.actions}><button className="button button-secondary" type="button" onClick={download}>Ladda ned testet</button><button className="button button-secondary" type="button" onClick={()=>void copy()}>{copied?'Kopierat':'Kopiera test och granskning'}</button></div></section>
    </div>}
    {entries.length>0&&<details className={styles.panel}><summary>Granska eller ändra testsvaren ({entries.length})</summary>{entries.map((entry,index)=><label key={entry.topicId} className={styles.field}>{labTopicById.get(entry.topicId)!.prompt}<select value={entry.value} disabled={busy} onChange={e=>{setEntries(entries.map((v,i)=>i===index?{...v,value:e.target.value}:v));changed();}}>{labTopicById.get(entry.topicId)!.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select><textarea aria-label={`Komplettering: ${labTopicById.get(entry.topicId)!.prompt}`} rows={2} maxLength={500} disabled={busy} value={entry.note} onChange={e=>{setEntries(entries.map((v,i)=>i===index?{...v,note:e.target.value}:v));changed();}}/></label>)}</details>}
    <details className={styles.panel}><summary>Mönsterbibliotek och faktisk täckning ({labPatterns.length} profiler, {labTopics.length} frågeämnen)</summary><p>Profilerna är tekniska granskningsutkast. Ingen profil är ännu verifierad mot hela den valda boken och biblioteket omfattar inte alla kända TCM-mönster.</p><div className={styles.tableWrap}><table><thead><tr><th>Område</th><th>Täckning</th></tr></thead><tbody>{labCoverage.map(([name,coverage])=><tr key={name}><td>{name}</td><td>{coverage}</td></tr>)}</tbody></table></div><label className={styles.field}>Sök mönster<input type="search" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
      {profiles.map(p=><details key={p.id} className={styles.profile}><summary>{p.name} · {p.family}</summary><p>Bokverifiering: återstår. Profil: {p.id}.</p><p>Stödämnen: {[...new Set(p.support.map(r=>r.topic))].map(id=>labTopicById.get(id)?.prompt).join(' · ')}.</p><p>Motfynd prövas med: {[...new Set(p.oppose.map(r=>r.topic))].map(id=>labTopicById.get(id)?.prompt).join(' · ')||'Inga särskilda motregler har dokumenterats ännu'}.</p><p>Källspår: {p.sources.map(id=>labSources.find(s=>s.id===id)?.title??'Befintlig teknisk profil – separat källgranskning återstår').join(' · ')}.</p></details>)}
      <h3>Källor och begränsningar</h3><ul>{labSources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>. {s.role}</li>)}</ul>
    </details>
  </div>;
}
function Finding({finding:f}:{finding:LabFinding}){
  return <article className={styles.finding}><p className={styles.eyebrow}>{f.supported?'Underbyggt enligt testprofilen – behöver bekräftas':'Öppen hypotes – inte underbyggd ännu'}</p><h3>{f.name}</h3>
    <p><strong>Stöd:</strong> {f.supporting.map(r=>labTopicById.get(r.topic)?.prompt).join(' · ')||'Inga bekräftade stödjande svar ännu'}.</p>
    <p><strong>Motfynd:</strong> {f.opposing.map(r=>labTopicById.get(r.topic)?.prompt).join(' · ')||'Inga bekräftade motfynd; saknade svar räknas inte som nej'}.</p>
    {f.missingCore.length>0&&<p><strong>Saknade kärnfynd:</strong> {f.missingCore.map(id=>labTopicById.get(id)?.prompt).join(' · ')}.</p>}
    <p className={styles.hint}>Testprofil, inte verifierad mot Maciocia tredje upplagan. {f.examination.join(' · ')}.</p>
  </article>;
}
