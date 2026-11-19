import { after } from "next/server";
import { z } from "zod";
import { getBookingByReference } from "@/lib/db";
import { dispatchBookingEmailOutbox } from "@/lib/email-outbox";
import { reconcileKustomServicePayment, recordKustomServiceCallback } from "@/lib/kustom-service-payments";
import { readShopBody } from "@/lib/shop-checkout";

export const runtime = "nodejs";
export const maxDuration = 60;
const callbackBody = z.object({ order_id: z.string().optional(), session: z.object({ order_id: z.string().optional() }).optional() });

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("ref") ?? "";
  const token = searchParams.get("token") ?? "";
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!/^[a-f0-9]{32}$/.test(reference) || !/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 401, headers });
  try {
    let orderId = searchParams.get("order_id") ?? "";
    if (!orderId && request.body) {
      const body = callbackBody.parse(JSON.parse(await readShopBody(request, 8192)));
      orderId = body.order_id ?? body.session?.order_id ?? "";
    }
    if (!await recordKustomServiceCallback(reference, token, orderId)) return new Response(null, { status: 401, headers });
    after(async () => {
      try {
        await reconcileKustomServicePayment(reference);
        const booking = await getBookingByReference(reference);
        if (booking?.paymentStatus === "paid") await dispatchBookingEmailOutbox({ bookingId: booking.id, limit: 2 });
      } catch { /* The reconciliation job can recover a verified callback. */ }
    });
    return Response.json({ received: true }, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
