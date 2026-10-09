import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { completeShopPayment, expireShopCheckout, refundShopPayment, getShopOrderByReference } from "@/lib/shop";
import { readShopBody } from "@/lib/shop-checkout";
import { dispatchShopOrderEmails } from "@/lib/shop-email";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.SHOP_STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !process.env.STRIPE_SECRET_KEY || !signature) return Response.json({ error: "Webhook unavailable" }, { status: 400 });
  const stripe = getStripe();
  let event;
  try { event = stripe.webhooks.constructEvent(await readShopBody(request, 512 * 1024), signature, secret); }
  catch { return Response.json({ error: "Invalid signature" }, { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const stored = await getDb().prepare("SELECT id FROM shop_orders WHERE checkout_session_id=?").get(session.id);
      const reference = session.metadata?.order_reference;
      const own = session.metadata?.application === "tibb.nu.shop" && reference && /^[a-f0-9]{32}$/.test(reference);
      if (!stored && !own) return Response.json({ received: true });
      if (session.payment_status === "paid") {
        const outcome = await completeShopPayment(session.id, session.amount_total ?? -1, session.currency ?? "", own ? reference : undefined);
        if (outcome === "needs-refund") {
          const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          if (!intent) throw new Error("Shop late payment has no PaymentIntent");
          const created = await stripe.refunds.create({ payment_intent: intent }, { idempotencyKey: `shop-expired-refund-${session.id}`, timeout: 10000, maxNetworkRetries: 1 });
          const refund = await stripe.refunds.retrieve(created.id, {}, { timeout: 5000, maxNetworkRetries: 0 });
          if (refund.status !== "succeeded") throw new Error("Shop refund is not confirmed");
          await refundShopPayment(session.id);
        } else if (outcome === "paid" || outcome === "already-paid") {
          const current = stored ? { id: Number(stored.id) } : reference ? await getShopOrderByReference(reference) : undefined;
          if (current) await dispatchShopOrderEmails({ orderId: current.id, limit: 2 });
        }
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      await expireShopCheckout(session.id);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      if (charge.refunded && charge.payment_intent) {
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
        const sessions = await stripe.checkout.sessions.list({ payment_intent: intent, limit: 10 }, { timeout: 5000, maxNetworkRetries: 0 });
        for (const session of sessions.data) {
          const reference = session.metadata?.order_reference;
          if (session.metadata?.application === "tibb.nu.shop" && reference)
            await refundShopPayment(session.id, { reference, amountOre: session.amount_total ?? -1, currency: session.currency ?? "" });
          else await refundShopPayment(session.id);
        }
      }
    }
    return Response.json({ received: true });
  } catch {
    // Unknown own sessions/mismatched amounts/unfinished refunds retry. Do not
    // log full events, SDK responses or customer details.
    return Response.json({ error: "Unable to process shop payment" }, { status: 500 });
  }
}
