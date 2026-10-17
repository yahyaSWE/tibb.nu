import { getPublicAnamnesCatalog } from "@/lib/anamnes/service";
import { anamnesJson, anamnesResponseError, enforceAnamnesRateLimit } from "@/lib/anamnes/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await enforceAnamnesRateLimit(request, "catalog");
    return anamnesJson(await getPublicAnamnesCatalog());
  } catch (error) { return anamnesResponseError(error); }
}
