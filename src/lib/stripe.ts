import Stripe from "stripe";
import { DomainError, attachCheckout, type Booking } from "./db";
export function stripeReady() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.APP_URL
  );
}
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new DomainError("Stripe är inte konfigurerat.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new DomainError("APP_URL saknas på servern.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new DomainError("APP_URL måste vara en giltig https-adress.");
  return url.origin;
}
export async function createCheckout(booking: Booking) {
  const stripe = getStripe();
  const base = appUrl();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      allowed_payment_method_types: ["card"],
      customer_email: booking.email,
      client_reference_id: booking.reference,
      metadata: { booking_reference: booking.reference },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "sek",
            unit_amount: booking.priceOre,
            product_data: {
              name: booking.treatmentName,
              description: `${booking.durationMinutes} minuter`,
            },
          },
        },
      ],
      expires_at: Math.floor(Date.parse(booking.expiresAt!) / 1000),
      success_url: `${base}/bokning/bekraftelse?ref=${encodeURIComponent(booking.reference)}`,
      cancel_url: `${base}/api/stripe/cancel?ref=${encodeURIComponent(booking.reference)}`,
    },
    { idempotencyKey: `booking-${booking.reference}` },
  );
  if (!session.url)
    throw new DomainError("Det gick inte att öppna betalningen.");
  await attachCheckout(booking.reference, session.id);
  return session.url;
}
