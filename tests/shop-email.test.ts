import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createFirstAdmin, getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import { attachShopCheckout, completeShopPayment, refundShopPayment, reserveShopOrder, saveShopProduct, saveShopSettings } from "../src/lib/shop";
import { dispatchShopOrderEmails, getShopOrderEmailStatus, queueShopOrderEmails } from "../src/lib/shop-email";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_NOTIFICATION_TO", "STRIPE_SECRET_KEY", "SHOP_STRIPE_WEBHOOK_SECRET"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
process.env.APP_URL = "https://trusted.example.test";
process.env.STRIPE_SECRET_KEY = "sk_test_isolated_not_live";
process.env.SHOP_STRIPE_WEBHOOK_SECRET = "whsec_isolated_not_live";
const originalFetch = globalThis.fetch;
let productId: number;
type Delivery = { key: string; body: { from: string; to: string[]; subject: string; text: string } };
let deliveries: Delivery[] = [];
before(async () => {
  const admin = await createFirstAdmin({ name: "Shop mail admin", email: "mail-admin@example.test", passwordHash: hashPassword("isolated shop mail test password") });
  await getDb().prepare("UPDATE settings SET email='contact@example.test' WHERE id=1").run();
  await saveShopSettings(admin.id, { enabled: true, shippingEnabled: true, pickupEnabled: false, shippingPriceOre: 4900, freeShippingThresholdOre: null, pickupAddress: "", pickupInstructions: "", terms: "Isolated test terms for this local shop fixture." });
  productId = await saveShopProduct(admin.id, null, { name: "PRIVATE_PRODUCT_MARKER", slug: "mail-product", description: "", priceOre: 10000, vatPercent: 25, stock: 100, published: true, imageId: null });
});
beforeEach(async () => {
  await getDb().prepare("DELETE FROM shop_email_outbox").run();
  deliveries = [];
  process.env.RESEND_API_KEY = "local-fixture-key";
  process.env.EMAIL_FROM = "Tibb <sender@example.test>";
  process.env.EMAIL_NOTIFICATION_TO = "notify@example.test";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    deliveries.push({ key: new Headers(init?.headers).get("idempotency-key")!, body: JSON.parse(String(init?.body)) });
    return Response.json({ id: `accepted-${deliveries.length}` });
  };
});
after(async () => { globalThis.fetch = originalFetch; await getDb().close(); });
async function order(paid = true) {
  const result = await reserveShopOrder({ items: [{ productId, quantity: 1 }], name: "PRIVATE_CUSTOMER_MARKER", email: "buyer@example.test", phone: "PRIVATE_PHONE_MARKER", delivery: "shipping", address: "PRIVATE_ADDRESS_MARKER", postcode: "553 01", city: "Jönköping", consent: true });
  await attachShopCheckout(result.reference, `cs_mail_${result.id}`, Math.ceil(Date.now() / 1000) + 1800);
  if (paid) await completeShopPayment(`cs_mail_${result.id}`, result.totalOre, "sek");
  return result;
}

test("unpaid orders send nothing; verified payments queue confirmations once even without email configuration", async () => {
  const value = await order(false);
  await queueShopOrderEmails(value.id);
  assert.equal((await getShopOrderEmailStatus(value.id)).customer, null);
  await assert.rejects(completeShopPayment(`cs_mail_${value.id}`, value.totalOre + 1, "sek"));
  assert.equal((await getShopOrderEmailStatus(value.id)).customer, null);
  delete process.env.RESEND_API_KEY;
  await completeShopPayment(`cs_mail_${value.id}`, value.totalOre, "sek");
  await queueShopOrderEmails(value.id);
  await completeShopPayment(`cs_mail_${value.id}`, value.totalOre, "sek");
  assert.equal(Number((await getDb().prepare("SELECT COUNT(*) count FROM shop_email_outbox WHERE order_id=?").get(value.id))!.count), 2);
  assert.equal((await getShopOrderEmailStatus(value.id)).customer?.status, "pending");
  assert.deepEqual(await dispatchShopOrderEmails({ orderId: value.id }), { configured: false, processed: 0, sent: 0, failed: 0 });
  assert.equal(deliveries.length, 0);
});

