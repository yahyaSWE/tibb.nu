"use client";
import { useState } from 'react';
import { questionById } from '@/lib/anamnes/questions';
import type { ExtractionObservation, ObservationDecision } from '@/lib/anamnes/observations';
import styles from './tcm-anamnes.module.css';

export function ObservationReview({proposals,onConfirm,onSkip,disabled}:{proposals:ExtractionObservation[];onConfirm:(decisions:ObservationDecision[])=>void;onSkip:()=>void;disabled:boolean}) {
  const [decisions,setDecisions]=useState<ObservationDecision[]>(()=>proposals.map(item=>({questionId:item.questionId,answer:item.answer??'',use:false})));
  return <div>
    <p className={styles.lead}>Stämmer detta med det du menar? Markera de svar du vill använda. Du kan ändra förslagen eller hoppa över dem. Inget är förvalt.</p>
    {proposals.map((item,index)=>{const question=questionById.get(item.questionId)!;const decision=decisions[index];return <fieldset className={`${styles.notice} ${styles.observationCard}`} key={item.questionId} disabled={disabled}>
      <legend>{question.prompt}</legend>
      {item.evidence.map((evidence,index)=><p className={styles.narrativeText} key={index}>”{evidence.excerpt}”</p>)}
      {item.answer===null&&<p>Texten är inte entydig. Välj själv vilket svar som stämmer.</p>}
      <label className={styles.observationSelect}>Svar<select aria-label={`Svar: ${question.prompt}`} value={decision.answer} onChange={event=>setDecisions(previous=>previous.map((value,i)=>i===index?{...value,answer:event.target.value}:value))}><option value="">Välj ett svar</option>{question.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className={styles.option}><input type="checkbox" checked={decision.use} disabled={!decision.answer} onChange={event=>setDecisions(previous=>previous.map((value,i)=>i===index?{...value,use:event.target.checked}:value))}/>Jag bekräftar detta svar</label>
    </fieldset>;})}
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={disabled} onClick={()=>onConfirm(decisions)}>Använd mina bekräftade svar</button><button type="button" className={styles.secondary} disabled={disabled} onClick={onSkip}>Hoppa över tolkningen</button></div>
  </div>;
}
