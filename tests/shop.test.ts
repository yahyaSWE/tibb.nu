import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createFirstAdmin, createUser, getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import {
  getShopSettings, saveShopSettings, getPublicShopProducts, getPublicShopProduct, getAdminShopProducts, getAdminShopProduct,
  saveShopProduct, reserveShopOrder, expireShopOrders, cancelShopOrder, attachShopCheckout, completeShopPayment,
  refundShopPayment, getShopOrderByReference, getShopOrderById, getShopOrders, getAdminShopOrder, updateShopFulfillment,
} from "../src/lib/shop";
import { POST as checkoutRoute } from "../src/app/api/shop/checkout/route";
import { POST as cancelRoute } from "../src/app/api/shop/cancel/route";
import { POST as webhookRoute } from "../src/app/api/shop/webhook/route";
import { getStripe } from "../src/lib/stripe";
import type { ShopProduct, ShopOrder } from "../src/lib/shop-types";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM", "BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN", "TRUST_PROXY"]) delete process.env[key];
const directory = mkdtempSync(join(tmpdir(), "tibb-shop-tests-"));
process.env.TIBB_DATABASE_PATH = join(directory, "shop.sqlite");
let adminId: number, studentId: number, sequence = 0;
before(async () => {
  adminId = (await createFirstAdmin({ name: "Shop Fixture Admin", email: "shop-admin@example.test", passwordHash: hashPassword("shop fixture password only") })).id;
  studentId = (await createUser({ name: "Shop Fixture Student", email: "shop-student@example.test", passwordHash: hashPassword("student fixture password only"), role: "student" })).id;
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES('shop-test-fixture','isolated')").run();
  const initial = await getShopSettings();
  assert.equal(initial.enabled, false);
  assert.equal(initial.shippingEnabled, true);
  assert.equal(initial.pickupEnabled, true);
});
beforeEach(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_local_shop_fixture_not_live";
  process.env.SHOP_STRIPE_WEBHOOK_SECRET = "whsec_local_shop_fixture_not_live";
  process.env.APP_URL = "https://shop.example.test";
  await getDb().exec("DELETE FROM shop_email_outbox; DELETE FROM shop_orders; DELETE FROM shop_products; DELETE FROM shop_images; DELETE FROM rate_limits;");
  await getDb().prepare("UPDATE settings SET email='contact@example.test' WHERE id=1").run();
  await saveShopSettings(adminId, { enabled: false, shippingEnabled: false, pickupEnabled: false, shippingPriceOre: 0, freeShippingThresholdOre: null, pickupAddress: "", pickupInstructions: "", terms: "" });
});
after(async () => {
  await getDb().close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("tibb-shop-tests-"));
  await rm(directory, { recursive: true, force: true, maxRetries: 15, retryDelay: 300 });
});
async function enabled() {
  return saveShopSettings(adminId, { enabled: true, shippingEnabled: true, pickupEnabled: true, shippingPriceOre: 6900, freeShippingThresholdOre: 50000, pickupAddress: "Only a local fixture pickup address", pickupInstructions: "Fixture pickup instruction", terms: "Original fixture purchase terms retained for the order." });
}
async function product(overrides: Partial<Omit<ShopProduct, "id" | "createdAt" | "updatedAt">> = {}) {
  return saveShopProduct(adminId, null, { name: "Fixture product", slug: `fixture-${++sequence}`, description: "Only an isolated test product", priceOre: 12550, vatPercent: 25, stock: 5, published: false, imageId: null, ...overrides });
}
async function edit(id: number, overrides: Partial<ShopProduct> = {}) {
  const current = (await getAdminShopProduct(adminId, id))!;
  return saveShopProduct(adminId, id, { ...current, ...overrides, expectedUpdatedAt: current.updatedAt });
}
function input(id: number, quantity = 1, delivery: "shipping" | "pickup" = "shipping") {
  return { items: [{ productId: id, quantity }], name: "Fixture customer", email: "shop-customer@example.test", phone: "", delivery, address: "Only fixture street 1", postcode: "123 45", city: "Fixture city", consent: true as const };
}
async function attach(order: ShopOrder, id = `cs_shop_fixture_${order.id}`) {
  await attachShopCheckout(order.reference, id, Math.ceil(Date.now() / 1000) + 1800);
  return id;
}
function request(path: string, body: unknown, origin = "https://shop.example.test") {
  return new Request(`https://shop.example.test/api/shop/${path}`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
}
async function signed(object: Record<string, unknown>, type = "checkout.session.completed") {
  const payload = JSON.stringify({ id: "evt_shop_fixture", object: "event", created: Math.floor(Date.now() / 1000), type, data: { object } });
  return webhookRoute(new Request("https://shop.example.test/api/shop/webhook", { method: "POST", headers: { "stripe-signature": getStripe().webhooks.generateTestHeaderString({ payload, secret: process.env.SHOP_STRIPE_WEBHOOK_SECRET! }) }, body: payload }));
}
async function mockedStripe(work: () => Promise<void>, mocks: { create?: (...args: unknown[]) => Promise<unknown>; expire?: (...args: unknown[]) => Promise<unknown>; refundCreate?: (...args: unknown[]) => Promise<unknown>; refundRetrieve?: (...args: unknown[]) => Promise<unknown>; list?: (...args: unknown[]) => Promise<unknown> }) {
  const sessions = Object.getPrototypeOf(getStripe().checkout.sessions) as Record<string, unknown>;
  const refunds = Object.getPrototypeOf(getStripe().refunds) as Record<string, unknown>;
  const previous: [Record<string, unknown>, string, unknown][] = [];
  for (const [target, key, replacement] of [[sessions, "create", mocks.create], [sessions, "expire", mocks.expire], [sessions, "list", mocks.list], [refunds, "create", mocks.refundCreate], [refunds, "retrieve", mocks.refundRetrieve]] as const) {
    if (replacement) { previous.push([target, key, target[key]]); target[key] = replacement; }
  }
  try { await work(); } finally { for (const [target, key, value] of previous) target[key] = value; }
}

test("shop starts disabled, products are drafts, and public lookup does not expose inactive catalogue", async () => {
  assert.equal((await getShopSettings()).enabled, false);
  const id = await product();
  assert.equal((await getAdminShopProduct(adminId, id))!.published, false);
  assert.deepEqual(await getPublicShopProducts(), []);
  await enabled();
  assert.deepEqual(await getPublicShopProducts(), []);
  await edit(id, { published: true });
  const publicProduct = (await getPublicShopProducts())[0];
  assert.equal(publicProduct.id, id);
  assert.equal((await getPublicShopProduct(publicProduct.slug))!.id, id);
  await saveShopSettings(adminId, { ...await getShopSettings(), enabled: false });
  assert.equal(await getPublicShopProduct(publicProduct.slug), undefined);
  await assert.rejects(reserveShopOrder(input(id)), /inte emot/);
});

test("activation requires Stripe, contact email, purchase terms and enabled delivery with a pickup address", async () => {
  const settings = { ...await getShopSettings(), enabled: true, shippingEnabled: true, terms: "Realistic fixture terms for activation." };
  delete process.env.SHOP_STRIPE_WEBHOOK_SECRET;
  await assert.rejects(saveShopSettings(adminId, settings), /Stripe/);
  process.env.SHOP_STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  await getDb().prepare("UPDATE settings SET email='' WHERE id=1").run();
  await assert.rejects(saveShopSettings(adminId, settings), /kontaktadress/);
  await getDb().prepare("UPDATE settings SET email='contact@example.test' WHERE id=1").run();
  await assert.rejects(saveShopSettings(adminId, { ...settings, terms: "" }), /villkor/);
  await assert.rejects(saveShopSettings(adminId, { ...settings, shippingEnabled: false }), /frakt eller/);
  await assert.rejects(saveShopSettings(adminId, { ...settings, pickupEnabled: true, pickupAddress: "" }), /hämtningsadress/);
  assert.equal((await getShopSettings()).enabled, false);
});

test("fresh admin role guards catalogue, settings, images and orders; prices and stock are validated", async () => {
  await assert.rejects(getAdminShopProducts(studentId), /behörighet/);
  await assert.rejects(saveShopSettings(studentId, await getShopSettings()), /behörighet/);
  await assert.rejects(getShopOrders(studentId), /behörighet/);
  await assert.rejects(getAdminShopOrder(studentId, 1), /behörighet/);
  await assert.rejects(saveShopProduct(studentId, null, { name: "Fixture", slug: "fixture", description: "", priceOre: 100, vatPercent: 25, stock: 1, published: false, imageId: null }), /behörighet/);
  await assert.rejects(product({ priceOre: -1 }));
  await assert.rejects(product({ stock: -1 }));
  await assert.rejects(product({ vatPercent: 24 }));
  await assert.rejects(product({ imageId: randomUUID() }), /produktbild/);
  for (const path of ["varukorg", "kassa", "villkor"]) await assert.rejects(product({ slug: path }), /webbadressen/);
  const image = randomUUID();
  await getDb().prepare("INSERT INTO shop_images(id,bytes_base64,uploader_id,created_at) VALUES(?,?,?,?)").run(image, "fixture-bytes-only", adminId, new Date().toISOString());
  const id = await product({ imageId: image });
  assert.equal((await getAdminShopProduct(adminId, id))!.imageId, image);
  await getDb().exec("PRAGMA foreign_keys=OFF");
  await getDb().prepare("DELETE FROM shop_images WHERE id=?").run(image);
  assert.equal((await getAdminShopProduct(adminId, id))!.imageId, null);
  await getDb().exec("PRAGMA foreign_keys=ON");
});

test("reservation uses server gross prices, quantity limits, Swedish address, shipping thresholds and immutable snapshots", async () => {
  await enabled();
  const id = await product({ published: true, stock: 10 });
  await assert.rejects(reserveShopOrder({ ...input(id), items: [{ productId: id, quantity: 1 }, { productId: id, quantity: 1 }] }), /en gång/);
  await assert.rejects(reserveShopOrder({ ...input(id), postcode: "US-12345" }), /postnummer/);
  await assert.rejects(reserveShopOrder(input(id, 100)));
  await assert.rejects(reserveShopOrder({ ...input(id), consent: false }));
  const order = await reserveShopOrder({ ...input(id, 2), totalOre: 1, priceOre: 1 });
  assert.equal(order.subtotalOre, 25100);
  assert.equal(order.shippingOre, 6900);
  assert.equal(order.totalOre, 32000);
  assert.equal(order.items[0].vatPercent, 25);
  assert.equal(order.postcode, "12345");
  assert.ok(Date.parse(order.expiresAt) - Date.now() > 29 * 60000);
  await edit(id, { name: "Changed catalogue", priceOre: 20000, vatPercent: 12 });
  await saveShopSettings(adminId, { ...await getShopSettings(), terms: "New fixture terms for future orders only." });
  assert.equal((await getShopOrderByReference(order.reference))!.items[0].priceOre, 12550);
  assert.equal((await getShopOrderByReference(order.reference))!.items[0].name, "Fixture product");
  assert.equal((await getShopOrderByReference(order.reference))!.terms, "Original fixture purchase terms retained for the order.");
  const freeShipping = await reserveShopOrder(input(id, 3));
  assert.equal(freeShipping.shippingOre, 0);
  const pickup = await reserveShopOrder(input(id, 1, "pickup"));
  assert.equal(pickup.shippingOre, 0);
  assert.equal(pickup.address, "");
  assert.equal(pickup.pickupAddress, "Only a local fixture pickup address");
  assert.equal(await getShopOrderByReference("invalid/path"), undefined);
});

test("two simultaneous reservations cannot oversell the last item and multi-line failures roll back inventory", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  const results = await Promise.allSettled([reserveShopOrder(input(id)), reserveShopOrder(input(id))]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 0);
  const available = await product({ published: true, stock: 2 });
  await assert.rejects(reserveShopOrder({ ...input(available), items: [{ productId: available, quantity: 2 }, { productId: id, quantity: 1 }] }), /lager/);
  assert.equal((await getAdminShopProduct(adminId, available))!.stock, 2);
});

