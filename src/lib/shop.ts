import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DomainError, getDb, getSettings, transaction } from "./db";
import { assertAdmin } from "./admin";
import { emailSchema, slug, text } from "./validation";
import { appUrl } from "./stripe";
import type { ShopSettings, ShopProduct, ShopOrder, ShopOrderItem, ShopQuote, ShopQuoteInput } from "./shop-types";
import { calculateShopQuote, loadShopProducts, publiclyAvailable } from "./shop-commerce";
export { getAdminShopQuantityOffers, saveShopQuantityOffer, getAdminShopCoupons, saveShopCoupon, getAdminShopShippingRules, saveShopShippingRule, getPublicShopOffers, shopQuoteSchema } from "./shop-commerce";

type Row = Record<string, unknown>;
const settingsSchema = z.object({
  enabled: z.boolean(), shippingEnabled: z.boolean(), pickupEnabled: z.boolean(),
  shippingPriceOre: z.number().int().min(0).max(1000000),
  freeShippingThresholdOre: z.number().int().min(0).max(100000000).nullable(),
  pickupAddress: text(1000), pickupInstructions: text(5000), terms: text(20000),
  shippingRuleMode: z.boolean().optional().default(false), packingWeightGrams: z.number().int().min(0).max(1000000).optional().default(0),
});
const productSchema = z.object({
  name: text(150, 2), slug: text(100), description: text(20000),
  priceOre: z.number().int().min(1).max(10000000), vatPercent: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(25)]),
  stock: z.number().int().min(0).max(1000000), published: z.boolean(), imageId: z.uuid().nullable(),
  expectedUpdatedAt: z.iso.datetime().optional(),
  kind: z.enum(["product", "bundle"]).optional().default("product"), weightGrams: z.number().int().min(0).max(100000000).optional().default(0),
  bundleItems: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).max(20).optional().default([]),
});
export const shopCheckoutSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).min(1).max(20),
  name: text(100, 2), email: emailSchema, phone: text(30), delivery: z.enum(["shipping", "pickup"]),
  address: text(200).default(""), postcode: text(10).default(""), city: text(100).default(""), consent: z.literal(true),
  couponCode: text(50).optional().default(""), expectedQuote: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).superRefine((value, context) => {
  if (new Set(value.items.map((line) => line.productId)).size !== value.items.length)
    context.addIssue({ code: "custom", path: ["items"], message: "Varje produkt får bara finnas en gång i varukorgen." });
  if (value.delivery === "shipping") {
    if (value.address.length < 3) context.addIssue({ code: "custom", path: ["address"], message: "Ange en leveransadress." });
    if (!/^\d{3}\s?\d{2}$/.test(value.postcode)) context.addIssue({ code: "custom", path: ["postcode"], message: "Ange ett svenskt postnummer." });
    if (value.city.length < 2) context.addIssue({ code: "custom", path: ["city"], message: "Ange en ort i Sverige." });
  }
});
export type ShopCheckoutInput = z.input<typeof shopCheckoutSchema>;
function order(row: Row): ShopOrder {
  const items = (JSON.parse(String(row.items_json)) as ShopOrderItem[]).map((i) => ({ ...i, lineTotalOre: i.lineTotalOre ?? i.priceOre * i.quantity, originalLineTotalOre: i.originalLineTotalOre ?? i.priceOre * i.quantity }));
  return { id: Number(row.id), reference: String(row.reference), name: String(row.name), email: String(row.email), phone: String(row.phone), delivery: row.delivery as ShopOrder["delivery"], address: String(row.address), postcode: String(row.postcode), city: String(row.city), subtotalOre: Number(row.subtotal_ore), shippingOre: Number(row.shipping_ore), totalOre: Number(row.total_ore), status: row.status as ShopOrder["status"], paymentStatus: row.payment_status as ShopOrder["paymentStatus"], fulfillment: row.fulfillment as ShopOrder["fulfillment"], trackingNumber: String(row.tracking_number), checkoutSessionId: row.checkout_session_id ? String(row.checkout_session_id) : null, expiresAt: String(row.expires_at), createdAt: String(row.created_at), items, pickupAddress: String(row.pickup_address), pickupInstructions: String(row.pickup_instructions), terms: String(row.terms), originalSubtotalOre: row.original_subtotal_ore == null ? Number(row.subtotal_ore) : Number(row.original_subtotal_ore), discountOre: Number(row.discount_ore ?? 0), discounts: JSON.parse(String(row.discounts_json ?? "[]")), weightGrams: row.weight_grams == null ? null : Number(row.weight_grams), shippingLabel: String(row.shipping_label || (row.delivery === "shipping" ? "Frakt inom Sverige" : "Hämtning")), couponCode: row.coupon_code ? String(row.coupon_code) : null };
}
export function shopStripeReady(): boolean {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.SHOP_STRIPE_WEBHOOK_SECRET) return false;
  try { appUrl(); return true; } catch { return false; }
}
async function assertReady(settings: ShopSettings) {
  if (!shopStripeReady()) throw new DomainError("Butiken kräver Stripe, SHOP_STRIPE_WEBHOOK_SECRET och en giltig APP_URL.");
  if (!z.email().safeParse((await getSettings()).email).success) throw new DomainError("Fyll i en fungerande kontaktadress i webbplatsens inställningar innan butiken aktiveras.");
  if (settings.terms.length < 20) throw new DomainError("Fyll i butikens köp- och returvillkor innan du aktiverar den.");
  if (!settings.shippingEnabled && !settings.pickupEnabled) throw new DomainError("Välj frakt eller hämtning för butiken.");
  if (settings.pickupEnabled && settings.pickupAddress.length < 5) throw new DomainError("Ange en riktig hämtningsadress innan du aktiverar hämtning.");
}
export async function getShopSettings(): Promise<ShopSettings> {
  const row = (await getDb().prepare("SELECT * FROM shop_settings WHERE id=1").get())!;
  return { enabled: !!row.enabled, shippingEnabled: !!row.shipping_enabled, pickupEnabled: !!row.pickup_enabled, shippingPriceOre: Number(row.shipping_price_ore), freeShippingThresholdOre: row.free_shipping_threshold_ore == null ? null : Number(row.free_shipping_threshold_ore), pickupAddress: String(row.pickup_address), pickupInstructions: String(row.pickup_instructions), terms: String(row.terms), shippingRuleMode: !!row.shipping_rule_mode, packingWeightGrams: Number(row.packing_weight_grams) };
}
export async function saveShopSettings(actorId: number, input: ShopSettings): Promise<ShopSettings> {
  return transaction(async () => {
    await assertAdmin(actorId);
    const value = settingsSchema.parse(input);
    if (value.enabled) await assertReady(value);
    await getDb().prepare("UPDATE shop_settings SET enabled=?,shipping_enabled=?,pickup_enabled=?,shipping_price_ore=?,free_shipping_threshold_ore=?,pickup_address=?,pickup_instructions=?,terms=?,shipping_rule_mode=?,packing_weight_grams=? WHERE id=1")
      .run(value.enabled ? 1 : 0, value.shippingEnabled ? 1 : 0, value.pickupEnabled ? 1 : 0, value.shippingPriceOre, value.freeShippingThresholdOre, value.pickupAddress, value.pickupInstructions, value.terms, value.shippingRuleMode ? 1 : 0, value.packingWeightGrams);
    return value;
  });
}
export async function getPublicShopProducts(): Promise<ShopProduct[]> {
  if (!(await getShopSettings()).enabled) return [];
  await expireShopOrders();
  const products = await loadShopProducts(), byId = new Map(products.map((p) => [p.id, p]));
  if (!(await getShopSettings()).enabled) return [];
  return products.filter((p) => publiclyAvailable(p, byId));
}
export async function getPublicShopProduct(slugValue: string): Promise<ShopProduct | undefined> {
  if (!(await getShopSettings()).enabled) return undefined;
  await expireShopOrders();
  return (await getPublicShopProducts()).find((p) => p.slug === slugValue);
}
export async function getAdminShopProducts(actorId: number): Promise<ShopProduct[]> {
  await assertAdmin(actorId); await expireShopOrders();
  return loadShopProducts();
}
export async function getAdminShopProduct(actorId: number, id: number): Promise<ShopProduct | undefined> {
  await assertAdmin(actorId); await expireShopOrders();
  return (await loadShopProducts()).find((p) => p.id === id);
}
export async function saveShopProduct(actorId: number, id: number | null, input: Omit<ShopProduct, "id" | "createdAt" | "updatedAt"> & { expectedUpdatedAt?: string }): Promise<number> {
  return transaction(async () => {
    await assertAdmin(actorId);
    await expireShopOrders();
    const value = productSchema.parse(input);
    if (value.kind === "bundle") {
      if (!value.bundleItems.length) throw new DomainError("Välj minst en produkt som ingår i paketet.");
      if (new Set(value.bundleItems.map(item => item.productId)).size !== value.bundleItems.length) throw new DomainError("Välj varje produkt bara en gång i paketet.");
      for (const part of value.bundleItems) {
        const component = await getDb().prepare("SELECT kind,vat_percent,published FROM shop_products WHERE id=?").get(part.productId);
        if (part.productId === id || !component || component.kind !== "product") throw new DomainError("Paket kan bara innehålla andra vanliga produkter.");
        if (Number(component.vat_percent) !== value.vatPercent) throw new DomainError("Alla produkter i paketet ska ha samma momssats som paketet.");
        if (value.published && !component.published) throw new DomainError("Publicera paketets ingående produkter först, eller spara paketet som utkast.");
      }
    } else if (value.bundleItems.length) throw new DomainError("En vanlig produkt kan inte ha paketinnehåll.");
    const path = slug(value.slug, value.name);
    if (["varukorg", "kassa", "villkor"].includes(path)) throw new DomainError("Den webbadressen används av butiken. Välj en annan produktadress.");
    if (value.imageId && !(await getDb().prepare("SELECT id FROM shop_images WHERE id=?").get(value.imageId))) throw new DomainError("Välj en uppladdad produktbild.");
    const duplicate = await getDb().prepare("SELECT id FROM shop_products WHERE slug=? AND id!=?").get(path, id ?? -1);
    if (duplicate) throw new DomainError("En annan produkt använder redan den webbadressen.");
    let now = new Date().toISOString();
    if (id !== null) {
      z.number().int().positive().parse(id);
      const current = await getDb().prepare("SELECT updated_at,kind FROM shop_products WHERE id=?").get(id);
      if (!current) throw new DomainError("Produkten finns inte.");
      if (current.kind !== value.kind) throw new DomainError("Produkttypen kan inte ändras efter att produkten skapats. Skapa en ny produkt eller ett nytt paket.");
      if (!value.expectedUpdatedAt || value.expectedUpdatedAt !== current.updated_at) throw new DomainError("Produkten eller lagret har ändrats sedan du öppnade formuläret. Ladda om produkten innan du sparar igen.");
      now = new Date(Math.max(Date.now(), Date.parse(String(current.updated_at)) + 1)).toISOString();
      await getDb().prepare("UPDATE shop_products SET name=?,slug=?,description=?,price_ore=?,vat_percent=?,stock=?,published=?,image_id=?,updated_at=?,weight_grams=? WHERE id=?")
        .run(value.name, path, value.description, value.priceOre, value.vatPercent, value.kind === "bundle" ? 0 : value.stock, value.published ? 1 : 0, value.imageId, now, value.kind === "bundle" ? 0 : value.weightGrams, id);
      await getDb().prepare("DELETE FROM shop_bundle_items WHERE bundle_id=?").run(id);
      for (const part of value.bundleItems) await getDb().prepare("INSERT INTO shop_bundle_items(bundle_id,product_id,quantity) VALUES(?,?,?)").run(id,part.productId,part.quantity);
      return id;
    }
    const result = await getDb().prepare("INSERT INTO shop_products(name,slug,description,price_ore,vat_percent,stock,published,image_id,created_at,updated_at,kind,weight_grams) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(value.name, path, value.description, value.priceOre, value.vatPercent, value.kind === "bundle" ? 0 : value.stock, value.published ? 1 : 0, value.imageId, now, now,value.kind,value.kind === "bundle" ? 0 : value.weightGrams);
    const productId = Number(result.lastInsertRowid);
    for (const part of value.bundleItems) await getDb().prepare("INSERT INTO shop_bundle_items(bundle_id,product_id,quantity) VALUES(?,?,?)").run(productId,part.productId,part.quantity);
    return productId;
  });
}
export async function getShopOrderById(id: number): Promise<ShopOrder | undefined> {
  const row = await getDb().prepare("SELECT * FROM shop_orders WHERE id=?").get(id);
  return row ? order(row) : undefined;
}
export async function getShopOrderByReference(reference: string): Promise<ShopOrder | undefined> {
  if (!/^[a-f0-9]{32}$/.test(reference)) return undefined;
  await expireShopOrders();
  const row = await getDb().prepare("SELECT * FROM shop_orders WHERE reference=?").get(reference);
  return row ? order(row) : undefined;
}
export async function getShopOrders(actorId: number): Promise<ShopOrder[]> {
  await assertAdmin(actorId); await expireShopOrders();
  return (await getDb().prepare("SELECT * FROM shop_orders ORDER BY created_at DESC,id DESC").all()).map(order);
}
export async function getAdminShopOrder(actorId: number, id: number): Promise<ShopOrder | undefined> {
  await assertAdmin(actorId); await expireShopOrders();
  return getShopOrderById(id);
}
export async function updateShopFulfillment(actorId: number, id: number, input: { fulfillment: ShopOrder["fulfillment"]; trackingNumber: string }): Promise<void> {
  await transaction(async () => {
    await assertAdmin(actorId);
    const value = z.object({ fulfillment: z.enum(["unfulfilled", "ready", "shipped", "collected"]), trackingNumber: text(100) }).parse(input);
    const current = await getShopOrderById(id);
    if (!current || current.status !== "paid") throw new DomainError("Endast betalda beställningar kan lämnas ut eller skickas.");
    if (current.delivery === "shipping" && !["unfulfilled", "shipped"].includes(value.fulfillment)) throw new DomainError("En fraktbeställning ska markeras som skickad.");
    if (current.delivery === "pickup" && value.fulfillment === "shipped") throw new DomainError("En hämtningsbeställning ska markeras som klar eller hämtad.");
    await getDb().prepare("UPDATE shop_orders SET fulfillment=?,tracking_number=? WHERE id=?").run(value.fulfillment, current.delivery === "shipping" ? value.trackingNumber : "", id);
  });
}
async function releaseInventory(row: Row): Promise<void> {
  if (row.inventory_released) return;
  const stored = JSON.parse(String(row.inventory_json ?? "[]")) as {productId:number;quantity:number}[];
  const inventory = stored.length ? stored : JSON.parse(String(row.items_json)) as ShopOrderItem[];
  for (const item of inventory) {
    const current = await getDb().prepare("SELECT updated_at FROM shop_products WHERE id=?").get(item.productId);
    if (current) await getDb().prepare("UPDATE shop_products SET stock=stock+?,updated_at=? WHERE id=?")
      .run(item.quantity, new Date(Math.max(Date.now(), Date.parse(String(current.updated_at)) + 1)).toISOString(), item.productId);
  }
  await getDb().prepare("UPDATE shop_orders SET inventory_released=1 WHERE id=?").run(Number(row.id));
  await getDb().prepare("UPDATE shop_coupon_uses SET state='released' WHERE order_id=? AND state='reserved'").run(Number(row.id));
}
export async function expireShopOrders(): Promise<void> {
  // Most reads need no write lock; a second check under the lock handles races.
  const now = new Date().toISOString();
  if (!(await getDb().prepare("SELECT id FROM shop_orders WHERE status='pending' AND expires_at<=? LIMIT 1").get(now))) return;
  await transaction(async () => {
    const rows = await getDb().prepare("SELECT * FROM shop_orders WHERE status='pending' AND expires_at<=?").all(new Date().toISOString());
    for (const row of rows) {
      await releaseInventory(row);
      await getDb().prepare("UPDATE shop_orders SET status='cancelled' WHERE id=?").run(Number(row.id));
    }
  });
}
export async function reserveShopOrder(input: unknown): Promise<ShopOrder> {
  const value = shopCheckoutSchema.parse(input);
  return transaction(async () => {
    await expireShopOrders();
    const settings = await getShopSettings();
    if (!settings.enabled) throw new DomainError("Butiken tar inte emot nya beställningar just nu.");
    await assertReady(settings);
    const {quote,inventory,couponId} = await calculateShopQuote(value,settings);
    if (value.expectedQuote && value.expectedQuote !== quote.fingerprint) throw new DomainError("Priset, erbjudandet eller leveransen har ändrats. Beräkna priset igen och granska beställningen innan du fortsätter.");
    for (const item of inventory) {
      const current = (await getDb().prepare("SELECT updated_at FROM shop_products WHERE id=?").get(item.productId))!;
      await getDb().prepare("UPDATE shop_products SET stock=stock-?,updated_at=? WHERE id=?")
        .run(item.quantity, new Date(Math.max(Date.now(), Date.parse(String(current.updated_at)) + 1)).toISOString(), item.productId);
    }
    const now = new Date().toISOString();
    const result = await getDb().prepare("INSERT INTO shop_orders(reference,name,email,phone,delivery,address,postcode,city,subtotal_ore,shipping_ore,total_ore,expires_at,created_at,items_json,pickup_address,pickup_instructions,terms,inventory_json,original_subtotal_ore,discount_ore,discounts_json,weight_grams,shipping_label,coupon_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(randomBytes(16).toString("hex"), value.name, value.email, value.phone, value.delivery, value.delivery === "shipping" ? value.address : "", value.delivery === "shipping" ? value.postcode.replace(/\s/g, "") : "", value.delivery === "shipping" ? value.city : "", quote.subtotalOre, quote.shippingOre, quote.totalOre, new Date(Date.now() + 30 * 60000).toISOString(), now, JSON.stringify(quote.items), value.delivery === "pickup" ? settings.pickupAddress : "", value.delivery === "pickup" ? settings.pickupInstructions : "", settings.terms,JSON.stringify(inventory),quote.originalSubtotalOre,quote.discountOre,JSON.stringify(quote.discounts),quote.weightGrams,quote.shippingLabel,quote.couponCode);
    const orderId = Number(result.lastInsertRowid);
    if(couponId !== null) await getDb().prepare("INSERT INTO shop_coupon_uses(order_id,coupon_id,state) VALUES(?,?,'reserved')").run(orderId,couponId);
    return (await getShopOrderById(orderId))!;
  });
}
export async function quoteShopCart(input: ShopQuoteInput): Promise<ShopQuote> {
  await expireShopOrders();
  return (await calculateShopQuote(input,await getShopSettings())).quote;
}
export async function attachShopCheckout(reference: string, sessionId: string, expiresAt: number): Promise<void> {
  await transaction(async () => {
    await expireShopOrders();
    const row = await getDb().prepare("SELECT * FROM shop_orders WHERE reference=?").get(reference);
    if (!row || row.status !== "pending" || row.inventory_released || row.payment_status !== "pending") throw new DomainError("Lagerreservationen har gått ut. Skapa en ny beställning.");
    if (row.checkout_session_id && row.checkout_session_id !== sessionId) throw new DomainError("Beställningen har redan en betalningssession.");
    if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= Date.now() || expiresAt * 1000 > Date.now() + 35 * 60000) throw new DomainError("Betalningssessionens giltighetstid är fel.");
    await getDb().prepare("UPDATE shop_orders SET checkout_session_id=?,expires_at=? WHERE id=?").run(sessionId, new Date(expiresAt * 1000).toISOString(), Number(row.id));
  });
}
export async function cancelShopOrder(reference: string): Promise<void> {
  if (!/^[a-f0-9]{32}$/.test(reference)) throw new DomainError("Beställningslänken är ogiltig.");
  await transaction(async () => {
    const row = await getDb().prepare("SELECT * FROM shop_orders WHERE reference=?").get(reference);
    if (!row || row.status !== "pending") return;
    await releaseInventory(row);
    await getDb().prepare("UPDATE shop_orders SET status='cancelled' WHERE id=?").run(Number(row.id));
  });
}
export async function expireShopCheckout(sessionId: string): Promise<void> {
  const row = await getDb().prepare("SELECT reference FROM shop_orders WHERE checkout_session_id=?").get(sessionId);
  if (row) await cancelShopOrder(String(row.reference));
}
export type ShopPaymentOutcome = "paid" | "already-paid" | "needs-refund" | "already-refunded";
export async function completeShopPayment(sessionId: string, amountOre: number, currency: string, reference?: string): Promise<ShopPaymentOutcome> {
  return transaction(async () => {
    await expireShopOrders();
    let row = await getDb().prepare("SELECT * FROM shop_orders WHERE checkout_session_id=?").get(sessionId);
    if (!row && reference && /^[a-f0-9]{32}$/.test(reference))
      row = await getDb().prepare("SELECT * FROM shop_orders WHERE reference=? AND checkout_session_id IS NULL").get(reference);
    if (!row) throw new Error("Shop checkout is not attached yet");
    if (!Number.isSafeInteger(amountOre) || amountOre !== Number(row.total_ore) || currency.toLowerCase() !== "sek") throw new Error("Shop payment does not match the order");
    // Only a signed shop webhook calls this fallback. An uncertain checkout
    // response cannot orphan a payment; a closed reservation is refunded below.
    if (!row.checkout_session_id) await getDb().prepare("UPDATE shop_orders SET checkout_session_id=? WHERE id=?").run(sessionId, Number(row.id));
    if (row.payment_status === "refunded") return "already-refunded";
    if (row.payment_status === "paid" && row.status === "paid") {
      const { queueShopOrderEmails } = await import("./shop-email");
      await queueShopOrderEmails(Number(row.id));
      return "already-paid";
    }
    if (row.status !== "pending" || row.inventory_released) {
      await getDb().prepare("UPDATE shop_orders SET payment_status='refund_pending' WHERE id=?").run(Number(row.id));
      return "needs-refund";
    }
    await getDb().prepare("UPDATE shop_orders SET status='paid',payment_status='paid',paid_at=? WHERE id=?").run(new Date().toISOString(), Number(row.id));
    await getDb().prepare("UPDATE shop_coupon_uses SET state='paid' WHERE order_id=? AND state='reserved'").run(Number(row.id));
    const { queueShopOrderEmails } = await import("./shop-email");
    await queueShopOrderEmails(Number(row.id));
    return "paid";
  });
}
export async function refundShopPayment(sessionId: string, evidence?: { reference: string; amountOre: number; currency: string }): Promise<void> {
  await transaction(async () => {
    let row = await getDb().prepare("SELECT * FROM shop_orders WHERE checkout_session_id=?").get(sessionId);
    if (evidence) {
      if (!/^[a-f0-9]{32}$/.test(evidence.reference)) throw new Error("Shop refund has no valid order reference");
      if (!row) row = await getDb().prepare("SELECT * FROM shop_orders WHERE reference=? AND checkout_session_id IS NULL").get(evidence.reference);
      if (!row) throw new Error("Shop refunded checkout is not attached yet");
      if (row.reference !== evidence.reference || !Number.isSafeInteger(evidence.amountOre) || evidence.amountOre !== Number(row.total_ore) || evidence.currency.toLowerCase() !== "sek")
        throw new Error("Shop refunded session does not match the order");
      // Stripe can report a completed refund before an uncertain creation
      // response binds its session. Persist that verified outcome first so a
      // later completed event cannot invent a paid order or refund twice.
      if (!row.checkout_session_id) await getDb().prepare("UPDATE shop_orders SET checkout_session_id=? WHERE id=?").run(sessionId, Number(row.id));
    }
    if (!row) return;
    // A refund does not prove that dispatched goods were returned. Available
    // inventory changes only when releasing an unpaid reservation, once.
    if (row.status === "pending") await releaseInventory(row);
    await getDb().prepare("UPDATE shop_orders SET status='refunded',payment_status='refunded' WHERE id=?").run(Number(row.id));
  });
}
