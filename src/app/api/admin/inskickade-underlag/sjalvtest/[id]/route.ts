import { getCurrentUser } from '@/lib/auth';
import { deleteSelfTestCase } from '@/lib/five-phases/submissions';
import { AnamnesError, anamnesJson, anamnesResponseError, assertAnamnesOrigin } from '@/lib/anamnes/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  try{
    const actor=await getCurrentUser();
    if(!actor)throw new AnamnesError('Åtkomst nekad.',403);
    assertAnamnesOrigin(request);
    await deleteSelfTestCase(actor,(await params).id);
    return anamnesJson({deleted:true});
  }catch(error){return anamnesResponseError(error);}
}
