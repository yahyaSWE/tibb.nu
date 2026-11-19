import { cancelShopOrder, reserveShopOrder, shopCheckoutSchema } from "@/lib/shop";
import { assertShopOrigin, createShopCheckout, shopRequestJson, shopResponseError } from "@/lib/shop-checkout";
import { enforceRequestLimit } from "@/lib/request-rate-limit";
import { shopPaymentProvider } from "@/lib/shop-payment-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let reference: string | undefined;
  try {
    assertShopOrigin(request);
    const input = shopCheckoutSchema.parse(await shopRequestJson(request));
    if (shopPaymentProvider() === "kustom" && !input.checkoutAttemptId)
      return Response.json({ error: "Betalningsförsökets referens saknas. Ladda om kassan och försök igen." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    await enforceRequestLimit("shop-checkout", input.email, 10, request.headers);
    const order = await reserveShopOrder(input);
    reference = order.reference;
    const url = await createShopCheckout(order);
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (reference && shopPaymentProvider() === "kustom")
      return Response.json({ url: `/bestallning/bekraftelse?ref=${reference}` }, { headers: { "Cache-Control": "no-store" } });
    if (reference) {
      try { await cancelShopOrder(reference); } catch { /* Expiry/signed webhook can still recover the persistent order. */ }
    }
    return shopResponseError(error);
  }
}
