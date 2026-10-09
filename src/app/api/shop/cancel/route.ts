import { z } from "zod";
import { cancelShopOrder } from "@/lib/shop";
import { assertShopOrigin, shopRequestJson, shopResponseError } from "@/lib/shop-checkout";
import { enforceRequestLimit } from "@/lib/request-rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertShopOrigin(request);
    const value = z.object({ reference: z.string().regex(/^[a-f0-9]{32}$/) }).parse(await shopRequestJson(request));
    await enforceRequestLimit("shop-cancel", value.reference, 10, request.headers);
    await cancelShopOrder(value.reference);
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return shopResponseError(error); }
}
