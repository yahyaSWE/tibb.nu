import { reconcileKustomOrder } from "@/lib/kustom";
import { assertShopOrigin, shopRequestJson, shopResponseError } from "@/lib/shop-checkout";
import { enforceRequestLimit } from "@/lib/request-rate-limit";
import { z } from "zod";
import { after } from "next/server";
import { dispatchWellnessEmails } from "@/lib/wellness-email";
import { dispatchShopOrderEmails } from "@/lib/shop-email";
import { getShopOrderByReference } from "@/lib/shop";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertShopOrigin(request);
    const { reference } = z.object({ reference: z.string().regex(/^[a-f0-9]{32}$/) }).parse(await shopRequestJson(request));
    await enforceRequestLimit("kustom-status", reference, 20, request.headers);
    const result = await reconcileKustomOrder(reference);
    after(async () => {
      const order = await getShopOrderByReference(reference);
      if (order) await dispatchShopOrderEmails({ orderId: order.id, event: "agreement", limit: 1 });
      if (order?.paymentStatus === "paid") await dispatchShopOrderEmails({ orderId: order.id, limit: 2 });
      await dispatchWellnessEmails({ reference, limit: 2 });
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return shopResponseError(error); }
}
