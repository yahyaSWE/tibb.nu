import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { createFirstAdmin, getDb, reserveBooking, attachCheckout, completeStripeBooking, getBookingByReference } from "../src/lib/db";
import { saveSlot, updateBooking } from "../src/lib/admin";
import { hashPassword } from "../src/lib/security";
import { localDateTime } from "../src/lib/time";
import { dispatchBookingEmailOutbox, getBookingEmailStatus, queueBookingEmails } from "../src/lib/email-outbox";
import { getStripe } from "../src/lib/stripe";
import { POST as stripeWebhook } from "../src/app/api/stripe/webhook/route";
import { GET as dispatchRoute } from "../src/app/api/email/outbox/route";
import { getBookingTerms } from "../src/lib/business-settings";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM", "APP_URL", "CRON_SECRET"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
const originalFetch = globalThis.fetch;
let adminId: number, treatmentId: number;
let sequence = 0;
type Delivery = { key: string; payload: { from: string; to: string[]; subject: string; text: string } };
let deliveries: Delivery[] = [];
before(async () => {
  adminId = (await createFirstAdmin({ name: "Outbox Admin", email: "outbox-admin@example.test", passwordHash: hashPassword("isolated outbox test password") })).id;
  const result = await getDb().prepare("INSERT INTO treatments(name,description,duration_minutes,price_ore,active) VALUES(?,?,45,49900,1)").run("PRIVATE_TREATMENT_MARKER", "",);
  treatmentId = Number(result.lastInsertRowid);
  await getDb().prepare("UPDATE settings SET pay_on_site=1,stripe_enabled=1 WHERE id=1").run();
});
beforeEach(async () => {
  await getDb().prepare("DELETE FROM booking_email_outbox").run();
  deliveries = [];
  process.env.APP_URL = "https://trusted.example.test";
  process.env.RESEND_API_KEY = "local-fixture-key";
  process.env.EMAIL_FROM = "Tibb <sender@example.test>";
  process.env.EMAIL_NOTIFICATION_TO = "notify@example.test";
  process.env.STRIPE_SECRET_KEY = "sk_test_local_fixture_not_live";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_local_fixture_not_live";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    const key = new Headers(init?.headers).get("idempotency-key")!;
    const payload = JSON.parse(String(init?.body)) as Delivery["payload"];
    deliveries.push({ key, payload });
    return Response.json({ id: `accepted-local-${deliveries.length}` });
  };
});
after(async () => { globalThis.fetch = originalFetch; await getDb().close(); });
async function booking(method: "onsite" | "stripe" = "onsite") {
  const date = localDateTime(new Date(Date.now() + (++sequence + 10) * 86400000).toISOString()).slice(0, 10);
  const slotId = await saveSlot(adminId, treatmentId, `${date}T10:00`);
  return reserveBooking({ slotId, name: "PRIVATE_CUSTOMER_MARKER", email: `customer-${sequence}@example.test`, phone: "PRIVATE_PHONE_MARKER", paymentMethod: method });
}
async function signedSession(object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: "evt_local_signed", object: "event", created: Math.floor(Date.now() / 1000), type: "checkout.session.completed", data: { object: { object: "checkout.session", payment_status: "paid", amount_total: 49900, currency: "sek", ...object } } });
  return stripeWebhook(new Request("https://trusted.example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": getStripe().webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! }) }, body: payload }));
}

test("confirmed onsite booking queues two durable jobs once; missing configuration sends none and preserves them", async () => {
  delete process.env.RESEND_API_KEY;
  const value = await booking();
  assert.equal((await getBookingTerms(value.reference))?.recordedAt, value.createdAt);
  await queueBookingEmails(value.id);
  await queueBookingEmails(value.id);
  const status = await getBookingEmailStatus(value.id);
  assert.equal(status.configured, false);
  assert.equal(status.customer?.status, "pending");
  assert.equal(status.admin?.status, "pending");
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM booking_email_outbox").get())!.total, 2);
  assert.deepEqual(await dispatchBookingEmailOutbox({ bookingId: value.id }), { configured: false, processed: 0, sent: 0, failed: 0 });
  assert.equal(deliveries.length, 0);
});

