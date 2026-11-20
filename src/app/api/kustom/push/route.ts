import { reconcileKustomOrder, validateKustomCallback } from "@/lib/kustom";
import { readShopBody } from "@/lib/shop-checkout";
import { dispatchShopOrderEmails } from "@/lib/shop-email";
import { getShopOrderByReference } from "@/lib/shop";
import { dispatchWellnessEmails } from "@/lib/wellness-email";
import { after } from "next/server";
import { getDb } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref") || "";
  const token = url.searchParams.get("token") || "";
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!/^[a-f0-9]{32}$/.test(reference) || !/^[a-f0-9]{64}$/.test(token)) return Response.json({ error: "Invalid callback" }, { status: 401, headers });
  try {
    let providerId = url.searchParams.get("order_id") || "";
    if (!providerId && request.body) {
      const body: unknown = JSON.parse(await readShopBody(request, 8192));
      if (body && typeof body === "object" && "order_id" in body && typeof body.order_id === "string") providerId = body.order_id;
    }
    if (!providerId) providerId = String((await getDb().prepare("SELECT provider_id FROM kustom_checkouts WHERE order_reference=?").get(reference))?.provider_id || "");
    await validateKustomCallback(reference, token, providerId);
    await getDb().prepare("UPDATE kustom_checkouts SET candidate_id=?,needs_reconcile=1 WHERE order_reference=?").run(providerId, reference);
    after(async () => {
      try {
        await reconcileKustomOrder(reference, { providerId });
        await getDb().prepare("UPDATE kustom_checkouts SET needs_reconcile=0 WHERE order_reference=?").run(reference);
        const order = await getShopOrderByReference(reference);
        if (order) {
          await dispatchShopOrderEmails({ orderId: order.id, event: "agreement", limit: 1 });
          await dispatchShopOrderEmails({ orderId: order.id, limit: 2 });
        }
        await dispatchWellnessEmails({ reference, limit: 2 });
      } catch { /* The durable reconcile flag is recovered by the cron/admin path. */ }
    });
    return Response.json({ received: true }, { headers });
  } catch { return Response.json({ error: "Callback could not be verified or reconciled" }, { status: 503, headers }); }
}
