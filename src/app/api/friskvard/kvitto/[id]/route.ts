import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { tokenHash } from "@/lib/security";
import { getWellnessPdf, regenerateWellnessPdfCopy } from "@/lib/wellness-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Kvittot hittades inte.", { status: 404, headers });
  const query = new URL(request.url).searchParams;
  const newCopy = query.get("copy") === "updated";
  const secret = query.get("token") || "";
  const permit = !newCopy && /^[a-f0-9]{64}$/.test(secret) && await getDb().prepare(`SELECT d.token_hash FROM wellness_downloads d
    JOIN wellness_receipts r ON r.id=d.receipt_id LEFT JOIN wellness_order_voids v ON v.order_reference=r.order_reference
    WHERE d.token_hash=? AND d.receipt_id=? AND d.expires_at>? AND (v.correction_id IS NULL OR v.correction_id=r.id)`)
    .get(tokenHash(secret), id, new Date().toISOString());
  if (!permit && (await getCurrentUser())?.role !== "admin") return new Response("Kvittot hittades inte eller länken har gått ut.", { status: 404, headers });
  try {
    const copy = newCopy ? await regenerateWellnessPdfCopy(id, query.get("address") === "omit") : null;
    if (newCopy && !copy) return new Response("Kvittot hittades inte.", { status: 404, headers });
    const pdf = copy?.pdf ?? await getWellnessPdf(id);
    const filename = copy ? `friskvard-${copy.number}-kopia.pdf` : `friskvard-${id}.pdf`;
    return new Response(Buffer.from(pdf), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch { return new Response("Kvittot kunde inte hämtas. Försök igen om en stund.", { status: 503, headers }); }
}