test("only verified Stripe payment queues confirmation; repeated webhook/domain completion cannot duplicate jobs", async () => {
  const value = await booking("stripe");
  await queueBookingEmails(value.id);
  assert.equal((await getBookingEmailStatus(value.id)).customer, null);
  const checkout = `cs_fixture_${value.id}`;
  await attachCheckout(value.reference, checkout);
  await assert.rejects(completeStripeBooking(checkout, value.priceOre - 1, "sek"), /matchar/);
  assert.equal((await getBookingEmailStatus(value.id)).customer, null);
  assert.equal(await completeStripeBooking(checkout, value.priceOre, "sek"), "confirmed");
  assert.equal(await completeStripeBooking(checkout, value.priceOre, "sek"), "already-paid");
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM booking_email_outbox WHERE booking_id=?").get(value.id))!.total, 2);
});

test("parallel dispatchers claim each job once and messages contain no treatment, customer or phone details", async () => {
  const value = await booking();
  const results = await Promise.all([dispatchBookingEmailOutbox({ bookingId: value.id }), dispatchBookingEmailOutbox({ bookingId: value.id })]);
  assert.equal(results.reduce((sum, result) => sum + result.sent, 0), 2);
  assert.equal(deliveries.length, 2);
  assert.equal(new Set(deliveries.map((delivery) => delivery.key)).size, 2);
  for (const delivery of deliveries) {
    assert.ok(!JSON.stringify(delivery.payload).includes("PRIVATE_"));
    assert.match(delivery.payload.text, /https:\/\/trusted\.example\.test\//);
  }
  const customer = deliveries.find((delivery) => delivery.payload.to[0] === value.email)!;
  assert.ok(customer.payload.text.includes(value.reference));
  assert.ok(!deliveries.find((delivery) => delivery.payload.to[0] === "notify@example.test")!.payload.text.includes(value.reference));
  const status = await getBookingEmailStatus(value.id);
  assert.equal(status.customer?.status, "sent");
  assert.equal(status.admin?.status, "sent");
  assert.ok(status.customer?.sentAt);
  await dispatchBookingEmailOutbox({ bookingId: value.id });
  assert.equal(deliveries.length, 2);
});

test("uncertain provider acceptance retries with exactly the same idempotency key and payload", async () => {
  const value = await booking();
  await getDb().prepare("DELETE FROM booking_email_outbox WHERE audience='admin'").run();
  let attempts = 0;
  const accepted = new Map<string, string>();
  globalThis.fetch = async (_url, init) => {
    const key = new Headers(init?.headers).get("idempotency-key")!;
    const payload = JSON.parse(String(init?.body)) as Delivery["payload"];
    deliveries.push({ key, payload });
    if (!accepted.has(key)) accepted.set(key, "same-provider-id");
    if (++attempts === 1) throw new Error("timeout after provider accepted");
    return Response.json({ id: accepted.get(key) });
  };
  assert.equal((await dispatchBookingEmailOutbox({ bookingId: value.id })).failed, 1);
  assert.equal((await getBookingEmailStatus(value.id)).customer?.status, "pending");
  await getDb().prepare("UPDATE booking_email_outbox SET next_attempt_at=? WHERE booking_id=?").run("2000-01-01T00:00:00.000Z", value.id);
  process.env.EMAIL_FROM = "Changed sender <changed@example.test>";
  assert.equal((await dispatchBookingEmailOutbox({ bookingId: value.id })).sent, 1);
  assert.equal(accepted.size, 1);
  assert.deepEqual(deliveries[0], deliveries[1]);
  assert.equal((await getBookingEmailStatus(value.id)).customer?.attempts, 2);
});

test("retry budget and Resend idempotency retention prevent uncertain deliveries from being replayed indefinitely", async () => {
  const value = await booking();
  await getDb().prepare("UPDATE booking_email_outbox SET first_attempt_at=?,attempts=? WHERE booking_id=? AND audience='customer'")
    .run(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), 1, value.id);
  await getDb().prepare("UPDATE booking_email_outbox SET attempts=5 WHERE booking_id=? AND audience='admin'").run(value.id);
  const dispatched = await dispatchBookingEmailOutbox({ bookingId: value.id });
  assert.equal(dispatched.sent, 0);
  assert.equal(deliveries.length, 0);
  const status = await getBookingEmailStatus(value.id);
  assert.equal(status.customer?.status, "failed");
  assert.equal(status.admin?.status, "failed");
  await queueBookingEmails(value.id);
  await dispatchBookingEmailOutbox({ bookingId: value.id });
  assert.equal(deliveries.length, 0);
});

