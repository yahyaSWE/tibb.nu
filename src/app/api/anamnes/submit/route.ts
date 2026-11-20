import { submitAnamnes } from "@/lib/anamnes/cases";
import { scheduleIntakeEmail } from "@/lib/intake-email";
import { anamnesJson, anamnesResponseError, anamnesRequestJson, assertAnamnesOrigin, enforceAnamnesRateLimit } from "@/lib/anamnes/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertAnamnesOrigin(request);
    await enforceAnamnesRateLimit(request, "submit");
    const receipt = await submitAnamnes(await anamnesRequestJson(request));
    scheduleIntakeEmail(receipt.reference);
    return anamnesJson(receipt, 201);
  } catch (error) { return anamnesResponseError(error); }
}
