import { getDb } from "@/lib/db";
import { equalSecret } from "@/lib/security";
import { reconcileKustomOrder } from "@/lib/kustom";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32 || !equalSecret(request.headers.get("authorization") || "", `Bearer ${process.env.CRON_SECRET}`))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const rows = await getDb().prepare("SELECT k.order_reference FROM kustom_checkouts k JOIN shop_orders o ON o.reference=k.order_reference WHERE (k.provider_id IS NOT NULL OR k.candidate_id IS NOT NULL) AND o.status!='refunded' ORDER BY k.needs_reconcile DESC,k.updated_at LIMIT 1").all();
  let completed = 0, failed = 0;
  for (const row of rows) {
    try { await reconcileKustomOrder(String(row.order_reference)); completed++; } catch { failed++; }
    finally { await getDb().prepare("UPDATE kustom_checkouts SET needs_reconcile=0,updated_at=? WHERE order_reference=?").run(new Date().toISOString(), String(row.order_reference)); }
  }
  return Response.json({ completed, failed }, { headers });
}
