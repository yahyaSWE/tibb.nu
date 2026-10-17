import { submitAnamnes } from "@/lib/anamnes/cases";
import { anamnesJson, anamnesResponseError, anamnesRequestJson, assertAnamnesOrigin, enforceAnamnesRateLimit } from "@/lib/anamnes/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertAnamnesOrigin(request);
    await enforceAnamnesRateLimit(request, "submit");
    return anamnesJson(await submitAnamnes(await anamnesRequestJson(request)), 201);
  } catch (error) { return anamnesResponseError(error); }
}
