import { quoteShopCart, shopQuoteSchema } from "@/lib/shop";
import { assertShopOrigin, shopRequestJson, shopResponseError } from "@/lib/shop-checkout";
import { enforceRequestLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertShopOrigin(request);
    const input = shopQuoteSchema.parse(await shopRequestJson(request));
    await enforceRequestLimit("shop-quote", "price-quote", 120, request.headers);
    const quote = await quoteShopCart(input);
    return Response.json(quote,{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return shopResponseError(error);}
}
