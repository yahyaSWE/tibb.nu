import { selfTestSubmissionConfig } from '@/lib/five-phases/submissions';
import { anamnesJson, anamnesResponseError, enforceAnamnesRateLimit } from '@/lib/anamnes/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
  try { await enforceAnamnesRateLimit(request,'catalog'); return anamnesJson(selfTestSubmissionConfig()); }
  catch (error) { return anamnesResponseError(error); }
}
