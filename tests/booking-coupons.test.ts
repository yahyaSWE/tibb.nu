import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { saveSlot, updateBooking } from "../src/lib/admin";
import {
  attachCheckout, cancelPendingBooking, completeStripeBooking, createFirstAdmin, getDb, quoteBookingCoupon,
  refundStripeBooking, reserveBooking,
} from "../src/lib/db";
import { saveShopCoupon } from "../src/lib/shop";
import { findApplicableCoupon } from "../src/lib/coupons";
import { localDateTime } from "../src/lib/time";
import { openKustomBooking, reconcileKustomServicePayment } from "../src/lib/kustom-service-payments";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "APP_URL", "SHOP_PAYMENT_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM"]) delete process.env[key];
Object.assign(process.env, {
  TIBB_DATABASE_PATH: ":memory:",
  APP_URL: "https://booking.example.test",
  STRIPE_SECRET_KEY: "sk_test_synthetic",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
  NODE_ENV: "test",
});
let adminId: number;
let treatmentId: number;
let day = 10;

before(async () => {
  adminId = (await createFirstAdmin({ name: "Fixture", email: "admin@example.test", passwordHash: "fixture" })).id;
  treatmentId = Number((await getDb().prepare(
    "INSERT INTO treatments(name,duration_minutes,price_ore,active) VALUES(?,?,?,1)",
  ).run("Testbehandling", 30, 39900)).lastInsertRowid);
  await getDb().prepare("UPDATE settings SET pay_on_site=1,stripe_enabled=1").run();
});
after(() => getDb().close());

async function slot() {
  const date = localDateTime(new Date(Date.now() + day++ * 86400000).toISOString()).slice(0, 10);
  return saveSlot(adminId, treatmentId, `${date}T10:00`);
}

async function coupon(code: string, appliesTo?: "booking" | "both") {
  return saveShopCoupon(adminId, null, {
    code, appliesTo, name: "Testrabatt", type: "percent", value: 10, minSubtotalOre: 0,
    startsAt: null, endsAt: null, maxUses: 1, active: true, combineWithOffers: false,
  });
}

const customer = { name: "Fixture Customer", email: "customer@example.test", phone: "" };

test("booking coupons honor channel, recheck the quoted price and release cancelled unpaid bookings", async () => {
  const slotId = await slot();
  await coupon("LEGACY-SHOP");
  await coupon("BOOKING-ONLY", "booking");
  await assert.rejects(quoteBookingCoupon(slotId, "LEGACY-SHOP"), /den här bokningen/);
  await assert.rejects(findApplicableCoupon("BOOKING-ONLY", 39900, "shop"), /den här beställningen/);
  const quote = await quoteBookingCoupon(slotId, " booking-only ");
  assert.deepEqual(quote, { slotId, code: "BOOKING-ONLY", discountOre: 3990, totalOre: 35910 });

  const bookingInput = { ...customer, slotId, paymentMethod: "onsite" as const, couponCode: quote.code };
  await assert.rejects(reserveBooking({ ...bookingInput, expectedPriceOre: 39900 }), /har ändrats/);
  const booking = await reserveBooking({ ...bookingInput, expectedPriceOre: quote.totalOre });
  assert.equal(booking.priceOre, 35910);
  assert.deepEqual(booking.discount, { code: "BOOKING-ONLY", amountOre: 3990 });
  const next = await slot();
  await assert.rejects(quoteBookingCoupon(next, quote.code), /den här bokningen/);
  await updateBooking(adminId, booking.id, "cancelled", "pending");
  assert.equal((await quoteBookingCoupon(next, quote.code)).totalOre, 35910);
});

test("shared one-use coupons are reserved atomically, release unpaid holds and preserve paid use after refund", async () => {
  const couponCode = "SHARED-CODE";
  await coupon(couponCode, "both");
  const slots = [await slot(), await slot()];
  const input = { ...customer, couponCode, expectedPriceOre: 35910, paymentMethod: "stripe" as const };
  const results = await Promise.allSettled(slots.map(slotId => reserveBooking({ ...input, slotId })));
  const winners = results.filter(result => result.status === "fulfilled");
  assert.equal(winners.length, 1);
  const held = winners[0].value;
  await assert.rejects(findApplicableCoupon(couponCode, 39900, "shop"), /den här beställningen/);
  await cancelPendingBooking(held.reference);
  assert.equal((await findApplicableCoupon(couponCode, 39900, "shop")).uses, 0);

  const final = await reserveBooking({ ...input, slotId: slots[0] });
  await attachCheckout(final.reference, "cs_booking_coupon_fixture");
  await assert.rejects(completeStripeBooking("cs_booking_coupon_fixture", 39900, "sek"), /matchar inte/);
  assert.equal(await completeStripeBooking("cs_booking_coupon_fixture", 35910, "sek"), "confirmed");
  await refundStripeBooking("cs_booking_coupon_fixture");
  await assert.rejects(findApplicableCoupon(couponCode, 39900, "shop"), /den här beställningen/);
});

test("Kustom receives the original price, the discount and the discounted amount for the same booking", async t => {
  for (const [key, value] of Object.entries({
    SHOP_PAYMENT_PROVIDER: "kustom", KUSTOM_ENVIRONMENT: "playground", KUSTOM_API_USERNAME: "test-user",
    KUSTOM_API_PASSWORD: "test-password", KUSTOM_BOOKING_VAT_PERCENT: "25",
  })) {
    const original = process.env[key];
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
    process.env[key] = value;
  }
  await getDb().prepare("UPDATE settings SET kustom_booking_enabled=1").run();
  const couponCode = "KUSTOM-FIXTURE";
  await coupon(couponCode, "booking");
  const booking = await reserveBooking({
    ...customer, slotId: await slot(), paymentMethod: "kustom", couponCode, expectedPriceOre: 35910,
  });
  let order: Record<string, unknown>;
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === "/checkout/v3/orders") {
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.order_amount, 35910);
      assert.deepEqual(payload.order_lines[0], {
        reference: "booking", type: "digital", name: "Behandlingsbokning", quantity: 1,
        unit_price: 39900, total_amount: 35910, total_discount_amount: 3990, tax_rate: 2500, total_tax_amount: 7182,
      });
      order = { ...payload, order_id: "test-coupon-order", status: "CHECKOUT_INCOMPLETE" };
      return Response.json(order);
    }
    if (path === "/hpp/v1/sessions") return Response.json({ session_id: "test-coupon-session", redirect_url: "https://checkout.example.test/coupon" });
    if (path === "/ordermanagement/v1/orders/test-coupon-order") {
      return Response.json({
        ...order, status: "CAPTURED", fraud_status: "ACCEPTED", captured_amount: 35910, refunded_amount: 0,
        initial_payment_method: { type: "CARD" }, refunds: [],
        captures: [{ capture_id: "test-coupon-capture", captured_amount: 35910, captured_at: new Date().toISOString() }],
      });
    }
    if (path.endsWith("/acknowledge")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected request ${path}`);
  });
  assert.equal(await openKustomBooking(booking), "https://checkout.example.test/coupon");
  await reconcileKustomServicePayment(booking.reference);
  const saved = await getDb().prepare("SELECT payment_status FROM bookings WHERE id=?").get(booking.id);
  assert.equal(saved?.payment_status, "paid");
});
