import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getAnamnesConfigStatus } from '@/lib/anamnes/config';
import { listAnamnesContacts, therapistAccess } from '@/lib/anamnes/cases';
import { listSelfTestContacts } from '@/lib/five-phases/submissions';
import { AdminHeading, dateTime, EmptyState } from '@/components/admin/common';

export default async function SubmittedIntakesPage() {
  const actor=await requireAdmin();
  const config=getAnamnesConfigStatus().submissions;
  const heading=<AdminHeading title="Inskickade underlag" description="Självtester och anamneser som besökare valt att skicka. Öppna ett underlag för kontaktuppgifter, fullständiga svar och resultat."/>;
  if(!therapistAccess(actor))return <>{heading}<section className="panel"><p>Ditt administratörskonto behöver också vara behörigt att läsa underlagen. Lägg till kontots e-postadress i ANAMNES_THERAPIST_EMAILS i serverns inställningar.</p><Link href="/admin/anamnes">Visa driftsättningsöversikten</Link></section></>;
  if(!config.storageReady)return <>{heading}<section className="panel"><p>Säker lagring är inte färdigkonfigurerad. Kontrollera ANAMNES_STORAGE_KEY i serverns inställningar.</p><Link href="/admin/anamnes">Visa vad som saknas för inskickning</Link></section></>;
  let items;
  try {
    const [anamnes,selfTests]=await Promise.all([listAnamnesContacts(actor),listSelfTestContacts(actor)]);
    items=[...anamnes.map(item=>({...item,kind:'anamnes' as const})),...selfTests.map(item=>({...item,kind:'selftest' as const}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  } catch {return <>{heading}<p className="notice notice-error" role="alert">Underlagen kunde inte läsas. Kontrollera lagringsnyckeln och databasanslutningen. Inga känsliga uppgifter visas.</p></>;}
  return <>{heading}
    {!config.available&&<p className="notice">Nya inskick är avstängda. Befintliga underlag kan läsas tills lagringstiden löper ut. <Link href="/admin/anamnes">Visa konfiguration som saknas</Link>.</p>}
    <section className="panel">{items.length?<div className="table-wrap"><table className="admin-table"><thead><tr><th>Namn</th><th>E-post</th><th>Underlag</th><th>Inskickat</th><th>Tillgängligt till</th><th>Öppna</th></tr></thead><tbody>{items.map(item=><tr key={`${item.kind}-${item.id}`}><td>{item.name}</td><td>{item.email}</td><td>{item.kind==='anamnes'?'Anamnes':'Självtest · fem faser'}</td><td>{dateTime(item.createdAt)}</td><td>{dateTime(item.expiresAt)}</td><td><Link className="text-link" href={item.kind==='anamnes'?`/admin/anamnes/arenden/${item.id}`:`/admin/inskickade-underlag/sjalvtest/${item.id}`} aria-label={`Öppna ${item.kind==='anamnes'?'anamnes':'självtest'} för ${item.name}`}>Öppna</Link></td></tr>)}</tbody></table></div>:<EmptyState title="Inga aktuella underlag">Här visas självtester och anamneser först när besökaren aktivt väljer att skicka dem med sina kontaktuppgifter.</EmptyState>}</section>
  </>;
}
