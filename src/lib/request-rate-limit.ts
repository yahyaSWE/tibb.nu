import { isIP } from "node:net";
import { DomainError, rateLimit } from "./db";
import { tokenHash } from "./security";

export function trustedClientIp(headers: Pick<Headers, "get">): string | null {
  const header = process.env.VERCEL
    ? headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")
    : process.env.TRUST_PROXY === "1" ? headers.get("x-forwarded-for") : null;
  if (!header) return null;
  const candidate = header.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}
export async function enforceRequestLimit(action: string, subject: string, count: number, headers: Pick<Headers, "get">) {
  const ip = trustedClientIp(headers);
  if (!(await rateLimit(`${action}:${tokenHash(subject)}`, count, 15)) ||
      (ip && !(await rateLimit(`${action}:ip:${tokenHash(ip)}`, 100, 15))))
    throw new DomainError("För många försök. Vänta 15 minuter och försök igen.");
}
