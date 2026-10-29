import { requireAdmin } from '@/lib/auth';
import { therapistAccess } from '@/lib/anamnes/cases';
import { labAiStatus } from '@/lib/anamnes/lab/provider';
import { AnamnesAdminNav } from '@/components/admin/anamnes-nav';
import { AdminHeading } from '@/components/admin/common';
import { AnamnesLab } from '@/components/admin/anamnes-lab';
import { PRIVATE_METADATA } from '@/lib/seo';

export const metadata={...PRIVATE_METADATA,title:'Anamnes – separat modelltest'};
export const dynamic='force-dynamic';
export default async function AnamnesModelTestPage(){
  const actor=await requireAdmin();
  return <><AdminHeading title="Anamnes: modelltest" description="Jämför en separat differentialmodell med dagens anamnes. Endast fiktiva fall och manuell granskning."/><AnamnesAdminNav current="lab" therapist={therapistAccess(actor)}/><AnamnesLab ai={labAiStatus()}/></>;
}
