import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { bookingCancellationDecision, bookingCancellationStatusText } from "../src/lib/booking-cancellation-policy";
import { dispatchBookingRefund, getBookingCancellation, requestBookingCancellation } from "../src/lib/booking-cancellations";
import { createFirstAdmin, getBookingById, getDb, reserveBooking } from "../src/lib/db";
import { dispatchBookingEmailOutbox } from "../src/lib/email-outbox";
import { GET as receiptRoute } from "../src/app/api/bokning/kvitto/route";

for (const name of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_NOTIFICATION_TO", "EMAIL_FROM"])
  delete process.env[name];
Object.assign(process.env, {
  TIBB_DATABASE_PATH: ":memory:", APP_URL: "https://booking.example.test",
  SHOP_PAYMENT_PROVIDER: "kustom", KUSTOM_ENVIRONMENT: "playground",
  KUSTOM_API_USERNAME: "fixture-user", KUSTOM_API_PASSWORD: "fixture-password", NODE_ENV: "test",
});
let treatmentId: number;
const hour = 3_600_000;
const amount = 39900;

before(async () => {
  await createFirstAdmin({ name: "Fixture admin", email: "admin@example.test", passwordHash: "fixture" });
  treatmentId = Number((await getDb().prepare("INSERT INTO treatments(name,duration_minutes,price_ore,active) VALUES(?,?,?,1)")
    .run("Örtrådgivning", 30, amount)).lastInsertRowid);
  await getDb().prepare("UPDATE settings SET kustom_booking_enabled=1,email=?").run("contact@example.test");
});
after(() => getDb().close());

async function booking(hoursAhead: number) {
  const start = Date.now() + hoursAhead * hour;
  const slot = await getDb().prepare("INSERT INTO slots(treatment_id,start,end,practitioner_id) VALUES(?,?,?,1)")
    .run(treatmentId, new Date(start).toISOString(), new Date(start + hour / 2).toISOString());
  const pending = await reserveBooking({
    slotId: Number(slot.lastInsertRowid), name: "Syntetisk Besökare", email: "customer@example.test", phone: "", paymentMethod: "kustom",
  });
  const line = { reference: "booking", type: "digital", name: "Behandlingsbokning", quantity: 1, unit_price: amount,
    total_amount: amount, total_discount_amount: 0, tax_rate: 2500, total_tax_amount: 7980 };
  const orderId = `fixture-order-${pending.id}`;
  await getDb().prepare(`INSERT INTO kustom_service_payments(reference,kind,environment,callback_hash,capture_key,order_id,line_json,deadline,checked_at,state)
    VALUES(?,'booking','playground','fixture','fixture',?,?,?,?, 'paid')`)
    .run(pending.reference, orderId, JSON.stringify(line), pending.expiresAt, new Date().toISOString());
  await getDb().prepare("UPDATE bookings SET status='confirmed',payment_status='paid',expires_at=NULL WHERE id=?").run(pending.id);
  return { ...(await getBookingById(pending.id))!, line, orderId };
}

test("the cancellation cutoff includes exactly 24 hours and late onsite payment remains due", () => {
  const start = new Date("2026-12-15T09:00:00Z");
  const value = { start: start.toISOString(), paymentStatus: "paid" as const, paymentMethod: "kustom" as const, priceOre: amount };
  assert.equal(bookingCancellationDecision(value, 24, start.getTime() - 24 * hour), "refund");
  assert.equal(bookingCancellationDecision(value, 24, start.getTime() - 24 * hour + 1), "retain");
  assert.equal(bookingCancellationDecision({ ...value, paymentStatus: "pending", paymentMethod: "onsite" }, 24, start.getTime() - hour), "collect");
  assert.match(bookingCancellationStatusText("collect", value), /har betalats/);
});

test("customer cancellation frees the slot, refunds exactly once through Kustom and delivers both branded alerts", async t => {
  const value = await booking(48);
  const customerPage = `https://booking.example.test/api/bokning/kvitto?ref=${value.reference}`;
  const receipt = await receiptRoute(new Request(customerPage));
  assert.equal(receipt.status, 200);
  assert.match(receipt.headers.get("cache-control")!, /no-store/);
  assert.equal((await PDFDocument.load(await receipt.arrayBuffer())).getPageCount(), 1);
  assert.equal((await receiptRoute(new Request(customerPage.replace(value.reference, "1".repeat(32))))).status, 404);

  await assert.rejects(requestBookingCancellation(value.reference, "customer", "retain"), /har ändrats/);
  const ids = await Promise.all([requestBookingCancellation(value.reference, "customer", "refund"), requestBookingCancellation(value.reference, "admin")]);
  assert.deepEqual(ids, [value.id, value.id]);
  assert.equal((await getBookingById(value.id))?.status, "cancelled");
  assert.equal((await getBookingById(value.id))?.paymentStatus, "paid");
  assert.equal((await getBookingCancellation(value.id))?.decision, "refund");

  process.env.RESEND_API_KEY = "fixture-only";
  process.env.EMAIL_FROM = "Tibb.nu <fixture@example.test>";
  t.after(() => { delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; });
  let refundCount = 0;
  const recipients: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    const target = new URL(url);
    if (target.hostname === "api.resend.com") {
      const mail = JSON.parse(String(init?.body));
      recipients.push(mail.to[0]);
      assert.match(mail.subject, /avbokad|avbokats/);
      assert.match(mail.html, /återbetalas/);
      assert.ok(!mail.text.includes(value.name));
      return Response.json({ id: "fixture-accepted" });
    }
    const path = `/ordermanagement/v1/orders/${value.orderId}`;
    if (target.pathname === path) return Response.json({
      order_id: value.orderId, merchant_reference1: value.reference, order_amount: amount, purchase_currency: "SEK",
      status: "CAPTURED", captured_amount: amount, refunded_amount: refundCount ? amount : 0, order_lines: [value.line],
    });
    assert.equal(target.pathname, path + "/refunds");
    assert.equal(init?.method, "POST");
    assert.match(new Headers(init?.headers).get("Kustom-Idempotency-Key")!, /^[0-9a-f-]{36}$/);
    assert.equal(JSON.parse(String(init?.body)).refunded_amount, amount);
    refundCount++;
    return new Response(null, { status: 201 });
  });
  assert.equal((await Promise.all([dispatchBookingRefund(value.id), dispatchBookingRefund(value.id)])).filter(Boolean).length, 1);
  assert.equal(refundCount, 1);
  assert.equal((await getBookingById(value.id))?.paymentStatus, "refunded");
  assert.equal((await dispatchBookingEmailOutbox({ bookingId: value.id, event: "cancellation" })).sent, 2);
  assert.deepEqual(recipients.sort(), ["contact@example.test", "customer@example.test"]);
  assert.equal((await dispatchBookingEmailOutbox({ bookingId: value.id, event: "cancellation" })).sent, 0);
});

test("admin cancellation inside the cutoff keeps the original charge and queues both notifications", async t => {
  const value = await booking(7);
  t.mock.method(globalThis, "fetch", async () => { assert.fail("Late cancellation must not make a provider request"); });
  await requestBookingCancellation(value.reference, "admin", "retain");
  assert.equal(await dispatchBookingRefund(value.id), false);
  assert.equal((await getBookingById(value.id))?.paymentStatus, "paid");
  const emails = await getDb().prepare("SELECT body FROM booking_cancellation_email_outbox WHERE booking_id=?").all(value.id);
  assert.equal(emails.length, 2);
  assert.ok(emails.every(email => String(email.body).includes("återbetalas inte")));
});
