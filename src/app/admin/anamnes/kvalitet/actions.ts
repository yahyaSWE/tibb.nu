'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { saveQualityReview } from '@/lib/anamnes/quality-reviews';
import { AnamnesError } from '@/lib/anamnes/http';
import { z } from 'zod';
export async function saveQualityReviewAction(_previous:{error:string;saved:boolean;revision?:number},form:FormData):Promise<{error:string;saved:boolean;revision?:number}> {
  const actor=await requireAdmin();
  try {
    const review=await saveQualityReview(actor,{datasetVersion:form.get('datasetVersion'),caseId:form.get('caseId'),revision:Number(form.get('revision')),
      expectedStatus:form.get('expectedStatus'),expectedPatterns:form.getAll('expectedPatterns'),notes:form.get('notes'),approved:form.get('approved')==='on'});
    revalidatePath('/admin/anamnes/kvalitet');revalidatePath(`/admin/anamnes/kvalitet/${review.caseId}`);
    return {error:'',saved:true,revision:review.revision};
  } catch(error) {return {saved:false,error:error instanceof AnamnesError?error.message:error instanceof z.ZodError?'Kontrollera status, mönster och motivering. Bekräfta din självständiga granskning.':'Granskningen kunde inte sparas.'};}
}
