import { z } from "zod";
import { DomainError } from "./db";
import { appUrl, getStripe } from "./stripe";
import { attachShopCheckout, getShopOrderById, getShopSettings } from "./shop";
import type { ShopOrder } from "./shop-types";

export class ShopHttpError extends DomainError {
  constructor(message: string, readonly status: number) { super(message); }
}
export function assertShopOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = [new URL(request.url).origin];
  try { allowed.push(appUrl()); } catch { /* The domain gate reports missing configuration. */ }
  if (!origin || !allowed.includes(origin) || request.headers.get("sec-fetch-site") === "cross-site")
    throw new ShopHttpError("Köpet måste göras från hemsidan.", 403);
}
export async function readShopBody(request: Request, maximum = 16 * 1024): Promise<string> {
  if (!request.body) throw new ShopHttpError("Uppgifterna saknas.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new ShopHttpError("Begäran är för stor.", 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
export async function shopRequestJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ShopHttpError("Skicka uppgifterna som JSON.", 400);
  const body = await readShopBody(request);
  try { return JSON.parse(body); } catch { throw new ShopHttpError("Uppgifterna kunde inte läsas.", 400); }
}
export function shopResponseError(error: unknown) {
  const headers = { "Cache-Control": "no-store" };
  if (error instanceof ShopHttpError) return Response.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof z.ZodError) return Response.json({ error: "Kontrollera varukorgen och dina leveransuppgifter. Godkänn köp- och returvillkoren." }, { status: 400, headers });
  if (error instanceof DomainError) return Response.json({ error: error.message }, { status: 409, headers });
  // Never expose SDK responses, credentials or full customer payloads.
  return Response.json({ error: "Betalningen kunde inte öppnas. Beställningen har inte bekräftats. Försök igen om en stund." }, { status: 503, headers });
}
export async function createShopCheckout(value: ShopOrder): Promise<string> {
  const order = await getShopOrderById(value.id);
  if (!order || order.status !== "pending" || Date.parse(order.expiresAt) <= Date.now()) throw new DomainError("Lagerreservationen har gått ut.");
  if (!(await getShopSettings()).enabled) throw new DomainError("Butiken tar inte emot nya beställningar just nu.");
  const stripe = getStripe();
  const origin = appUrl();
  let sessionId: string | undefined;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment", allowed_payment_method_types: ["card"], customer_email: order.email,
      client_reference_id: order.reference,
      metadata: { application: "tibb.nu.shop", order_reference: order.reference },
      payment_intent_data: { metadata: { application: "tibb.nu.shop", order_reference: order.reference } },
      line_items: [
        ...order.items.filter((item) => (item.lineTotalOre ?? item.priceOre * item.quantity) > 0).map((item) => ({ quantity: 1, price_data: { currency: "sek", unit_amount: item.lineTotalOre ?? item.priceOre * item.quantity, tax_behavior: "inclusive" as const, product_data: { name: item.quantity === 1 ? item.name : `${item.name} × ${item.quantity}` } } })),
        ...(order.shippingOre ? [{ quantity: 1, price_data: { currency: "sek", unit_amount: order.shippingOre, tax_behavior: "inclusive" as const, product_data: { name: order.shippingLabel || "Frakt inom Sverige" } } }] : []),
      ],
      // Stripe enforces a minimum of 30 minutes from API creation. Bind its
      // actual expiry under the reservation lock, rather than a stale timestamp.
      expires_at: Math.ceil(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/bestallning/bekraftelse?ref=${order.reference}`,
      cancel_url: `${origin}/bestallning/bekraftelse?ref=${order.reference}&cancelled=1`,
    }, { idempotencyKey: `shop-order-${order.reference}`, timeout: 10000, maxNetworkRetries: 1 });
    sessionId = session.id;
    if (!session.url || new URL(session.url).protocol !== "https:") throw new DomainError("Betalningssessionen kunde inte öppnas.");
    await attachShopCheckout(order.reference, session.id, session.expires_at);
    return session.url;
  } catch (error) {
    if (sessionId) {
      try { await stripe.checkout.sessions.expire(sessionId, {}, { timeout: 5000, maxNetworkRetries: 0 }); } catch { /* A signed late payment is refunded by the webhook. */ }
    }
    throw error;
  }
}