test("a stale admin form cannot reset reserved stock and each inventory mutation has a monotonic version", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  const old = (await getAdminShopProduct(adminId, id))!;
  const order = await reserveShopOrder(input(id));
  const reserved = (await getAdminShopProduct(adminId, id))!;
  assert.ok(Date.parse(reserved.updatedAt) > Date.parse(old.updatedAt));
  await assert.rejects(saveShopProduct(adminId, id, { ...old, expectedUpdatedAt: old.updatedAt, description: "stale edit" }), /Ladda om/);
  await assert.rejects(saveShopProduct(adminId, id, { ...reserved }), /Ladda om/);
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 0);
  await cancelShopOrder(order.reference);
  const restored = (await getAdminShopProduct(adminId, id))!;
  assert.equal(restored.stock, 1);
  assert.ok(Date.parse(restored.updatedAt) > Date.parse(reserved.updatedAt));
});

test("expired/cancelled reservations restore inventory exactly once and cannot be revived by attaching a session", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  const order = await reserveShopOrder(input(id));
  await getDb().prepare("UPDATE shop_orders SET expires_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z", order.id);
  await Promise.all([expireShopOrders(), expireShopOrders(), cancelShopOrder(order.reference)]);
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 1);
  assert.equal((await getShopOrderById(order.id))!.status, "cancelled");
  await assert.rejects(attachShopCheckout(order.reference, "cs_closed_fixture", Math.ceil(Date.now() / 1000) + 1800), /gått ut/);
  await expireShopOrders();
  await cancelShopOrder(order.reference);
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 1);
});

