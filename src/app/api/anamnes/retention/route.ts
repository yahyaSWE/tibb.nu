import { pruneExpiredAnamnesCases } from "@/lib/anamnes/cases";
import { AnamnesError, anamnesJson, anamnesResponseError } from "@/lib/anamnes/http";
import { equalSecret } from "@/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Configure a daily operator-controlled job only after retention/storage has
// been reviewed. Merely deploying this route never activates a scheduled job.
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET ?? "";
    if (secret.length < 32 || !equalSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) throw new AnamnesError("Åtkomst nekad.", 403);
    return anamnesJson({ deleted: await pruneExpiredAnamnesCases() });
  } catch (error) { return anamnesResponseError(error); }
}
