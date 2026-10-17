import { analyzeAnamnes } from "@/lib/anamnes/service";
import { anamnesJson, anamnesResponseError, anamnesRequestJson, assertAnamnesOrigin, enforceAnamnesRateLimit } from "@/lib/anamnes/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertAnamnesOrigin(request);
    await enforceAnamnesRateLimit(request, "analyze");
    return anamnesJson(await analyzeAnamnes(await anamnesRequestJson(request)));
  } catch (error) { return anamnesResponseError(error); }
}
