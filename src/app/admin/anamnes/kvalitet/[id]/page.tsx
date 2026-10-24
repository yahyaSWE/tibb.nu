import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { therapistAccess } from '@/lib/anamnes/cases';
import { listQualityReviews } from '@/lib/anamnes/quality-reviews';
import { qualityCases } from '@/lib/anamnes/quality-cases';
import { replayQualityCase } from '@/lib/anamnes/quality';
import { questionById, answerLabel } from '@/lib/anamnes/questions';
import { patternById, patternCatalog } from '@/lib/anamnes/patterns';
import { AdminHeading } from '@/components/admin/common';
import { AnamnesAdminNav } from '@/components/admin/anamnes-nav';
import { AnamnesQualityReview } from '@/components/admin/anamnes-quality-review';
export default async function QualityCasePage({params}:{params:Promise<{id:string}>}){
  const actor=await requireAdmin();if(!therapistAccess(actor))notFound();
  const {id}=await params,item=qualityCases.find(item=>item.id===id);if(!item)notFound();
  const reviews=await listQualityReviews(actor),review=reviews.find(review=>review.caseId===id);
  const baseline=replayQualityCase(item,'baseline'),adaptive=replayQualityCase(item,'adaptive');
  return <><AdminHeading title={`Granska ${id}`} description="Helt fiktivt fall. Gör din bedömning utifrån hela det angivna underlaget." action={<Link href="/admin/anamnes/kvalitet" className="button button-secondary">Alla kvalitetsfall</Link>}/><AnamnesAdminNav current="quality" therapist/>
    <section className="panel"><h2>Berättelse</h2><p>{item.narrative}</p><h2>Samtliga skriptade svar</h2><p>Uppgifter som saknas i listan är okända; de får inte tolkas som nekade symtom. Fallet saknar klinisk undersökning.</p><dl className="anamnes-admin-answer-list">{Object.entries(item.answers).map(([id,value])=><div key={id}><dt>{questionById.get(id as never)?.prompt}</dt><dd>{answerLabel(id as never,value)}</dd></div>)}</dl></section>
    <section className="panel"><h2>Din självständiga granskning</h2>{review&&<p>Senast godkänt av {review.reviewerName} · {review.reviewedAt}. Revision {review.revision}.</p>}<AnamnesQualityReview key={review?.revision??0} caseId={id} review={review} patterns={patternCatalog.map(({id,name})=>({id,name}))}/></section>
    <details className="panel"><summary>Visa teknisk konstruktion och motorernas resultat efter egen bedömning</summary><p>{item.constructionNote}</p><p>Konstruktionsmål (inget facit): {item.engineeringTarget?patternById.get(item.engineeringTarget)?.name:'Inget bestämt'}</p>{([['Tidigare motor',baseline],['Adaptivt frågeval',adaptive]] as const).map(([label,result])=><section key={label}><h3>{label}</h3><p>{result.symptomQuestions} symtomfrågor · {result.state}</p><p>Huvudhypotes: {result.primary?patternById.get(result.primary)?.name:'Ingen entydig'}</p><p>Underbyggda enligt reglerna: {result.patternIds.map(id=>patternById.get(id)?.name).join(', ')||'Inga'}</p><h4>Frågeordning</h4><ol>{result.history.map(id=><li key={id}>{questionById.get(id)?.prompt} — {answerLabel(id,result.answers[id])}</li>)}</ol></section>)}</details>
  </>;
}
