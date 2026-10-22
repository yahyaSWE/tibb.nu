import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { therapistAccess } from '@/lib/anamnes/cases';
import { getAnamnesConfigStatus } from '@/lib/anamnes/config';
import { getSelfTestCase } from '@/lib/five-phases/submissions';
import { ELEMENT_PROFILES } from '@/lib/five-phases/profiles';
import { AdminHeading, dateTime } from '@/components/admin/common';
import { DeleteSelfTestSubmission } from '@/components/admin/self-test-submission-delete';

export default async function SelfTestSubmissionPage({params}:{params:Promise<{id:string}>}) {
  const actor=await requireAdmin();
  if(!therapistAccess(actor))notFound();
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))notFound();
  if(!getAnamnesConfigStatus().submissions.storageReady)return <p className="notice">Säker lagring är inte konfigurerad. Kontrollera ANAMNES_STORAGE_KEY.</p>;
  let item;
  try {item=await getSelfTestCase(actor,id);}catch{return <p className="notice notice-error">Underlaget kunde inte öppnas. Kontrollera lagringsnyckeln och databasanslutningen.</p>;}
  if(!item)notFound();
  const labels=['','Stämmer inte alls','Stämmer ganska dåligt','Stämmer delvis','Stämmer ganska väl','Stämmer mycket väl'];
  return <>
    <AdminHeading title="Självtest · fem faser" description={`Inskickat ${dateTime(item.createdAt)}. Tillgängligt till ${dateTime(item.expiresAt)}.`} action={<Link className="button button-secondary" href="/admin/inskickade-underlag">Alla inskickade underlag</Link>}/>
    <section className="panel"><h2>Kontaktuppgifter</h2><dl><dt>Namn</dt><dd>{item.contact.name}</dd><dt>E-post</dt><dd>{item.contact.email}</dd>{item.contact.phone&&<><dt>Telefon</dt><dd>{item.contact.phone}</dd></>}</dl></section>
    <section className="panel" style={{marginTop:24}}><h2>Resultat</h2><p>{item.result.tiedElements.length>1?'Delad högsta poäng':'Högsta poäng'}: <strong>{item.result.tiedElements.map(element=>ELEMENT_PROFILES[element].label).join(', ')}</strong>.</p><p className="muted">Självtestet är underlag för reflektion och samtal, ingen medicinsk diagnos.</p><div className="table-wrap"><table className="admin-table"><thead><tr><th>Fas</th><th>Poäng (0–100)</th><th>Summa (8–40)</th></tr></thead><tbody>{item.result.scores.map(score=><tr key={score.element}><td>{ELEMENT_PROFILES[score.element].label}</td><td>{score.percentage}</td><td>{score.rawScore}</td></tr>)}</tbody></table></div></section>
    <section className="panel" style={{marginTop:24}}><h2>Alla 40 svar</h2><ol>{item.questions.map(question=>{const answer=item.answers.find(value=>value.questionId===question.id)!;return <li key={question.id} style={{marginBottom:16}}>{question.text}<br/><strong>{labels[answer.value]} · {answer.value}/5</strong></li>;})}</ol></section>
    <details className="panel" style={{marginTop:24}}><summary>Information vid inskickningen</summary><p>Aktivt inskickningsval registrerat {dateTime(item.consent.recordedAt)}. Lagringstid: {item.consent.retentionDays} dagar.</p><p>{item.consent.notice}</p><p className="muted">Resultatet beräknades på servern från de inskickade svaren. Frågetexterna sparades med underlaget.</p></details>
    <section className="panel" style={{marginTop:24}}><h2>Ta bort underlaget</h2><p>Uppgifterna raderas även efter att lagringstiden löpt ut.</p><DeleteSelfTestSubmission id={item.id}/></section>
  </>;
}