test("crashed worker leases recover, while cancelled and past bookings suppress queued notifications", async () => {
  const recoverable = await booking();
  await getDb().prepare("UPDATE booking_email_outbox SET status='sending',lease_until=?,lease_token='old-worker',first_attempt_at=?,attempts=1 WHERE booking_id=?")
    .run("2000-01-01T00:00:00.000Z", new Date().toISOString(), recoverable.id);
  assert.equal((await dispatchBookingEmailOutbox({ bookingId: recoverable.id })).sent, 2);
  const cancelled = await booking();
  await updateBooking(adminId, cancelled.id, "cancelled", "pending");
  await dispatchBookingEmailOutbox({ bookingId: cancelled.id });
  assert.equal((await getBookingEmailStatus(cancelled.id)).customer?.status, "skipped");
  const past = await booking();
  await getDb().prepare("UPDATE bookings SET start=? WHERE id=?").run("2000-01-01T00:00:00.000Z", past.id);
  await dispatchBookingEmailOutbox({ bookingId: past.id });
  assert.equal((await getBookingEmailStatus(past.id)).customer?.status, "skipped");
  assert.equal(deliveries.length, 2);
});

test("correctly signed foreign Stripe sessions are acknowledged; missing own bookings still trigger provider retry", async () => {
  assert.equal((await signedSession({ id: "cs_other_application", client_reference_id: "other-public-id", metadata: { application: "another-app" } })).status, 200);
  assert.equal((await signedSession({ id: "cs_foreign_without_metadata" })).status, 200);
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await signedSession({ id: "cs_own_not_attached_yet", client_reference_id: "a".repeat(32), metadata: { application: "tibb.nu", booking_reference: "a".repeat(32) } })).status, 500);
    assert.equal((await signedSession({ id: "cs_legacy_own_not_attached_yet", client_reference_id: "b".repeat(32), metadata: { booking_reference: "b".repeat(32) } })).status, 500);
  } finally { console.error = originalError; }
});

test("signed legacy session confirms only its stored booking and sends neutral confirmation after verified payment", async () => {
  const value = await booking("stripe");
  await attachCheckout(value.reference, `cs_legacy_${value.id}`);
  assert.equal((await signedSession({ id: `cs_legacy_${value.id}` })).status, 200);
  assert.equal((await getBookingByReference(value.reference))!.paymentStatus, "paid");
  assert.equal(deliveries.length, 2);
  assert.equal((await signedSession({ id: `cs_legacy_${value.id}` })).status, 200);
  assert.equal(deliveries.length, 2);
});

test("outbox HTTP retry requires configured long secret and constant-time bearer authentication", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await dispatchRoute(new Request("https://trusted.example.test/api/email/outbox"))).status, 503);
  process.env.CRON_SECRET = "fixture-cron-secret-at-least-thirty-two-characters";
  assert.equal((await dispatchRoute(new Request("https://trusted.example.test/api/email/outbox", { headers: { authorization: "Bearer wrong" } }))).status, 401);
  await booking();
  const response = await dispatchRoute(new Request("https://trusted.example.test/api/email/outbox", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.sent, 2);
  assert.ok(!JSON.stringify(result).includes("@"));
});
