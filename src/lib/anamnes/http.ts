import "server-only";
import { z } from "zod";
import { rateLimit } from "../db";
import { trustedClientIp } from "../request-rate-limit";
import { tokenHash } from "../security";

export class AnamnesError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function assertAnamnesOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin]);
  // Next or a deployment proxy may expose an internal request origin. The
  // operator-configured public site is an additional explicit trust anchor;
  // never infer it from client-supplied Host or forwarded headers.
  try {
    if (process.env.APP_URL) {
      const publicUrl = new URL(process.env.APP_URL);
      if (["http:", "https:"].includes(publicUrl.protocol) && !publicUrl.username && !publicUrl.password) allowed.add(publicUrl.origin);
    }
  } catch { /* Invalid configuration must not broaden the allowed origins. */ }
  if (!origin || !allowed.has(origin) || request.headers.get("sec-fetch-site") === "cross-site")
    throw new AnamnesError("Öppna formuläret på hemsidan och försök igen.", 403);
}
export async function anamnesRequestJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AnamnesError("Uppgifterna kunde inte läsas.");
  if (!request.body) throw new AnamnesError("Uppgifterna saknas.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 128 * 1024) { await reader.cancel(); throw new AnamnesError("Begäran är för stor.", 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new AnamnesError("Uppgifterna kunde inte läsas."); }
}
export async function enforceAnamnesRateLimit(request: Request, action: "analyze" | "interview" | "submit" | "catalog") {
  // Unknown direct clients share a conservative bucket; user submitted fields
  // never become rate-limit identifiers. Only deployment-trusted IPs are used.
  const subject = trustedClientIp(request.headers) ?? "unattributed";
  if (!(await rateLimit(`anamnes:${action}:${tokenHash(subject)}`, action === "catalog" ? 120 : action === "interview" ? 40 : action === "analyze" ? 12 : 4, 15)))
    throw new AnamnesError("För många försök. Vänta 15 minuter och försök igen.", 429);
}
export function anamnesJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
}
export function anamnesResponseError(error: unknown) {
  if (error instanceof AnamnesError) return anamnesJson({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return anamnesJson({ error: "Kontrollera formulärets svar och samtycken." }, 400);
  // Never log payloads or upstream errors: both can contain health information.
  return anamnesJson({ error: "Begäran kunde inte slutföras. Försök igen senare." }, 503);
}
