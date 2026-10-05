import { NextResponse } from "next/server";
import {
  completeStripeBooking,
  expireStripeSession,
  refundStripeBooking,
} from "@/lib/db";
import { getStripe } from "@/lib/stripe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature)
    return NextResponse.json(
      { error: "Webhook not configured or signature missing" },
      { status: 400 },
    );
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      if (
        session.payment_status === "paid" ||
        session.payment_status === "no_payment_required"
      ) {
        const outcome = await completeStripeBooking(
          session.id,
          session.amount_total ?? -1,
          session.currency ?? "",
        );
        if (outcome === "needs-refund") {
          if (session.amount_total === 0) await refundStripeBooking(session.id);
          else {
            const intent =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id;
            if (!intent)
              throw new Error(
                "Expired paid session is missing its PaymentIntent",
              );
            const initial = await stripe.refunds.create(
              { payment_intent: intent },
              { idempotencyKey: `expired-booking-refund-${session.id}` },
            );
            const refund = await stripe.refunds.retrieve(initial.id);
            // Pending or failed refunds must never appear completed locally.
            // Stripe retries this webhook; charge.refunded also finalizes it.
            if (refund.status !== "succeeded")
              throw new Error("Expired booking refund is not yet complete");
            await refundStripeBooking(session.id);
          }
        }
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await expireStripeSession(event.data.object.id);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      if (charge.refunded && charge.payment_intent) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent:
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent.id,
          limit: 1,
        });
        if (sessions.data[0]) await refundStripeBooking(sessions.data[0].id);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      "Stripe webhook handling failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Unable to process event" },
      { status: 500 },
    );
  }
}