test("parallel workers send neutral messages exactly once without product, customer or delivery details", async () => {
  const value = await order();
  const results = await Promise.all([dispatchShopOrderEmails({ orderId: value.id }), dispatchShopOrderEmails({ orderId: value.id })]);
  assert.equal(results.reduce((sum, result) => sum + result.sent, 0), 2);
  assert.equal(new Set(deliveries.map(value => value.key)).size, 2);
  assert.ok(deliveries.every(value => !JSON.stringify(value.body).includes("PRIVATE_")));
  assert.ok(deliveries.find(value => value.body.to.includes("buyer@example.test"))!.body.text.includes(value.reference));
  assert.ok(!deliveries.find(value => value.body.to.includes("notify@example.test"))!.body.text.includes(value.reference));
  await dispatchShopOrderEmails({ orderId: value.id });
  assert.equal(deliveries.length, 2);
  assert.equal((await getShopOrderEmailStatus(value.id)).customer?.status, "sent");
});

test("uncertain deliveries retry the same frozen payload and sender with provider idempotency", async () => {
  const value = await order();
  await getDb().prepare("DELETE FROM shop_email_outbox WHERE audience='admin'").run();
  let attempt = 0;
  globalThis.fetch = async (_url, init) => {
    deliveries.push({ key: new Headers(init?.headers).get("idempotency-key")!, body: JSON.parse(String(init?.body)) });
    if (++attempt === 1) throw new Error("uncertain provider acceptance");
    return Response.json({ id: "same-provider-id" });
  };
  assert.equal((await dispatchShopOrderEmails({ orderId: value.id })).failed, 1);
  await getDb().prepare("UPDATE shop_email_outbox SET next_attempt_at='2000-01-01T00:00:00.000Z' WHERE order_id=?").run(value.id);
  process.env.EMAIL_FROM = "Changed <changed@example.test>";
  assert.equal((await dispatchShopOrderEmails({ orderId: value.id })).sent, 1);
  assert.deepEqual(deliveries[0], deliveries[1]);
  assert.equal((await getShopOrderEmailStatus(value.id)).customer?.attempts, 2);
});

test("crashed leases recover; refunds suppress unsent confirmations and retry limits stop indefinite sends", async () => {
  const recover = await order();
  await getDb().prepare("UPDATE shop_email_outbox SET status='sending',lease_until='2000-01-01T00:00:00.000Z',attempts=1,first_attempt_at=? WHERE order_id=?").run(new Date().toISOString(), recover.id);
  assert.equal((await dispatchShopOrderEmails({ orderId: recover.id })).sent, 2);
  const refunded = await order();
  await refundShopPayment(`cs_mail_${refunded.id}`);
  assert.equal((await dispatchShopOrderEmails({ orderId: refunded.id })).sent, 0);
  assert.equal((await getShopOrderEmailStatus(refunded.id)).customer?.status, "skipped");
  const old = await order();
  await getDb().prepare("UPDATE shop_email_outbox SET first_attempt_at=?,attempts=1 WHERE order_id=? AND audience='customer'").run(new Date(Date.now() - 24 * 3600000).toISOString(), old.id);
  await getDb().prepare("UPDATE shop_email_outbox SET attempts=5 WHERE order_id=? AND audience='admin'").run(old.id);
  assert.equal((await dispatchShopOrderEmails({ orderId: old.id })).sent, 0);
  assert.equal((await getShopOrderEmailStatus(old.id)).customer?.status, "failed");
  assert.equal((await getShopOrderEmailStatus(old.id)).admin?.status, "failed");
  assert.equal(deliveries.length, 2);
});
