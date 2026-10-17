import { interviewAnamnes } from "@/lib/anamnes/service";
import { anamnesJson, anamnesResponseError, anamnesRequestJson, assertAnamnesOrigin, enforceAnamnesRateLimit } from "@/lib/anamnes/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAnamnesOrigin(request);
    // The questionnaire and interview share the same budget. Changing route
    // cannot reset a visitor's allowance.
    await enforceAnamnesRateLimit(request, "analyze");
    return anamnesJson(await interviewAnamnes(await anamnesRequestJson(request)));
  } catch (error) { return anamnesResponseError(error); }
}
