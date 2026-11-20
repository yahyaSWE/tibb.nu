import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { equalSecret } from "@/lib/security";

const issuer = "https://token.actions.githubusercontent.com";
const audience = "https://www.tibb.nu/api/email/outbox";
const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));

export async function canRunEmailOutbox(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (secret && secret.length >= 32 && equalSecret(authorization, `Bearer ${secret}`)) return true;

  if (process.env.VERCEL_ENV !== "production" || !authorization.startsWith("Bearer ") || authorization.length > 8192) return false;
  const token = authorization.slice(7);
  try {
    // Reject unrelated tokens before making a request for the public signing keys.
    const claims = decodeJwt(token);
    if (claims.iss !== issuer || claims.aud !== audience ||
      claims.repository_id !== "1405480764" ||
      claims.ref !== "refs/heads/main" ||
      claims.workflow_ref !== "yahyaSWE/tibb.nu/.github/workflows/email-outbox.yml@refs/heads/main" ||
      (claims.event_name !== "schedule" && claims.event_name !== "workflow_dispatch")) return false;

    await jwtVerify(token, keys, { issuer, audience, algorithms: ["RS256"], requiredClaims: ["exp", "iat"], maxTokenAge: "5 minutes" });
    return true;
  } catch {
    return false;
  }
}
