import { getDb } from "@/lib/db";
import { equalSecret } from "@/lib/security";
import { reconcileKustomOrder } from "@/lib/kustom";
import { reconcileKustomServicePayment } from "@/lib/kustom-service-payments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
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
  const service = await getDb().prepare(`SELECT reference FROM kustom_service_payments
    WHERE state IN ('open','paid') AND (order_id IS NOT NULL OR candidate_id IS NOT NULL)
    ORDER BY needs_reconcile DESC,checked_at LIMIT 1`).get();
  if (service) {
    const reference = String(service.reference);
    await getDb().prepare("UPDATE kustom_service_payments SET needs_reconcile=0,checked_at=? WHERE reference=?").run(new Date().toISOString(), reference);
    try { await reconcileKustomServicePayment(reference); completed++; } catch { failed++; }
  }
  return Response.json({ completed, failed }, { headers });
}