test("payment verifies amount/currency, remains processable while shop is disabled and queues emails exactly once", async () => {
  await enabled();
  const id = await product({ published: true });
  const order = await reserveShopOrder(input(id));
  const session = await attach(order);
  await saveShopSettings(adminId, { ...await getShopSettings(), enabled: false });
  await assert.rejects(completeShopPayment(session, order.totalOre + 1, "sek"), /match/);
  await assert.rejects(completeShopPayment(session, order.totalOre, "eur"), /match/);
  assert.equal((await getShopOrderById(order.id))!.status, "pending");
  assert.equal(await completeShopPayment(session, order.totalOre, "sek"), "paid");
  assert.equal(await completeShopPayment(session, order.totalOre, "SEK"), "already-paid");
  assert.equal((await getShopOrderById(order.id))!.paymentStatus, "paid");
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM shop_email_outbox WHERE order_id=?").get(order.id))!.total, 2);
  await cancelShopOrder(order.reference);
  assert.equal((await getShopOrderById(order.id))!.status, "paid");
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 4);
});

test("late signed payments bind an orphaned session without reviving stock and require confirmed idempotent refund", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  const original = await reserveShopOrder(input(id));
  await cancelShopOrder(original.reference);
  const replacement = await reserveShopOrder(input(id));
  const keys: string[] = [];
  let refundStatus = "pending";
  const event = { id: "cs_orphaned_fixture", object: "checkout.session", metadata: { application: "tibb.nu.shop", order_reference: original.reference }, payment_status: "paid", amount_total: original.totalOre, currency: "sek", payment_intent: "pi_orphaned_fixture" };
  await mockedStripe(async () => {
    assert.equal((await signed(event)).status, 500);
    assert.equal((await getShopOrderById(original.id))!.paymentStatus, "refund_pending");
    assert.equal((await getShopOrderById(original.id))!.status, "cancelled");
    refundStatus = "succeeded";
    assert.equal((await signed(event)).status, 200);
    assert.equal((await signed(event)).status, 200);
  }, {
    refundCreate: async (_parameters, options) => { keys.push((options as { idempotencyKey: string }).idempotencyKey); return { id: "re_fixture" }; },
    refundRetrieve: async () => ({ id: "re_fixture", status: refundStatus }),
  });
  assert.deepEqual(keys, ["shop-expired-refund-cs_orphaned_fixture", "shop-expired-refund-cs_orphaned_fixture"]);
  assert.equal((await getShopOrderById(original.id))!.paymentStatus, "refunded");
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 0);
  assert.equal((await getShopOrderById(replacement.id))!.status, "pending");
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM shop_email_outbox").get())!.total, 0);
});

