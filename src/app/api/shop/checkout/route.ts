import { cancelShopOrder, reserveShopOrder, shopCheckoutSchema } from "@/lib/shop";
import { assertShopOrigin, createShopCheckout, shopRequestJson, shopResponseError } from "@/lib/shop-checkout";
import { enforceRequestLimit } from "@/lib/request-rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let reference: string | undefined;
  try {
    assertShopOrigin(request);
    const input = shopCheckoutSchema.parse(await shopRequestJson(request));
    await enforceRequestLimit("shop-checkout", input.email, 10, request.headers);
    const order = await reserveShopOrder(input);
    reference = order.reference;
    const url = await createShopCheckout(order);
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (reference) {
      try { await cancelShopOrder(reference); } catch { /* Expiry/signed webhook can still recover the persistent order. */ }
    }
    return shopResponseError(error);
  }
}
