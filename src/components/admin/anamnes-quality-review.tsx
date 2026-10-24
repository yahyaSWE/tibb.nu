'use client';
import { useActionState } from 'react';
import { saveQualityReviewAction } from '@/app/admin/anamnes/kvalitet/actions';
import { qualityDatasetVersion, type StoredQualityReview } from '@/lib/anamnes/quality-contract';
import { Field } from './common';
export function AnamnesQualityReview({caseId,patterns,review}:{caseId:string;patterns:{id:string;name:string}[];review?:StoredQualityReview}) {
  const [state,action,pending]=useActionState(saveQualityReviewAction,{error:'',saved:false});
  return <form action={action} className="anamnes-admin-editor">
    <input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="datasetVersion" value={qualityDatasetVersion}/><input type="hidden" name="revision" value={state.revision??review?.revision??0}/>
    <Field name="quality-status" label="Förväntat utfall"><select id="quality-status" name="expectedStatus" defaultValue={review?.expectedStatus??''} required disabled={pending}><option value="" disabled>Välj efter din granskning</option><option value="supported_pattern">Underbyggt preliminärt mönster</option><option value="conflicting_evidence">Motstridiga fynd</option><option value="insufficient_evidence">Otillräckligt underlag – avstå</option></select></Field>
    <fieldset disabled={pending}><legend>Samtliga mönster som underlaget stödjer</legend><div className="anamnes-admin-checks">{patterns.map(pattern=><label key={pattern.id}><input type="checkbox" name="expectedPatterns" value={pattern.id} defaultChecked={review?.expectedPatterns.some(id=>id===pattern.id)??false}/><span>{pattern.name}</span></label>)}</div></fieldset>
    <Field name="quality-notes" label="Din motivering och eventuella brister i fallet"><textarea id="quality-notes" name="notes" required minLength={10} maxLength={4000} rows={5} defaultValue={review?.notes??''} disabled={pending}/></Field>
    <label className="form-check"><input type="checkbox" name="approved" required disabled={pending}/><span>Jag har själv granskat det fiktiva fallet och godkänner detta som mitt förväntade utfall.</span></label>
    {state.error&&<p role="alert" className="notice notice-error">{state.error}</p>}{state.saved&&<p role="status" className="notice">Din granskning är sparad.</p>}
    <button className="button" disabled={pending}>{pending?'Sparar…':'Godkänn mitt facit'}</button>
  </form>;
}