test("payment versus cancellation races have exactly one inventory outcome and repeated webhooks cannot double release", async () => {
  await enabled();
  for (const cancellationFirst of [false, true]) {
    const id = await product({ published: true, stock: 1 });
    const original = await reserveShopOrder(input(id));
    const session = await attach(original);
    const payment = () => completeShopPayment(session, original.totalOre, "sek");
    const cancellation = () => cancelShopOrder(original.reference);
    await Promise.all(cancellationFirst ? [cancellation(), payment()] : [payment(), cancellation()]);
    const current = (await getShopOrderById(original.id))!;
    const available = (await getAdminShopProduct(adminId, id))!.stock;
    if (current.status === "paid") {
      assert.equal(available, 0);
      assert.equal(await completeShopPayment(session, original.totalOre, "sek"), "already-paid");
    } else {
      assert.equal(current.status, "cancelled");
      assert.equal(current.paymentStatus, "refund_pending");
      assert.equal(available, 1);
      assert.equal(await completeShopPayment(session, original.totalOre, "sek"), "needs-refund");
      await refundShopPayment(session);
      await refundShopPayment(session);
      assert.equal((await getAdminShopProduct(adminId, id))!.stock, 1);
    }
  }
});

test("signed refunds arriving before session attachment stay refunded when completion arrives later without phantom mail or another refund", async () => {
  await enabled();
  let refundCalls = 0;
  for (const cancelledFirst of [false, true]) {
    const id = await product({ published: true, stock: 1 });
    const original = await reserveShopOrder(input(id));
    let replacement: ShopOrder | undefined;
    if (cancelledFirst) {
      await cancelShopOrder(original.reference);
      replacement = await reserveShopOrder(input(id));
    }
    const session = { id: `cs_refunded_before_attach_${original.id}`, object: "checkout.session", metadata: { application: "tibb.nu.shop", order_reference: original.reference }, payment_status: "paid", amount_total: original.totalOre, currency: "sek", payment_intent: `pi_early_refund_${original.id}` };
    const charge = { id: `ch_early_refund_${original.id}`, object: "charge", refunded: true, amount: original.totalOre, amount_refunded: original.totalOre, currency: "sek", payment_intent: session.payment_intent };
    await mockedStripe(async () => {
      assert.equal((await signed(charge, "charge.refunded")).status, 200);
      assert.equal((await getShopOrderById(original.id))!.checkoutSessionId, session.id);
      assert.equal((await getShopOrderById(original.id))!.status, "refunded");
      assert.equal((await getShopOrderById(original.id))!.paymentStatus, "refunded");
      assert.equal((await signed(session)).status, 200);
      assert.equal((await signed(session)).status, 200);
      assert.equal((await signed(charge, "charge.refunded")).status, 200);
    }, {
      list: async () => ({ data: [session] }),
      refundCreate: async () => { refundCalls++; throw new Error("Already refunded payments must not create another refund"); },
    });
    assert.equal((await getShopOrderById(original.id))!.status, "refunded");
    assert.equal((await getAdminShopProduct(adminId, id))!.stock, cancelledFirst ? 0 : 1);
    if (replacement) assert.equal((await getShopOrderById(replacement.id))!.status, "pending");
  }
  assert.equal(refundCalls, 0);
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM shop_email_outbox").get())!.total, 0);
});

