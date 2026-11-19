import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { tokenHash } from "@/lib/security";
import { getWellnessPdf } from "@/lib/wellness-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Kvittot hittades inte.", { status: 404, headers });
  const secret = new URL(request.url).searchParams.get("token") || "";
  const permit = /^[a-f0-9]{64}$/.test(secret) && await getDb().prepare("SELECT token_hash FROM wellness_downloads WHERE token_hash=? AND receipt_id=? AND expires_at>?").get(tokenHash(secret), id, new Date().toISOString());
  if (!permit && (await getCurrentUser())?.role !== "admin") return new Response("Kvittot hittades inte eller länken har gått ut.", { status: 404, headers });
  try {
    const pdf = await getWellnessPdf(id);
    return new Response(Buffer.from(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="friskvard-${id}.pdf"` } });
  } catch { return new Response("Kvittot kunde inte hämtas. Försök igen om en stund.", { status: 503, headers }); }
}
