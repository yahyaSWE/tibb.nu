import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { therapistAccess } from '@/lib/anamnes/cases';
import { listQualityReviews } from '@/lib/anamnes/quality-reviews';
import { qualityCases } from '@/lib/anamnes/quality-cases';
import { compareQualityCases } from '@/lib/anamnes/quality';
import { AdminHeading } from '@/components/admin/common';
import { AnamnesAdminNav } from '@/components/admin/anamnes-nav';

export default async function AnamnesQualityPage(){
  const actor=await requireAdmin();if(!therapistAccess(actor))notFound();
  const comparison=compareQualityCases(qualityCases,await listQualityReviews(actor));
  return <><AdminHeading title="Kvalitetsfall för anamnesen" description="Fiktiva tekniska fall som du granskar själv. Inga patientuppgifter eller externa AI-anrop används."/><AnamnesAdminNav current="quality" therapist/>
    <p className="notice">Den här jämförelsen avser den tidigare regelmotorn. Den nya ordinarie frågemotorn granskas separat i <Link href="/admin/anamnes/modelltest">Modelltest</Link>. Siffrorna här anger inte den nya AI-modellens träffsäkerhet.</p>
    <section className="panel"><h2>{comparison.reviewed} av {comparison.total} fall granskade</h2><p>Endast dina godkända, versionsbundna bedömningar räknas som facit. De konstruerade fallen är inte ett mått på klinisk precision och bygger delvis på befintliga regler.</p><p>Bedöm gärna svaren själv innan du öppnar motorns resultat. Mönsterkriterierna och deras konstruerade mål är inte oberoende expertbevis.</p>
    <div className="table-wrap"><table className="admin-table"><thead><tr><th>Mått i lokal simulering</th><th>Tidigare motor</th><th>Adaptivt frågeval</th></tr></thead><tbody>
      <tr><td>Median symtomfrågor</td><td>{comparison.baseline.medianSymptomQuestions}</td><td>{comparison.adaptive.medianSymptomQuestions}</td></tr>
      <tr><td>Spann symtomfrågor</td><td>{comparison.baseline.minSymptomQuestions}–{comparison.baseline.maxSymptomQuestions}</td><td>{comparison.adaptive.minSymptomQuestions}–{comparison.adaptive.maxSymptomQuestions}</td></tr>
      <tr><td>Upprepade frågor</td><td>{comparison.baseline.repeatedQuestions}</td><td>{comparison.adaptive.repeatedQuestions}</td></tr>
      <tr><td>Avstår från mönsterslutsats</td><td>{comparison.baseline.abstentions}/{comparison.total}</td><td>{comparison.adaptive.abstentions}/{comparison.total}</td></tr>
      <tr><td>Exakt status- och mönsteröverensstämmelse med ditt facit</td><td>{comparison.baseline.exactAgreement===null?'Inväntar granskning':`${Math.round(comparison.baseline.exactAgreement*100)} %`}</td><td>{comparison.adaptive.exactAgreement===null?'Inväntar granskning':`${Math.round(comparison.adaptive.exactAgreement*100)} %`}</td></tr>
    </tbody></table></div><p>Åtta trygghetsfrågor och fyra bakgrundsfrågor räknas separat. Obeskrivna svar blir ”Vet inte”. Simuleringen använder kodens referenskatalog, inte produktionsdatabasen eller en faktisk modell. Alternativa val bland tillåtna frågor gav samma utfall i {comparison.orderStableCases}/{comparison.total} fall.</p></section>
    <section className="panel"><div className="table-wrap"><table className="admin-table"><thead><tr><th>Fall</th><th>Typ</th><th>Granskat</th><th>Symtomfrågor tidigare / nu</th></tr></thead><tbody>{comparison.rows.map((row,index)=><tr key={row.id}><td><Link href={`/admin/anamnes/kvalitet/${row.id}`}>{row.id}</Link></td><td>{qualityCases[index].category}</td><td>{row.reviewed?'Ja':'Inväntar din granskning'}</td><td>{row.baseline.symptomQuestions} / {row.adaptive.symptomQuestions}</td></tr>)}</tbody></table></div></section>
  </>;
}
