import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError, getDb, transaction } from "./db";
import { assertAdmin } from "./admin";
import { cancelShopOrder, getShopOrderByReference } from "./shop";
import { kustomConfiguration } from "./shop-payment-config";
import { equalSecret, randomToken, tokenHash } from "./security";
import { activateWellnessOrder, correctWellnessRefund } from "./wellness";
import type { ShopOrder } from "./shop-types";

const integer = z.number().int().nonnegative();
export const kustomIdentifier = z.string().regex(/^[a-zA-Z0-9-]{1,255}$/);
const identifier = kustomIdentifier;
const lineSchema = z.object({ reference: z.string(), quantity: integer, unit_price: integer, tax_rate: integer,
  total_amount: integer, total_tax_amount: integer, total_discount_amount: integer.optional() });
const checkoutSchema = z.object({ order_id: identifier, merchant_reference1: z.string(), order_amount: integer,
  purchase_currency: z.string(), order_lines: z.array(lineSchema).max(100), status: z.string() });
const managedSchema = checkoutSchema.extend({ captured_amount: integer, refunded_amount: integer,
  fraud_status: z.string(), initial_payment_method: z.object({ type: z.string() }),
  captures: z.array(z.object({ capture_id: identifier, captured_amount: integer, captured_at: z.iso.datetime({ offset: true }) })).max(100),
  refunds: z.array(z.object({ refund_id: identifier, refunded_amount: integer, refunded_at: z.string(), order_lines: z.array(lineSchema).optional() })).max(100) });
