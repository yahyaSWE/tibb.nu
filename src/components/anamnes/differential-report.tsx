import type { ReactNode } from 'react';
import type { Report, Evidence, QuestionId } from '@/lib/anamnes/types';
import { questionById } from '@/lib/anamnes/questions';

export function DifferentialReportView({report,beforeAnalysis,children,classes}:{report:Report;beforeAnalysis?:ReactNode;children?:ReactNode;classes?:Record<string,string>}) {
  const styles=classes??{report:'anamnes-admin-differential',warning:'notice notice-error',notice:'notice',directionCard:'notice',reportDetails:'anamnes-therapist-details',patternCard:'anamnes-therapist-card',reportSection:'anamnes-therapist-differential',evidenceGrid:'anamnes-admin-grid',matchLabel:'muted',smallNote:'muted'};
  function EvidenceList({evidence,empty}:{evidence:Evidence[];empty:string}){return evidence.length?<ul>{evidence.map((item,index)=><li key={index}>{item.label}</li>)}</ul>:<p>{empty}</p>;}
  function MissingQuestions({ids}:{ids:QuestionId[]}){return <ul>{ids.map(id=><li key={id}>{questionById.get(id)?.prompt??id}</li>)}</ul>;}
  const assessment=report.differential!,supported=assessment.findings.filter(f=>f.supported);
  return <div className={styles.report}>
    {beforeAnalysis}
    {report.safety.flags.length>0&&<div className={styles.warning}><ul>{report.safety.flags.map(flag=><li key={flag}>{flag}</li>)}</ul></div>}
    <section className={styles.directionCard}><h3>{supported.length?'Preliminär TCM-inriktning':'Ingen tydlig mönsterhypotes ännu'}</h3>
      <p>{supported.length?supported.map(f=>f.name).join(' · '):'Svaren räcker inte för att välja ett underbyggt mönster. Osäkerheter behöver klargöras vid konsultationen.'}</p>
      <p>En terapeut behöver bekräfta bedömningen och kontrollera eventuell användning av örter.</p>
    </section>
    {assessment.medicalNotes.length>0&&<div className={styles.notice}>{assessment.medicalNotes.map(note=><p key={note}>{note}</p>)}</div>}
    <details className={styles.reportDetails}><summary>Så har svaren bedömts</summary>
      <p>{report.source==='ai'?'Anpassad mönsterbedömning med AI och regelkontroll.':'Anpassad lokal mönsterbedömning utan extern AI.'}</p>
      <p>Modellen är inte kliniskt validerad. Saknade svar, ”Vet inte” och avböjda svar är inte nekande fynd.</p>
      {assessment.findings.map(f=><article className={styles.patternCard} key={f.id}><p className={styles.matchLabel}>{f.supported?'Underbyggt enligt modellens regler':'Öppen hypotes – otillräckligt stöd'}</p><h4>{f.name}</h4>
        <div className={styles.evidenceGrid}><div><h5>Talar för</h5><EvidenceList evidence={f.supporting} empty="Inga bekräftade stödjande svar."/></div><div><h5>Talar emot</h5><EvidenceList evidence={f.opposing} empty="Inga motfynd har fångats; det bekräftar inte hypotesen."/></div></div>
        {f.missingQuestionIds.length>0&&<details className={styles.reportDetails}><summary>Uppgifter som behöver klargöras</summary><MissingQuestions ids={f.missingQuestionIds}/></details>}
      </article>)}
    </details>
    <section className={styles.reportSection}><h3>Örtformler att diskutera vid konsultation</h3>
      {!report.formulaMatches.length&&<p>{report.safety.blocksFormulas?'Säkerhetsuppgifterna behöver bedömas innan formelreferenser kan jämföras.':report.formulaStatus==='no_match'?'Ingen av de aktiva katalogformlerna passar tillräckligt väl.':'Underlaget räcker ännu inte till en formeljämförelse.'}</p>}
      {report.formulaMatches.map((f,index)=><article className={styles.patternCard} key={f.formulaId}><p className={styles.matchLabel}>Referens {index+1} · {f.referenceKind==='special_order'?'Specialbeställning via rådgivning':'Ordinarie sortiment'}</p><h4>{f.name}</h4>
        <p>{f.partial?'Delvis överensstämmelse – täcker inte hela symtombilden.':'Möjlig formelreferens för terapeutens bedömning.'}</p><p>{f.limitation}</p>
        <details className={styles.reportDetails}><summary>Motivering och kontrollpunkter</summary><h5>Talar för</h5><EvidenceList evidence={f.supporting} empty="Inga tillräckligt specifika katalogfynd."/><h5>Talar emot</h5><EvidenceList evidence={f.opposing} empty="Inga registrerade motfynd. Individuell lämplighet återstår."/>
          {f.missingQuestionIds.length>0&&<MissingQuestions ids={f.missingQuestionIds}/>}<ul>{[...f.verificationNotes,...f.safetyNotes].filter(Boolean).map((note,i)=><li key={i}>{note}</li>)}</ul>
        </details>
      </article>)}
      <p className={styles.smallNote}>Ingen ordination eller individuell dosering. Faktiskt innehåll, läkemedelsinteraktioner och lämplighet behöver kontrolleras av terapeuten.</p>
    </section>
    {children}
  </div>;
}