test("early-refund attachment rejects mismatched amount, currency and conflicting session references atomically", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  const original = await reserveShopOrder(input(id));
  const session = { id: "cs_mismatch_refund_fixture", metadata: { application: "tibb.nu.shop", order_reference: original.reference }, amount_total: original.totalOre, currency: "sek" };
  const charge = { id: "ch_mismatch_refund_fixture", object: "charge", refunded: true, payment_intent: "pi_mismatch_refund_fixture" };
  for (const wrong of [{ ...session, amount_total: original.totalOre + 1 }, { ...session, currency: "eur" }]) {
    await mockedStripe(async () => { assert.equal((await signed(charge, "charge.refunded")).status, 500); }, { list: async () => ({ data: [wrong] }) });
    assert.equal((await getShopOrderById(original.id))!.checkoutSessionId, null);
    assert.equal((await getShopOrderById(original.id))!.status, "pending");
    assert.equal((await getAdminShopProduct(adminId, id))!.stock, 0);
  }
  await attach(original, "cs_correct_bound_fixture");
  await mockedStripe(async () => { assert.equal((await signed(charge, "charge.refunded")).status, 500); }, { list: async () => ({ data: [session] }) });
  assert.equal((await getShopOrderById(original.id))!.checkoutSessionId, "cs_correct_bound_fixture");
  assert.equal((await getShopOrderById(original.id))!.status, "pending");
});

test("fulfilled paid order refunds do not assume dispatched goods returned; fulfillment requires correct delivery and admin", async () => {
  await enabled();
  const id = await product({ published: true });
  const shipping = await reserveShopOrder(input(id));
  await assert.rejects(updateShopFulfillment(adminId, shipping.id, { fulfillment: "shipped", trackingNumber: "fixture" }), /betalda/);
  const session = await attach(shipping);
  await completeShopPayment(session, shipping.totalOre, "sek");
  await assert.rejects(updateShopFulfillment(studentId, shipping.id, { fulfillment: "shipped", trackingNumber: "fixture" }), /behörighet/);
  await assert.rejects(updateShopFulfillment(adminId, shipping.id, { fulfillment: "ready", trackingNumber: "" }), /fraktbeställning/);
  await updateShopFulfillment(adminId, shipping.id, { fulfillment: "shipped", trackingNumber: "TRACK-FIXTURE" });
  await refundShopPayment(session);
  await refundShopPayment(session);
  assert.equal((await getShopOrderById(shipping.id))!.status, "refunded");
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 4);
  const pickup = await reserveShopOrder(input(id, 1, "pickup"));
  await completeShopPayment(await attach(pickup), pickup.totalOre, "sek");
  await assert.rejects(updateShopFulfillment(adminId, pickup.id, { fulfillment: "shipped", trackingNumber: "" }), /hämtningsbeställning/);
  await updateShopFulfillment(adminId, pickup.id, { fulfillment: "collected", trackingNumber: "ignored" });
  assert.equal((await getShopOrderById(pickup.id))!.trackingNumber, "");
});

