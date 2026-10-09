import { createHash } from "node:crypto";
import { z } from "zod";
import { assertAdmin } from "./admin";
import { DomainError, getDb, transaction } from "./db";
import { text } from "./validation";
import { parseProductRichText } from "./product-rich-text";
import type { ShopCoupon, ShopDiscount, ShopProduct, ShopQuantityOffer, ShopQuote, ShopQuoteInput, ShopQuoteItem, ShopSettings, ShopShippingRule } from "./shop-types";

type Row = Record<string, unknown>;
type InventoryLine = { productId: number; quantity: number };
const idSchema = z.number().int().positive();
const money = z.number().int().min(0).max(100000000);
const weight = z.number().int().min(0).max(100000000);
const selectedIds = z.array(idSchema).max(20).refine((ids) => new Set(ids).size === ids.length, "Välj varje produkt bara en gång.");
const quantityOfferSchema = z.object({ name: text(150, 2), scope: z.enum(["per_product", "mixed"]), productIds: selectedIds, minQuantity: z.number().int().min(2).max(10000), percent: z.number().int().min(1).max(99), active: z.boolean() });
const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,49}$/), name: text(150, 2), type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1).max(10000000), minSubtotalOre: money, active: z.boolean(),
  startsAt: z.iso.datetime().nullable(), endsAt: z.iso.datetime().nullable(), maxUses: z.number().int().min(1).max(1000000).nullable(), combineWithOffers: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.type === "percent" && v.value > 99) ctx.addIssue({ code: "custom", path: ["value"], message: "Procentrabatten får vara 1–99 procent." });
  if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Sluttiden ska ligga efter starttiden." });
});
const shippingRuleSchema = z.object({
  name: text(150, 2), carrier: text(100), service: text(100), active: z.boolean(), priority: z.number().int().min(0).max(1000000),
  minWeightGrams: weight, maxWeightGrams: weight.nullable(), minSubtotalOre: money, maxSubtotalOre: money.nullable(),
  postcodePrefixes: z.array(z.string().trim().regex(/^\d{1,5}$/)).max(100).refine((ids) => new Set(ids).size === ids.length, "Välj varje postnummerprefix bara en gång."),
  priceOre: z.number().int().min(0).max(1000000),
}).superRefine((v, ctx) => {
  if (v.maxWeightGrams !== null && v.maxWeightGrams < v.minWeightGrams) ctx.addIssue({ code: "custom", path: ["maxWeightGrams"], message: "Maxvikten får inte vara lägre än minvikten." });
  if (v.maxSubtotalOre !== null && v.maxSubtotalOre < v.minSubtotalOre) ctx.addIssue({ code: "custom", path: ["maxSubtotalOre"], message: "Maxbeloppet får inte vara lägre än minbeloppet." });
});
export const shopQuoteSchema = z.object({
  items: z.array(z.object({ productId: idSchema, quantity: z.number().int().min(1).max(99) })).min(1).max(20),
  delivery: z.enum(["shipping", "pickup"]), postcode: text(10).default(""), couponCode: text(50).default(""),
}).superRefine((v, ctx) => {
  if (new Set(v.items.map((line) => line.productId)).size !== v.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Varje produkt får bara finnas en gång i varukorgen." });
});
function offer(row: Row): ShopQuantityOffer { return { id: Number(row.id), name: String(row.name), scope: row.scope as ShopQuantityOffer["scope"], productIds: JSON.parse(String(row.product_ids_json)), minQuantity: Number(row.min_quantity), percent: Number(row.percent), active: !!row.active }; }
function coupon(row: Row): ShopCoupon { return { id: Number(row.id), code: String(row.code), name: String(row.name), type: row.type as ShopCoupon["type"], value: Number(row.value), minSubtotalOre: Number(row.min_subtotal_ore), active: !!row.active, startsAt: row.starts_at ? String(row.starts_at) : null, endsAt: row.ends_at ? String(row.ends_at) : null, maxUses: row.max_uses == null ? null : Number(row.max_uses), combineWithOffers: !!row.combine_with_offers, uses: Number(row.uses ?? 0) }; }
function rule(row: Row): ShopShippingRule { return { id: Number(row.id), name: String(row.name), carrier: String(row.carrier), service: String(row.service), active: !!row.active, priority: Number(row.priority), minWeightGrams: Number(row.min_weight_grams), maxWeightGrams: row.max_weight_grams == null ? null : Number(row.max_weight_grams), minSubtotalOre: Number(row.min_subtotal_ore), maxSubtotalOre: row.max_subtotal_ore == null ? null : Number(row.max_subtotal_ore), postcodePrefixes: JSON.parse(String(row.postcode_prefixes_json)), priceOre: Number(row.price_ore) }; }
const usageSql = `(SELECT COUNT(*) FROM shop_coupon_uses u JOIN shop_orders o ON o.id=u.order_id WHERE u.coupon_id=c.id AND (u.state='paid' OR (u.state='reserved' AND o.status='pending' AND o.expires_at>?)))`;
export async function getAdminShopQuantityOffers(actorId: number): Promise<ShopQuantityOffer[]> { await assertAdmin(actorId); return (await getDb().prepare("SELECT * FROM shop_quantity_offers ORDER BY id").all()).map(offer); }
export async function saveShopQuantityOffer(actorId: number, id: number | null, input: Omit<ShopQuantityOffer, "id">): Promise<number> {
  return transaction(async () => {
    await assertAdmin(actorId); const v = quantityOfferSchema.parse(input);
    for (const productId of v.productIds) if (!(await getDb().prepare("SELECT id FROM shop_products WHERE id=? AND kind='product'").get(productId))) throw new DomainError("Mängdrabatter kan endast kopplas till vanliga produkter.");
    if (id !== null) { idSchema.parse(id); if (!(await getDb().prepare("SELECT id FROM shop_quantity_offers WHERE id=?").get(id))) throw new DomainError("Mängdrabatten finns inte."); }
    const args = [v.name, v.scope, JSON.stringify(v.productIds), v.minQuantity, v.percent, v.active ? 1 : 0];
    const result = id === null ? await getDb().prepare("INSERT INTO shop_quantity_offers(name,scope,product_ids_json,min_quantity,percent,active) VALUES(?,?,?,?,?,?)").run(...args) : await getDb().prepare("UPDATE shop_quantity_offers SET name=?,scope=?,product_ids_json=?,min_quantity=?,percent=?,active=? WHERE id=?").run(...args, id);
    return id ?? Number(result.lastInsertRowid);
  });
}
export async function getAdminShopCoupons(actorId: number): Promise<ShopCoupon[]> { await assertAdmin(actorId); return (await getDb().prepare(`SELECT c.*,${usageSql} uses FROM shop_coupons c ORDER BY id`).all(new Date().toISOString())).map(coupon); }
export async function saveShopCoupon(actorId: number, id: number | null, input: Omit<ShopCoupon, "id" | "uses">): Promise<number> {
  return transaction(async () => {
    await assertAdmin(actorId); const v = couponSchema.parse(input);
    if (id !== null) { idSchema.parse(id); if (!(await getDb().prepare("SELECT id FROM shop_coupons WHERE id=?").get(id))) throw new DomainError("Rabattkoden finns inte."); }
    if (await getDb().prepare("SELECT id FROM shop_coupons WHERE code=? AND id!=?").get(v.code, id ?? -1)) throw new DomainError("Rabattkoden används redan.");
    const args = [v.code, v.name, v.type, v.value, v.minSubtotalOre, v.active ? 1 : 0, v.startsAt, v.endsAt, v.maxUses, v.combineWithOffers ? 1 : 0];
    const result = id === null ? await getDb().prepare("INSERT INTO shop_coupons(code,name,type,value,min_subtotal_ore,active,starts_at,ends_at,max_uses,combine_with_offers) VALUES(?,?,?,?,?,?,?,?,?,?)").run(...args) : await getDb().prepare("UPDATE shop_coupons SET code=?,name=?,type=?,value=?,min_subtotal_ore=?,active=?,starts_at=?,ends_at=?,max_uses=?,combine_with_offers=? WHERE id=?").run(...args, id);
    return id ?? Number(result.lastInsertRowid);
  });
}
export async function getAdminShopShippingRules(actorId: number): Promise<ShopShippingRule[]> { await assertAdmin(actorId); return (await getDb().prepare("SELECT * FROM shop_shipping_rules ORDER BY priority,price_ore,id").all()).map(rule); }
export async function saveShopShippingRule(actorId: number, id: number | null, input: Omit<ShopShippingRule, "id">): Promise<number> {
  return transaction(async () => {
    await assertAdmin(actorId); const v = shippingRuleSchema.parse(input);
    if (id !== null) { idSchema.parse(id); if (!(await getDb().prepare("SELECT id FROM shop_shipping_rules WHERE id=?").get(id))) throw new DomainError("Fraktregeln finns inte."); }
    const args = [v.name, v.carrier, v.service, v.active ? 1 : 0, v.priority, v.minWeightGrams, v.maxWeightGrams, v.minSubtotalOre, v.maxSubtotalOre, JSON.stringify(v.postcodePrefixes), v.priceOre];
    const result = id === null ? await getDb().prepare("INSERT INTO shop_shipping_rules(name,carrier,service,active,priority,min_weight_grams,max_weight_grams,min_subtotal_ore,max_subtotal_ore,postcode_prefixes_json,price_ore) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(...args) : await getDb().prepare("UPDATE shop_shipping_rules SET name=?,carrier=?,service=?,active=?,priority=?,min_weight_grams=?,max_weight_grams=?,min_subtotal_ore=?,max_subtotal_ore=?,postcode_prefixes_json=?,price_ore=? WHERE id=?").run(...args, id);
    return id ?? Number(result.lastInsertRowid);
  });
}

export async function loadShopProducts(): Promise<ShopProduct[]> {
  const [rows, parts] = await Promise.all([getDb().prepare("SELECT * FROM shop_products ORDER BY name,id").all(), getDb().prepare("SELECT * FROM shop_bundle_items ORDER BY bundle_id,product_id").all()]);
  const products: ShopProduct[] = rows.map((r) => ({ id: Number(r.id), name: String(r.name), slug: String(r.slug), description: String(r.description), richDescription: parseProductRichText(r.rich_description_json), priceOre: Number(r.price_ore), vatPercent: Number(r.vat_percent), stock: Number(r.stock), published: !!r.published, imageId: r.image_id ? String(r.image_id) : null, createdAt: String(r.created_at), updatedAt: String(r.updated_at), kind: r.kind as "product" | "bundle", weightGrams: Number(r.weight_grams), bundleItems: [], bundleOriginalPriceOre: null }));
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const p of products.filter((p) => p.kind === "bundle")) {
    p.bundleItems = parts.filter((r) => Number(r.bundle_id) === p.id).map((r) => ({ productId: Number(r.product_id), quantity: Number(r.quantity) }));
    const children = p.bundleItems.map((part) => ({ part, child: byId.get(part.productId) }));
    if (!children.length || children.some(({ child }) => !child || child.kind !== "product")) { p.stock = 0; p.weightGrams = 0; continue; }
    p.stock = Math.min(...children.map(({ part, child }) => Math.floor(child!.stock / part.quantity)));
    p.weightGrams = children.some(({ child }) => !child!.weightGrams) ? 0 : children.reduce((sum, { part, child }) => sum + child!.weightGrams! * part.quantity, 0);
    p.bundleOriginalPriceOre = children.reduce((sum, { part, child }) => sum + child!.priceOre * part.quantity, 0);
  }
  return products;
}
export function publiclyAvailable(p: ShopProduct, products: Map<number, ShopProduct>): boolean {
  return p.published && (p.kind !== "bundle" || (!!p.bundleItems?.length && p.bundleItems.every((part) => { const child = products.get(part.productId); return !!child?.published && child.kind === "product" && child.vatPercent === p.vatPercent; })));
}
export async function getPublicShopOffers(): Promise<ShopQuantityOffer[]> {
  if (!(await getDb().prepare("SELECT id FROM shop_settings WHERE enabled=1").get())) return [];
  const visible = new Set((await loadShopProducts()).filter((p) => p.published && p.kind === "product").map((p) => p.id));
  return (await getDb().prepare("SELECT * FROM shop_quantity_offers WHERE active=1 ORDER BY min_quantity,percent,id").all()).map(offer).flatMap((o) => {
    if (!o.productIds.length) return [o];
    const ids = o.productIds.filter((id) => visible.has(id));
    return ids.length ? [{ ...o, productIds: ids }] : [];
  });
}
function allocate(total: number, amounts: number[]): number[] {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (!sum || !total) return amounts.map(() => 0);
  const divisor = BigInt(sum);
  const shares = amounts.map((amount, index) => {
    const numerator = BigInt(total) * BigInt(amount);
    return { index, value: Number(numerator / divisor), remainder: numerator % divisor };
  });
  let remaining = total - shares.reduce((s, p) => s + p.value, 0);
  for (const share of [...shares].sort((a, b) => a.remainder === b.remainder ? a.index-b.index : a.remainder > b.remainder ? -1 : 1)) { if (!remaining) break; share.value++; remaining--; }
  return shares.sort((a, b) => a.index - b.index).map((p) => p.value);
}
export async function calculateShopQuote(input: ShopQuoteInput, settings: ShopSettings): Promise<{ quote: ShopQuote; inventory: InventoryLine[]; couponId: number | null }> {
  const v = shopQuoteSchema.parse(input);
  if (!settings.enabled) throw new DomainError("Butiken tar inte emot nya beställningar just nu.");
  if ((v.delivery === "shipping" && !settings.shippingEnabled) || (v.delivery === "pickup" && !settings.pickupEnabled)) throw new DomainError("Det leveranssättet är inte tillgängligt.");
  const products = new Map((await loadShopProducts()).map((p) => [p.id, p]));
  const inventoryMap = new Map<number, number>(); const items: ShopQuoteItem[] = [];
  let knownWeight = true, totalWeight = 0;
  const addInventory = (id: number, quantity: number) => inventoryMap.set(id, (inventoryMap.get(id) ?? 0) + quantity);
  for (const line of [...v.items].sort((a, b) => a.productId - b.productId)) {
    const p = products.get(line.productId);
    if (!p || !publiclyAvailable(p, products)) throw new DomainError("En produkt i varukorgen är inte längre tillgänglig.");
    if (!p.weightGrams) knownWeight = false; else totalWeight += p.weightGrams * line.quantity;
    const base = p.priceOre * line.quantity;
    const item: ShopQuoteItem = { productId: p.id, name: p.name, quantity: line.quantity, priceOre: p.priceOre, vatPercent: p.vatPercent, kind: p.kind, lineTotalOre: base, originalLineTotalOre: Math.max(p.priceOre, p.bundleOriginalPriceOre ?? 0) * line.quantity };
    if (p.kind === "bundle") {
      item.bundleParts = p.bundleItems!.map((part) => ({ productId: part.productId, name: products.get(part.productId)!.name, quantity: part.quantity * line.quantity }));
      for (const part of item.bundleParts) addInventory(part.productId, part.quantity);
    } else addInventory(p.id, line.quantity);
    items.push(item);
  }
  for (const [id, quantity] of inventoryMap) if (products.get(id)!.stock < quantity) throw new DomainError(`Det finns inte tillräckligt många av ${products.get(id)!.name} i lager. Uppdatera varukorgen.`);
  const sellingSubtotal = items.reduce((s, i) => s + i.lineTotalOre, 0);
  if (sellingSubtotal > 100000000) throw new DomainError("Beställningen är för stor. Kontakta verksamheten.");
  const code = v.couponCode.trim().toUpperCase(); let selectedCoupon: ShopCoupon | undefined;
  if (code) {
    const row = await getDb().prepare(`SELECT c.*,${usageSql} uses FROM shop_coupons c WHERE c.code=?`).get(new Date().toISOString(), code);
    selectedCoupon = row ? coupon(row) : undefined;
    const now = new Date().toISOString();
    if (!selectedCoupon || !selectedCoupon.active || (selectedCoupon.startsAt && selectedCoupon.startsAt > now) || (selectedCoupon.endsAt && selectedCoupon.endsAt <= now) || sellingSubtotal < selectedCoupon.minSubtotalOre || (selectedCoupon.maxUses !== null && selectedCoupon.uses >= selectedCoupon.maxUses)) throw new DomainError("Rabattkoden kan inte användas för den här beställningen.");
    if (!selectedCoupon.combineWithOffers && items.some((i) => i.kind === "bundle")) throw new DomainError("Rabattkoden kan inte kombineras med paket. Ta bort koden eller paketet.");
  }
  const discounts: ShopDiscount[] = [];
  for (const item of items) if (item.originalLineTotalOre > item.lineTotalOre) discounts.push({ kind: "bundle", name: item.name, amountOre: item.originalLineTotalOre - item.lineTotalOre });
  const offers = (!selectedCoupon || selectedCoupon.combineWithOffers) ? (await getDb().prepare("SELECT * FROM shop_quantity_offers WHERE active=1 ORDER BY percent DESC,id").all()).map(offer) : [];
  for (const item of items.filter((i) => i.kind !== "bundle")) {
    const best = offers.find((o) => (!o.productIds.length || o.productIds.includes(item.productId)) && (o.scope === "per_product" ? item.quantity : items.filter((i) => i.kind !== "bundle" && (!o.productIds.length || o.productIds.includes(i.productId))).reduce((s, i) => s + i.quantity, 0)) >= o.minQuantity);
    if (best) { const amountOre = Math.round(item.lineTotalOre * best.percent / 100); item.lineTotalOre -= amountOre; if (amountOre) discounts.push({ kind: "quantity", name: best.name, amountOre }); }
  }
  if (selectedCoupon) {
    const subtotal = items.reduce((s, i) => s + i.lineTotalOre, 0);
    if (subtotal < selectedCoupon.minSubtotalOre) throw new DomainError("Varuvärdet efter erbjudanden är för lågt för den här rabattkoden.");
    const amountOre = selectedCoupon.type === "fixed" ? selectedCoupon.value : Math.round(subtotal * selectedCoupon.value / 100);
    if (amountOre >= subtotal) throw new DomainError("Rabattkoden skulle göra varorna kostnadsfria. Den kan inte användas för den här beställningen.");
    const shares = allocate(amountOre, items.map((i) => i.lineTotalOre)); items.forEach((i, index) => i.lineTotalOre -= shares[index]);
    discounts.push({ kind: "coupon", name: selectedCoupon.name, code: selectedCoupon.code, amountOre });
  }
  const originalSubtotalOre = items.reduce((s, i) => s + i.originalLineTotalOre, 0), subtotalOre = items.reduce((s, i) => s + i.lineTotalOre, 0);
  if (v.delivery === "shipping") totalWeight += settings.packingWeightGrams ?? 0;
  let shippingOre = v.delivery === "shipping" ? settings.shippingPriceOre : 0;
  let shippingLabel = v.delivery === "shipping" ? "Frakt inom Sverige" : "Hämtning";
  let selectedRule: ShopShippingRule | undefined;
  if (v.delivery === "shipping" && settings.shippingRuleMode) {
    if (!knownWeight) throw new DomainError("Frakten kan inte beräknas eftersom en produkt saknar vikt. Kontakta verksamheten.");
    const postcode = v.postcode.replace(/\s/g, ""); if (!/^\d{5}$/.test(postcode)) throw new DomainError("Ange ett svenskt postnummer för att beräkna frakten.");
    selectedRule = (await getDb().prepare("SELECT * FROM shop_shipping_rules WHERE active=1 ORDER BY priority,price_ore,id").all()).map(rule).find((r) => totalWeight >= r.minWeightGrams && (r.maxWeightGrams === null || totalWeight <= r.maxWeightGrams) && subtotalOre >= r.minSubtotalOre && (r.maxSubtotalOre === null || subtotalOre <= r.maxSubtotalOre) && (!r.postcodePrefixes.length || r.postcodePrefixes.some((prefix) => postcode.startsWith(prefix))));
    if (!selectedRule) throw new DomainError("Ingen fraktregel passar beställningens vikt, belopp och postnummer. Kontakta verksamheten eller välj hämtning.");
    shippingOre = selectedRule.priceOre; shippingLabel = [selectedRule.name, selectedRule.carrier, selectedRule.service].filter(Boolean).join(" · ");
  }
  if (v.delivery === "shipping" && settings.freeShippingThresholdOre !== null && subtotalOre >= settings.freeShippingThresholdOre) shippingOre = 0;
  const totalOre = subtotalOre + shippingOre;
  // Stripe's minimum SEK charge is 3.00 SEK: https://docs.stripe.com/currencies
  if (subtotalOre <= 0 || totalOre < 300) throw new DomainError("Beställningen måste vara minst 3 kr efter rabatter för att kunna betalas med kort.");
  if (totalOre > 100000000) throw new DomainError("Beställningen är för stor. Kontakta verksamheten.");
  const quote: ShopQuote = { items, originalSubtotalOre, discountOre: originalSubtotalOre - subtotalOre, subtotalOre, shippingOre, totalOre, weightGrams: knownWeight ? totalWeight : null, shippingLabel, discounts, couponCode: selectedCoupon?.code ?? null, fingerprint: "" };
  quote.fingerprint = createHash("sha256").update(JSON.stringify({ ...quote, fingerprint: undefined, delivery: v.delivery, terms: settings.terms, pickupAddress: v.delivery === "pickup" ? settings.pickupAddress : "", pickupInstructions: v.delivery === "pickup" ? settings.pickupInstructions : "", ruleId: selectedRule?.id ?? null, inventory: [...inventoryMap].sort(([a], [b]) => a - b) })).digest("hex");
  return { quote, inventory: [...inventoryMap].sort(([a], [b]) => a - b).map(([productId, quantity]) => ({ productId, quantity })), couponId: selectedCoupon?.id ?? null };
}
