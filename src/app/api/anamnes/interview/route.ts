import { interviewAnamnes } from "@/lib/anamnes/service";
import { anamnesJson, anamnesResponseError, anamnesRequestJson, assertAnamnesOrigin, enforceAnamnesRateLimit } from "@/lib/anamnes/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAnamnesOrigin(request);
    // Allow the finite reviewed interview to finish while retaining a request
    // rate limit and the separate deployment-wide provider spending budget.
    await enforceAnamnesRateLimit(request, "interview");
    return anamnesJson(await interviewAnamnes(await anamnesRequestJson(request)));
  } catch (error) { return anamnesResponseError(error); }
}
