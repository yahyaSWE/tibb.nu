import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/db';
import { getFormulaCatalog } from '@/lib/anamnes/catalog';
import { LabCaseSchema, buildLabResult, labSafety } from '@/lib/anamnes/lab/engine';
import { requestLabProposal } from '@/lib/anamnes/lab/provider';
import { AnamnesError, anamnesJson, anamnesRequestJson, anamnesResponseError, assertAnamnesOrigin } from '@/lib/anamnes/http';
import { canAnalyzePatterns } from '@/lib/anamnes/engine';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request) {
  try {
    assertAnamnesOrigin(request);
    const actor=await getCurrentUser();
    if(!actor||actor.role!=='admin')throw new AnamnesError('Endast administratörer kan öppna modelltestet.',403);
    if(!await rateLimit(`anamnes-lab:${actor.id}`,60,15))throw new AnamnesError('Testet är tillfälligt pausat av den tekniska anropsgränsen. Dina uppgifter finns kvar.',429);
    const value=LabCaseSchema.parse(await anamnesRequestJson(request));
    const catalog=await getFormulaCatalog();
    const safe=canAnalyzePatterns(labSafety(value));
    // A stopped or unsafe case never calls an external provider just to finish.
    const proposal=value.aiConsent&&safe&&!value.finalize?await requestLabProposal(value):null;
    return anamnesJson(buildLabResult(value,catalog,proposal,proposal?'ai':'local'));
  }catch(error){return anamnesResponseError(error);}
}