test("checkout HTTP blocks origin/oversize/drafts and uses only canonical server prices in mocked Stripe", async () => {
  await enabled();
  const id = await product({ published: true });
  assert.equal((await checkoutRoute(request("checkout", input(id), "https://foreign.example.test"))).status, 403);
  assert.equal((await checkoutRoute(request("checkout", { ...input(id), extra: "x".repeat(20000) }))).status, 413);
  assert.equal((await checkoutRoute(request("checkout", { ...input(id), consent: false }))).status, 400);
  const draft = await product();
  assert.equal((await checkoutRoute(request("checkout", input(draft)))).status, 409);
  let created: Record<string, unknown> | undefined;
  await mockedStripe(async () => {
    const response = await checkoutRoute(request("checkout", { ...input(id), totalOre: 1 }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: "https://checkout.stripe.com/pay/fixture" });
  }, { create: async (parameters) => { created = parameters as Record<string, unknown>; return { id: "cs_created_fixture", url: "https://checkout.stripe.com/pay/fixture", expires_at: Math.ceil(Date.now() / 1000) + 1800 }; } });
  assert.ok(created);
  assert.equal(((created.line_items as { price_data: { unit_amount: number } }[])[0]).price_data.unit_amount, 12550);
  assert.equal(((created.line_items as { price_data: { unit_amount: number } }[])[1]).price_data.unit_amount, 6900);
  assert.equal((created.metadata as { application: string }).application, "tibb.nu.shop");
  assert.match(String(created.success_url), /^https:\/\/shop\.example\.test\/bestallning\/bekraftelse\?ref=/);
  assert.match(String(created.cancel_url), /cancelled=1$/);
});

test("Stripe creation failure restores inventory, explicit cancel is POST only, and paid returns cannot cancel", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  await mockedStripe(async () => { assert.equal((await checkoutRoute(request("checkout", input(id)))).status, 503); }, { create: async () => { throw new Error("uncertain provider response"); } });
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 1);
  const order = await reserveShopOrder(input(id));
  assert.equal((await cancelRoute(request("cancel", { reference: order.reference }, "https://foreign.example.test"))).status, 403);
  assert.equal((await cancelRoute(request("cancel", { reference: order.reference }))).status, 200);
  assert.equal((await cancelRoute(request("cancel", { reference: order.reference }))).status, 200);
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 1);
});

test("webhook rejects forged signatures and acknowledges foreign events while missing own orders retry", async () => {
  const forged = await webhookRoute(new Request("https://shop.example.test/api/shop/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=forged" }, body: "{}" }));
  assert.equal(forged.status, 400);
  assert.equal((await signed({ id: "cs_booking_foreign", payment_status: "paid", amount_total: 100, currency: "sek", metadata: { application: "tibb.nu", booking_reference: "a".repeat(32) } })).status, 200);
  assert.equal((await signed({ id: "cs_shop_missing", payment_status: "paid", amount_total: 100, currency: "sek", metadata: { application: "tibb.nu.shop", order_reference: "b".repeat(32) } })).status, 500);
});

test("independent Node processes compete safely for the last physical item", async () => {
  await enabled();
  const id = await product({ published: true, stock: 1 });
  async function worker() {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "tests/shop-test-worker.ts", process.env.TIBB_DATABASE_PATH!, String(id)], { cwd: process.cwd(), env: process.env, windowsHide: true });
      let output = "", errors = "";
      child.stdout.on("data", (bytes) => { output += bytes.toString(); });
      child.stderr.on("data", (bytes) => { errors += bytes.toString(); });
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`Isolated worker failed: ${errors}`)));
    });
  }
  const results = await Promise.all([worker(), worker()]);
  assert.deepEqual(results.sort(), ["ok", "unavailable"]);
  assert.equal((await getAdminShopProduct(adminId, id))!.stock, 0);
  assert.equal((await getShopOrders(adminId)).length, 1);
});