type ManagedOrder = z.infer<typeof managedSchema>;
export { checkoutSchema as kustomCheckoutSchema, managedSchema as kustomManagedOrderSchema, operationKey as kustomOperationKey };
export interface KustomClient { request(path: string, method?: string, body?: object, idempotencyKey?: string): Promise<unknown> }
export class KustomApiError extends DomainError {
  constructor(readonly status: number) { super("Kustom-anropet kunde inte verifieras. Försök med samma beställning eller kontakta verksamheten."); }
}
export const kustomClient: KustomClient = {
  async request(path, method = "GET", body, idempotencyKey) {
    const config = kustomConfiguration();
    if (!/^\/(checkout\/v3\/orders|hpp\/v1\/sessions|ordermanagement\/v1\/orders)(\/|$)/.test(path) || path.includes("..") || path.includes("?")) throw new Error("Invalid Kustom API path");
    const response = await fetch(config.base + path, { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { Authorization: config.authorization, "Content-Type": "application/json",
        ...(idempotencyKey ? { "Kustom-Idempotency-Key": idempotencyKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new KustomApiError(response.status);
    if (response.status === 204) return {};
    return response.json();
  },
};
function operationKey(seed: string, operation: string) {
  const hex = tokenHash(`${seed}:${operation}`).slice(0, 32).split(""); hex[12] = "4"; hex[16] = "8";
  const value = hex.join(""); return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}
export function kustomOrderLines(order: ShopOrder) {
  const lines = order.items.map(item => {
    const total = item.lineTotalOre ?? item.priceOre * item.quantity;
    return { type: item.isService ? "digital" : "physical", reference: `product-${item.productId}`, name: item.name,
      quantity: item.quantity, quantity_unit: item.isService ? "tillfällen" : "st", unit_price: item.priceOre,
      tax_rate: item.vatPercent * 100, total_amount: total,
      total_discount_amount: item.priceOre * item.quantity - total,
      total_tax_amount: Math.round(total * item.vatPercent / (100 + item.vatPercent)) };
  });
  if (order.shippingOre) lines.push({ type: "shipping_fee", reference: "shipping", name: order.shippingLabel || "Frakt",
    quantity: 1, quantity_unit: "st", unit_price: order.shippingOre, tax_rate: 2500,
    total_amount: order.shippingOre, total_discount_amount: 0, total_tax_amount: Math.round(order.shippingOre / 5) });
  return lines;
}
function verifyOrder(order: ShopOrder, remote: z.infer<typeof checkoutSchema>) {
  if (remote.merchant_reference1 !== order.reference || remote.order_amount !== order.totalOre || remote.purchase_currency.toUpperCase() !== "SEK") throw new Error("Kustom order mismatch");
  const expected = kustomOrderLines(order);
  if (remote.order_lines.length !== expected.length || new Set(remote.order_lines.map(line => line.reference)).size !== expected.length) throw new Error("Kustom line count mismatch");
  for (const line of expected) {
    const actual = remote.order_lines.find(item => item.reference === line.reference);
    if (!actual || actual.quantity !== line.quantity || actual.unit_price !== line.unit_price || actual.tax_rate !== line.tax_rate ||
      actual.total_amount !== line.total_amount || actual.total_tax_amount !== line.total_tax_amount) throw new Error("Kustom order line mismatch");
  }
}
export async function createKustomCheckout(reference: string, client = kustomClient) {
  const config = kustomConfiguration();
  const callbackToken = randomToken(); const captureKey = randomUUID();
  const start = await transaction(async () => {
    const order = await getShopOrderByReference(reference);
    if (!order || order.status !== "pending") throw new DomainError("Beställningen är inte öppen för betalning.");
    const existing = await getDb().prepare("SELECT * FROM kustom_checkouts WHERE order_reference=?").get(reference);
    if (existing) {
      if (existing.environment !== config.environment) throw new DomainError("Beställningen hör till en annan betalningsmiljö.");
      if (existing.redirect_url) return { order, url: `/api/kustom/redirect?ref=${reference}` };
      throw new DomainError("Beställningens betalningssession kontrolleras. Skapa inte en ny beställning; spara bekräftelselänken och kontakta verksamheten.");
    }
    await getDb().prepare("INSERT INTO kustom_checkouts(order_reference,environment,callback_hash,state,lease_until,capture_key,updated_at) VALUES(?,?,?,'creating',?,?,?)")
      .run(reference, config.environment, tokenHash(callbackToken), new Date(Date.now() + 120000).toISOString(), captureKey, new Date().toISOString());
    return { order, url: null };
  });
  if (start.url) return start.url;
  try {
    const order = start.order; const lines = kustomOrderLines(order);
    const confirmation = `${config.origin}/bestallning/bekraftelse?ref=${reference}`;
    const callback = `${config.origin}/api/kustom/push?ref=${reference}&token=${callbackToken}`;
    const [given, ...family] = order.name.trim().split(/\s+/);
    // Checkout POST has no provider idempotency support. Never repeat an
    // ambiguous create; the persisted intent quarantines it for reconciliation.
    const remote = checkoutSchema.parse(await client.request("/checkout/v3/orders", "POST", {
      purchase_country: "SE", purchase_currency: "SEK", locale: "sv-SE", merchant_reference1: reference,
      order_amount: order.totalOre, order_tax_amount: lines.reduce((sum, line) => sum + line.total_tax_amount, 0), order_lines: lines,
      billing_address: { given_name: given, family_name: family.join(" "), email: order.email, country: "SE",
        ...(order.address ? { street_address: order.address, postal_code: order.postcode, city: order.city } : {}) },
      merchant_urls: { terms: `${config.origin}/butik/villkor`, checkout: `${config.origin}/butik/kassa`, confirmation,
        push: `${callback}&order_id={checkout.order.id}` },
      options: { auto_capture: false, verify_national_identification_number: false },
    }));
    verifyOrder(order, remote);
    await getDb().prepare("UPDATE kustom_checkouts SET provider_id=?,updated_at=? WHERE order_reference=? AND provider_id IS NULL")
      .run(remote.order_id, new Date().toISOString(), reference);
    const session = z.object({ session_id: identifier, redirect_url: z.url(), expires_at: z.string().optional() }).parse(await client.request("/hpp/v1/sessions", "POST", {
      payment_session_url: `${config.base}/checkout/v3/orders/${remote.order_id}`,
      merchant_urls: { success: confirmation, back: confirmation, failure: confirmation, error: confirmation, status_update: callback },
    }));
    const url = new URL(session.redirect_url);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Unsafe provider redirect");
    await getDb().prepare("UPDATE kustom_checkouts SET redirect_url=?,state='ready',updated_at=? WHERE order_reference=?")
      .run(url.href, new Date().toISOString(), reference);
    await getDb().prepare("UPDATE shop_orders SET expires_at=? WHERE reference=?")
      .run(session.expires_at && Number.isFinite(Date.parse(session.expires_at)) ? new Date(session.expires_at).toISOString() : new Date(Date.now() + 48 * 3600000).toISOString(), reference);
    return `/api/kustom/redirect?ref=${reference}`;
  } catch {
    await getDb().prepare("UPDATE kustom_checkouts SET state='uncertain',updated_at=? WHERE order_reference=?").run(new Date().toISOString(), reference);
    throw new DomainError("Betalningssessionen kunde inte bekräftas. Beställningen finns kvar för kontroll; försök inte göra om köpet. Kontakta verksamheten med beställningsreferensen.");
  }
}
export async function validateKustomCallback(reference: string, token: string, providerId: string) {
  const record = await getDb().prepare("SELECT * FROM kustom_checkouts WHERE order_reference=?").get(reference);
  if (!record || !equalSecret(String(record.callback_hash), tokenHash(token)) || !identifier.safeParse(providerId).success)
    throw new DomainError("Callbacken kunde inte verifieras.");
  if (record.provider_id && record.provider_id !== providerId) throw new DomainError("Fel betalningsreferens.");
  return record;
}
export async function reconcileKustomOrder(reference: string, options: { client?: KustomClient; providerId?: string; capture?: boolean } = {}) {
  const client = options.client ?? kustomClient;
  const record = await getDb().prepare("SELECT * FROM kustom_checkouts WHERE order_reference=?").get(reference);
  const order = await getShopOrderByReference(reference);
  if (!record || !order) throw new DomainError("Beställningen hittades inte.");
  if (record.environment !== kustomConfiguration().environment) throw new DomainError("Fel betalningsmiljö.");
  const providerId = String(record.provider_id || options.providerId || record.candidate_id || ""); identifier.parse(providerId);
  // Order Management exists only after authorization and remains readable after
  // Checkout's 48-hour window. Never depend on a stale Checkout GET for refunds.
  let managed: ManagedOrder;
  try { managed = managedSchema.parse(await client.request(`/ordermanagement/v1/orders/${providerId}`)); }
  catch (error) { if (error instanceof KustomApiError && error.status === 404) return { status: "checkout_incomplete" }; throw error; }
  verifyOrder(order, managed);
  if (managed.order_id !== providerId || managed.fraud_status !== "ACCEPTED") {
    await getDb().prepare("UPDATE wellness_passes SET status='blocked' WHERE order_reference=?").run(reference);
    throw new DomainError("Betalningen väntar på Kustoms kontroll.");
  }
  await getDb().prepare("UPDATE kustom_checkouts SET provider_id=? WHERE order_reference=? AND provider_id IS NULL").run(providerId, reference);
  if (["CANCELLED", "EXPIRED"].includes(managed.status) && managed.captured_amount === 0) {
    await cancelShopOrder(reference);
    return { status: managed.status };
  }
  await getDb().prepare("UPDATE kustom_checkouts SET authorized=1,method=?,updated_at=? WHERE order_reference=?")
    .run(managed.initial_payment_method.type, new Date().toISOString(), reference);
  await client.request(`/ordermanagement/v1/orders/${providerId}/acknowledge`, "POST", {}, operationKey(String(record.capture_key), "acknowledge"));
  // Digital passes are delivered at capture. Physical goods require the admin
  // to capture explicitly when fulfilling, rather than charging on redirect.
  if (managed.status === "AUTHORIZED" && (options.capture || order.items.every(item => item.isService))) {
    await client.request(`/ordermanagement/v1/orders/${providerId}/captures`, "POST", {
      captured_amount: order.totalOre, order_lines: kustomOrderLines(order), reference,
    }, String(record.capture_key));
    managed = managedSchema.parse(await client.request(`/ordermanagement/v1/orders/${providerId}`));
    verifyOrder(order, managed);
    if (managed.order_id !== providerId || managed.fraud_status !== "ACCEPTED") throw new DomainError("Debiteringen behöver kontrolleras hos Kustom.");
  }
  if (managed.refunded_amount < Number(record.refunded_ore)) throw new DomainError("Betalningssvaret är äldre än en redan verifierad återbetalning. Kontrollera igen.");
  const captured = managed.captured_amount === order.totalOre && ["CAPTURED", "CLOSED"].includes(managed.status) &&
    managed.captures.reduce((sum, capture) => sum + capture.captured_amount, 0) === order.totalOre;
  if (managed.refunded_amount > 0) await reconcileRefunds(order, managed);
  const direct = ["CARD", "PAY_BY_CARD", "SWISH", "APPLE_PAY_CARD", "GOOGLE_PAY_CARD"].includes(managed.initial_payment_method.type);
  return transaction(async () => {
    await getDb().prepare("UPDATE kustom_checkouts SET captured=?,refunded_ore=?,customer_paid=CASE WHEN ? THEN 1 ELSE customer_paid END,updated_at=? WHERE order_reference=?")
      .run(captured ? 1 : 0, managed.refunded_amount, captured && direct && managed.refunded_amount === 0 ? 1 : 0, new Date().toISOString(), reference);
    if (!captured || !direct || managed.refunded_amount > 0) return { status: captured ? "captured_awaiting_customer_payment" : managed.status };
    const current = (await getShopOrderByReference(reference))!;
    if (["cancelled", "refunded"].includes(current.status) || current.paymentStatus === "refunded") throw new DomainError("En stängd beställning kan inte återaktiveras av en äldre callback.");
    const paidAt = [...managed.captures].sort((a, b) => a.captured_at.localeCompare(b.captured_at)).at(-1)!.captured_at;
    await getDb().prepare("UPDATE shop_orders SET status='paid',payment_status='paid',paid_at=? WHERE reference=? AND status='pending'").run(paidAt, reference);
    await getDb().prepare("UPDATE shop_coupon_uses SET state='paid' WHERE order_id=? AND state='reserved'").run(order.id);
    await getDb().prepare("INSERT INTO wellness_payment_evidence(order_reference,source,reference,paid_at,amount_ore,method,created_at) VALUES(?,'kustom',?,?,?,?,?) ON CONFLICT(order_reference) DO NOTHING")
      .run(reference, `kustom:${providerId}`, paidAt, order.totalOre, `Kustom ${managed.initial_payment_method.type}`, new Date().toISOString());
    await activateWellnessOrder(reference);
    const { queueShopOrderEmails } = await import("./shop-email"); await queueShopOrderEmails(order.id);
    return { status: "paid" };
  });
}
async function reconcileRefunds(order: ShopOrder, managed: ManagedOrder) {
  if (managed.refunds.reduce((sum, refund) => sum + refund.refunded_amount, 0) !== managed.refunded_amount) throw new Error("Kustom refund sum mismatch");
  for (const refund of managed.refunds) {
    const key = `kustom-refund:${refund.refund_id}`;
    if (await getDb().prepare("SELECT event_key FROM wellness_provider_events WHERE event_key=?").get(key)) continue;
    let lines = refund.order_lines;
    if ((!lines || !lines.length) && refund.refunded_amount === order.totalOre) lines = kustomOrderLines(order);
    if (!lines?.length || lines.reduce((sum, line) => sum + line.total_amount, 0) !== refund.refunded_amount) {
      await getDb().prepare("UPDATE wellness_passes SET status='blocked' WHERE order_reference=?").run(order.reference);
      throw new DomainError("Återbetalningen saknar radfördelning. Klippkorten är spärrade tills underlaget har kontrollerats.");
    }
    if (new Set(lines.map(line => line.reference)).size !== lines.length) throw new Error("Duplicate refund lines");
    const selected = lines.filter(line => /^product-\d+$/.test(line.reference)).map(line => ({ productId: Number(line.reference.slice(8)), quantity: line.quantity, amountOre: line.total_amount, taxOre: line.total_tax_amount }));
    for (const line of selected) {
      const item = order.items.find(item => item.productId === line.productId);
      if (!item || line.quantity < 1 || line.quantity > item.quantity || line.amountOre > (item.lineTotalOre ?? item.priceOre * item.quantity)) throw new Error("Invalid Kustom refund allocation");
      if (item.wellness) {
        const card = await getDb().prepare("SELECT refunded_quantity FROM wellness_passes WHERE order_reference=? AND product_id=?").get(order.reference, item.productId);
        const already = Number(card?.refunded_quantity ?? 0); const total = item.lineTotalOre ?? item.priceOre * item.quantity;
        const expected = Math.floor(total * (already + line.quantity) / item.quantity) - Math.floor(total * already / item.quantity);
        if (line.amountOre !== expected) {
          await getDb().prepare("UPDATE wellness_passes SET status='blocked' WHERE order_reference=?").run(order.reference);
          throw new DomainError("Återbetalningen motsvarar inte hela tillfällen efter rabatt. Klippkorten är spärrade för manuell kontroll.");
        }
      }
    }
    await correctWellnessRefund(order.reference, key, selected, refund.refunded_at);
  }
  if (managed.refunded_amount === order.totalOre) await getDb().prepare("UPDATE shop_orders SET status='refunded',payment_status='refunded' WHERE reference=?").run(order.reference);
}
export async function captureKustomOrder(actorId: number, reference: string) {
  await assertAdmin(actorId); return reconcileKustomOrder(reference, { capture: true });
}
export async function cancelKustomOrder(reference: string, client = kustomClient) {
  const record = await getDb().prepare("SELECT * FROM kustom_checkouts WHERE order_reference=?").get(reference);
  if (!record?.provider_id) throw new DomainError("Betalningssessionen behöver kontrolleras innan beställningen kan avbrytas.");
  const order = (await getShopOrderByReference(reference))!;
  const remote = checkoutSchema.parse(await client.request(`/checkout/v3/orders/${record.provider_id}`)); verifyOrder(order, remote);
  if (remote.status === "checkout_complete") throw new DomainError("Köpet är redan godkänt. Kontakta verksamheten för avbokning eller återbetalning.");
  await client.request(`/checkout/v3/orders/${record.provider_id}/abort`, "POST", {});
  await cancelShopOrder(reference);
}

export async function refundKustomWellness(actorId: number, input: unknown, client = kustomClient) {
  const v = z.object({ reference: z.string().regex(/^[a-f0-9]{32}$/), productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99), operationId: z.uuid(), reason: z.string().trim().min(3).max(300) }).parse(input);
  const intent = await transaction(async () => {
    await assertAdmin(actorId);
    const existing = await getDb().prepare("SELECT * FROM wellness_refunds WHERE operation_id=?").get(v.operationId);
    if (existing) {
      const previous = JSON.parse(String(existing.lines_json))[0];
      if (existing.order_reference !== v.reference || previous.productId !== v.productId || previous.quantity !== v.quantity || existing.reason !== v.reason) throw new DomainError("Återbetalningsreferensen har redan andra uppgifter.");
      return existing;
    }
    const order = await getShopOrderByReference(v.reference);
    const pass = await getDb().prepare("SELECT * FROM wellness_passes WHERE order_reference=? AND product_id=? AND status='active'").get(v.reference, v.productId);
    if (!order || order.paymentStatus !== "paid" || !pass || Number(pass.remaining) < v.quantity) throw new DomainError("Endast oanvända, ej spärrade tillfällen kan återbetalas här.");
    const item = order.items.find(item => item.productId === v.productId)!;
    const total = item.lineTotalOre ?? item.priceOre * item.quantity;
    const already = Number(pass.refunded_quantity);
    const amount = Math.floor(total * (already + v.quantity) / item.quantity) - Math.floor(total * already / item.quantity);
    const originalTax = Math.round(total * item.vatPercent / (100 + item.vatPercent));
    const taxOre = Math.floor(originalTax * (already + v.quantity) / item.quantity) - Math.floor(originalTax * already / item.quantity);
    if (amount < 1) throw new DomainError("Det finns inget betalt belopp att återbetala för dessa tillfällen.");
    const id = randomUUID(); const created = new Date().toISOString();
    await getDb().prepare("INSERT INTO wellness_refunds(id,order_reference,operation_id,actor_id,lines_json,amount_ore,status,reason,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)")
      .run(id, v.reference, v.operationId, actorId, JSON.stringify([{ productId: v.productId, quantity: v.quantity, amountOre: amount, taxOre }]), amount, v.reason, created);
    await getDb().prepare("UPDATE wellness_passes SET status='blocked' WHERE id=?").run(String(pass.id));
    return (await getDb().prepare("SELECT * FROM wellness_refunds WHERE id=?").get(id))!;
  });
  if (intent.status === "confirmed") return;
  const record = await getDb().prepare("SELECT provider_id,environment FROM kustom_checkouts WHERE order_reference=?").get(v.reference);
  if (!record?.provider_id || record.environment !== kustomConfiguration().environment) throw new DomainError("Köpet saknar en verifierbar Kustom-betalning i den valda miljön. Klippen är spärrade för kontroll.");
  const order = (await getShopOrderByReference(v.reference))!;
  const item = order.items.find(item => item.productId === v.productId)!;
  const amount = Number(intent.amount_ore);
  const remote = z.object({ refund_id: identifier }).parse(await client.request(`/ordermanagement/v1/orders/${record.provider_id}/refunds`, "POST", {
    refunded_amount: amount, reference: String(intent.id), description: "Återbetalning av oanvända friskvårdstillfällen",
    order_lines: [{ reference: `product-${v.productId}`, type: "digital", name: item.name, quantity: v.quantity,
      unit_price: item.priceOre, tax_rate: item.vatPercent * 100, total_amount: amount,
      total_discount_amount: item.priceOre * v.quantity - amount, total_tax_amount: JSON.parse(String(intent.lines_json))[0].taxOre }],
  }, String(intent.operation_id)));
  await getDb().prepare("UPDATE wellness_refunds SET provider_id=? WHERE id=?").run(remote.refund_id, String(intent.id));
  await reconcileKustomOrder(v.reference, { client });
  const applied = await getDb().prepare("SELECT event_key FROM wellness_provider_events WHERE event_key=?").get(`kustom-refund:${remote.refund_id}`);
  if (!applied) throw new DomainError("Återbetalningen inväntar verifiering. Använd samma åtgärdsreferens vid återförsök.");
  await getDb().prepare("UPDATE wellness_refunds SET status='confirmed' WHERE id=?").run(String(intent.id));
}
