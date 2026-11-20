import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { assertAdmin } from "./admin";
import { DomainError, getDb, getSettings, transaction } from "./db";
import { getBusinessSettings } from "./business-settings";
import { getAdminShopProduct, getShopOrderByReference, saveShopProduct } from "./shop";
import { loadShopProducts } from "./shop-commerce";
import { calculateShopQuote } from "./shop-commerce";
import { appUrl } from "./stripe";
import { randomToken, tokenHash } from "./security";
import { text } from "./validation";
import type { ShopOrder, ShopOrderItem } from "./shop-types";
import { WELLNESS_ADDRESS_THRESHOLD_ORE } from "./shop-types";

export type WellnessSeller = { legalName: string; organizationNumber: string; vatNumber: string; address: string; email: string; website: string };
export type WellnessReceipt = {
  number: string; kind: "purchase" | "correction"; originalNumber?: string;
  orderNumber: number; orderReference: string; issuedAt: string; paidAt: string;
  paymentMethod: string; paymentReference: string; seller: WellnessSeller;
  customer: { name: string; address: string; email: string };
  items: { name: string; quantity: number; priceOre: number; vatPercent: number; totalOre: number; validUntil: string; taxOre?: number }[];
  totalOre: number; vat: { percent: number; taxOre: number; netOre: number }[];
};
export const WELLNESS_RULES_URL = "https://www.skatteverket.se/privat/skatter/arbeteochinkomst/formaner/personalvardmotionochfriskvard.4.7459477810df5bccdd4800014540.html";

export async function getPublicWellnessServices() {
  return (await loadShopProducts()).filter(product => product.published && product.isService && product.wellnessEligible);
}

const now = () => new Date().toISOString();
export function wellnessExpiry(paidAt: string, months: number) {
  const date = new Date(paidAt); const day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return date.toISOString();
}
export function wellnessTotals(items: { totalOre: number; vatPercent: number; taxOre?: number }[]) {
  const groups = new Map<number, { percent: number; taxOre: number; netOre: number }>();
  for (const item of items) {
    const tax = item.taxOre ?? Math.sign(item.totalOre) * Math.round(Math.abs(item.totalOre) * item.vatPercent / (100 + item.vatPercent));
    const group = groups.get(item.vatPercent) ?? { percent: item.vatPercent, taxOre: 0, netOre: 0 };
    group.taxOre += tax; group.netOre += item.totalOre - tax; groups.set(item.vatPercent, group);
  }
  return [...groups.values()].sort((a, b) => a.percent - b.percent);
}
export async function getWellnessSeller(requireComplete = false): Promise<WellnessSeller> {
  const [business, settings, stored] = await Promise.all([getBusinessSettings(), getSettings(), getDb().prepare("SELECT value FROM app_meta WHERE key='wellness_seller_v1'").get()]);
  const custom = stored ? JSON.parse(String(stored.value)) : {};
  let website = ""; try { website = appUrl(); } catch { /* A draft can be prepared before configuration. */ }
  const seller = { legalName: business.legalName, organizationNumber: business.organizationNumber,
    vatNumber: String(custom.vatNumber || ""), address: String(custom.address || settings.address || ""),
    email: settings.email, website };
  if (requireComplete && (!/^SE\d{12}$/.test(seller.vatNumber) || seller.address.length < 5 || !z.email().safeParse(seller.email).success || !website))
    throw new DomainError("Fyll i verksamhetens momsregistreringsnummer, adress, e-post och APP_URL innan friskvårdsköp kan tas emot.");
  return seller;
}
export async function saveWellnessSeller(actorId: number, input: unknown) {
  await assertAdmin(actorId);
  const value = z.object({ vatNumber: z.string().trim().regex(/^SE\d{12}$/, "Ange det registrerade momsnumret, till exempel SE följt av tolv siffror."), address: text(1000, 5) }).parse(input);
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES('wellness_seller_v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(value));
}
export async function saveWellnessService(actorId: number, input: unknown) {
  return transaction(async () => {
    await assertAdmin(actorId);
    const value = z.object({ id: z.number().int().positive().optional(), name: text(150, 2), description: text(4000, 10),
      priceOre: z.number().int().min(1).max(100000), vatPercent: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(25)]),
      validityMonths: z.number().int().min(1).max(36), active: z.boolean(),
      eligibilityConfirmed: z.literal(true, { error: "Bekräfta att tjänsten är specificerad, icke-medicinsk friskvård." }) }).parse(input);
    const existing = value.id ? await getAdminShopProduct(actorId, value.id) : undefined;
    if (value.id && !existing) throw new DomainError("Tjänsten finns inte.");
    if (existing?.kind === "bundle") throw new DomainError("Ett produktpaket kan inte markeras som friskvårdstjänst.");
    const id = await saveShopProduct(actorId, value.id ?? null, { name: value.name, slug: existing?.slug ?? value.name,
      description: value.description, priceOre: value.priceOre, vatPercent: value.vatPercent, stock: 0,
      published: value.active, imageId: existing?.imageId ?? null, kind: "product", expectedUpdatedAt: existing?.updatedAt });
    await getDb().prepare("UPDATE shop_products SET is_service=1,wellness_eligible=1,validity_months=? WHERE id=?").run(value.validityMonths, id);
    return id;
  });
}
export async function createInitialWellnessServices(actorId: number) {
  return transaction(async () => {
    await assertAdmin(actorId);
    if ((await loadShopProducts()).some(p => p.wellnessEligible)) return;
    await saveWellnessService(actorId, { name: "Friskvårdsakupunktur", description: "Akupunktur för avslappning, välbefinnande och motverkande av muskelspänningar. Avser inte medicinsk sjukdomsbehandling.", priceOre: 50000, vatPercent: 25, validityMonths: 12, active: false, eligibilityConfirmed: true });
    await saveWellnessService(actorId, { name: "Individuell kostrådgivning", description: "Individuell rådgivning om hälsosamma matvanor och måltidsrutiner, inklusive kostprinciper inom traditionell kinesisk medicin. Avser inte medicinsk behandling eller kosttillskott.", priceOre: 60000, vatPercent: 25, validityMonths: 12, active: false, eligibilityConfirmed: true });
  });
}
export async function snapshotWellnessOrder(order: ShopOrder) {
  if (!order.items.some(item => item.wellness)) return;
  if (order.name.trim().split(/\s+/).length < 2)
    throw new DomainError("Ange för- och efternamn för det personliga friskvårdskvittot.");
  const hasAddress = Boolean(order.address || order.postcode || order.city);
  if ((hasAddress || order.totalOre > WELLNESS_ADDRESS_THRESHOLD_ORE) &&
      (order.address.length < 3 || !/^\d{5}$/.test(order.postcode) || order.city.length < 2)) {
    throw new DomainError(order.totalOre > WELLNESS_ADDRESS_THRESHOLD_ORE
      ? "Ange fullständig kundadress för köp över 4 000 kr."
      : "Fyll i hela kundadressen eller lämna samtliga adressfält tomma.");
  }
  const seller = await getWellnessSeller(true);
  await getDb().prepare("INSERT INTO wellness_order_snapshots(order_reference,seller_json) VALUES(?,?) ON CONFLICT DO NOTHING").run(order.reference, JSON.stringify(seller));
}

async function newReceipt(order: ShopOrder, evidence: Record<string, unknown>,
  items: WellnessReceipt["items"], eventKey: string, kind: WellnessReceipt["kind"], originalNumber?: string) {
  const existing = await getDb().prepare("SELECT id FROM wellness_receipts WHERE event_key=?").get(eventKey);
  if (existing) return String(existing.id);
  const seller = await getDb().prepare("SELECT seller_json FROM wellness_order_snapshots WHERE order_reference=?").get(order.reference);
  if (!seller) throw new DomainError("Verksamhetsuppgifterna för köpet saknas.");
  const issued = now(); const year = new Date(issued).getUTCFullYear();
  await getDb().prepare("INSERT INTO wellness_receipt_sequences(year,last_number) VALUES(?,1) ON CONFLICT(year) DO UPDATE SET last_number=last_number+1").run(year);
  const sequence = Number((await getDb().prepare("SELECT last_number FROM wellness_receipt_sequences WHERE year=?").get(year))!.last_number);
  const number = `FV-${year}-${String(sequence).padStart(5, "0")}`; const id = randomUUID();
  const snapshot: WellnessReceipt = { number, kind, originalNumber, orderNumber: order.id, orderReference: order.reference,
    issuedAt: issued, paidAt: String(evidence.paid_at), paymentMethod: String(evidence.method), paymentReference: String(evidence.reference),
    seller: JSON.parse(String(seller.seller_json)), customer: { name: order.name, email: order.email, address: order.address ? `${order.address}, ${order.postcode} ${order.city}` : "" },
    items, totalOre: items.reduce((sum, item) => sum + item.totalOre, 0), vat: wellnessTotals(items) };
  await getDb().prepare("INSERT INTO wellness_receipts(id,number,order_reference,event_key,kind,snapshot_json,amount_ore,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, number, order.reference, eventKey, kind, JSON.stringify(snapshot), snapshot.totalOre, issued);
  await getDb().prepare("INSERT INTO wellness_email_outbox(id,receipt_id,event_key,recipient,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)")
    .run(randomUUID(), id, `issue:${id}`, order.email, issued, issued);
  return id;
}
export async function activateWellnessOrder(reference: string) {
  return transaction(async () => {
    const order = await getShopOrderByReference(reference);
    const evidence = await getDb().prepare("SELECT * FROM wellness_payment_evidence WHERE order_reference=?").get(reference);
    if (!order || order.status !== "paid" || order.paymentStatus !== "paid" || !evidence || Number(evidence.amount_ore) !== order.totalOre) return;
    const eligible = order.items.filter(item => item.wellness);
    if (!eligible.length) return;
    const items: WellnessReceipt["items"] = [];
    for (const item of eligible) {
      const expires = wellnessExpiry(String(evidence.paid_at), item.wellness!.validityMonths);
      await getDb().prepare("INSERT INTO wellness_passes(id,order_reference,product_id,service_name,original_quantity,remaining,valid_until,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(order_reference,product_id) DO NOTHING")
        .run(randomUUID(), reference, item.productId, item.name, item.quantity, item.quantity, expires, String(evidence.paid_at));
      items.push({ name: item.name, quantity: item.quantity, priceOre: item.priceOre, vatPercent: item.vatPercent,
        totalOre: item.lineTotalOre ?? item.priceOre * item.quantity, validUntil: expires });
    }
    return newReceipt(order, evidence, items, `purchase:${reference}`, "purchase");
  });
}

export async function recordWellnessPaymentEvidence(actorId: number, input: unknown) {
  return transaction(async () => {
    await assertAdmin(actorId);
    const v = z.object({ reference: z.string().regex(/^[a-f0-9]{32}$/), proofReference: text(150, 5),
      paidAt: z.iso.datetime(), amountOre: z.number().int().positive(), verified: z.literal(true) }).parse(input);
    const order = await getShopOrderByReference(v.reference);
    const provider = await getDb().prepare("SELECT * FROM kustom_checkouts WHERE order_reference=? AND captured=1").get(v.reference);
    if (!order || !["pending", "paid"].includes(order.status) || !provider || v.amountOre !== order.totalOre || Date.parse(v.paidAt) > Date.now() || Number(provider.refunded_ore) > 0)
      throw new DomainError("Endast ett debiterat, ej återbetalt köp kan styrkas med ett betalningsunderlag för hela beloppet.");
    await getDb().prepare("INSERT INTO wellness_payment_evidence(order_reference,source,reference,paid_at,amount_ore,method,actor_id,created_at) VALUES(?,'documented',?,?,?,?,?,?) ON CONFLICT(order_reference) DO NOTHING")
      .run(order.reference, v.proofReference, v.paidAt, v.amountOre, `Kustom ${provider.method}; kundbetalning verifierad mot underlag`, actorId, now());
    await getDb().prepare("UPDATE kustom_checkouts SET customer_paid=1 WHERE order_reference=?").run(order.reference);
    await getDb().prepare("UPDATE shop_orders SET status='paid',payment_status='paid',paid_at=? WHERE reference=?").run(v.paidAt, order.reference);
    return activateWellnessOrder(order.reference);
  });
}
export async function recordManualWellnessPurchase(actorId: number, input: unknown) {
  return transaction(async () => {
    await assertAdmin(actorId);
    const v = z.object({ operationId: z.uuid(), name: text(100, 3), email: z.email(), address: text(200).default(""),
      postcode: z.union([z.literal(""), z.string().regex(/^\d{3}\s?\d{2}$/)]).default(""), city: text(100).default(""), paidAt: z.iso.datetime(),
      method: z.enum(["Swish", "Kort", "Kontant", "Banköverföring"]), proofReference: text(150, 5), verified: z.literal(true),
      items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).min(1).max(20) }).parse(input);
    const operation = await getDb().prepare("SELECT * FROM wellness_manual_operations WHERE operation_id=?").get(v.operationId);
    const fingerprint = tokenHash(JSON.stringify(v));
    if (operation) {
      if (!equalManualFingerprint(String(operation.request_hash), fingerprint)) throw new DomainError("Åtgärdsreferensen hör redan till ett annat manuellt köp.");
      return String(operation.order_reference);
    }
    const existing = await getDb().prepare("SELECT order_reference FROM wellness_payment_evidence WHERE reference=?").get(v.proofReference);
    if (existing) throw new DomainError("Betalningsreferensen är redan registrerad. Öppna det befintliga köpet.");
    if (Date.parse(v.paidAt) > Date.now()) throw new DomainError("Betalningsdatum får inte ligga i framtiden.");
    const { getShopSettings } = await import("./shop");
    const settings = { ...await getShopSettings(), enabled: true, pickupEnabled: true };
    const { quote } = await calculateShopQuote({ items: v.items, delivery: "pickup" }, settings);
    if (quote.items.some(item => !item.wellness)) throw new DomainError("Ett manuellt friskvårdsköp får bara innehålla specificerade friskvårdstjänster.");
    const reference = randomBytes(16).toString("hex"); const created = now();
    await getDb().prepare("INSERT INTO shop_orders(reference,name,email,address,postcode,city,delivery,subtotal_ore,shipping_ore,total_ore,status,payment_status,expires_at,created_at,paid_at,items_json,terms) VALUES(?,?,?,?,?,?,'pickup',?,0,?,'paid','paid',?,?,?,?,?)")
      .run(reference, v.name, v.email, v.address, v.postcode.replace(/\s/g, ""), v.city, quote.totalOre, quote.totalOre,
        created, created, v.paidAt, JSON.stringify(quote.items), `Manuellt registrerat redan betalt köp. Externt betalnings-/kassakvitto: ${v.proofReference}. Detta är ett underlag till samma försäljning, inte en ny debitering.`);
    await snapshotWellnessOrder((await getShopOrderByReference(reference))!);
    await getDb().prepare("INSERT INTO wellness_payment_evidence(order_reference,source,reference,paid_at,amount_ore,method,actor_id,created_at) VALUES(?,'manual',?,?,?,?,?,?)")
      .run(reference, v.proofReference, v.paidAt, quote.totalOre, `${v.method}; externt kassaunderlag`, actorId, created);
    await getDb().prepare("INSERT INTO wellness_manual_operations(operation_id,order_reference,request_hash) VALUES(?,?,?)").run(v.operationId, reference, fingerprint);
    await activateWellnessOrder(reference); return reference;
  });
}
function equalManualFingerprint(a: string, b: string) { return a === b; }
export async function changeWellnessPass(actorId: number, input: unknown) {
  return transaction(async () => {
    await assertAdmin(actorId);
    const v = z.object({ passId: z.uuid(), operationId: z.uuid(), reason: text(300, 3), reverseId: z.uuid().optional() }).parse(input);
    const duplicate = await getDb().prepare("SELECT * FROM wellness_redemptions WHERE operation_id=?").get(v.operationId);
    if (duplicate) {
      if (duplicate.pass_id !== v.passId || duplicate.reason !== v.reason || String(duplicate.reverses_id || "") !== (v.reverseId || "")) throw new DomainError("Åtgärdsreferensen har redan använts för en annan registrering.");
      return;
    }
    const pass = await getDb().prepare("SELECT p.*,o.payment_status FROM wellness_passes p JOIN shop_orders o ON o.reference=p.order_reference WHERE p.id=?").get(v.passId);
    if (!pass || pass.status !== "active" || pass.payment_status !== "paid") throw new DomainError("Klippkortet är spärrat eller inte aktivt.");
    let change = -1;
    if (v.reverseId) {
      const original = await getDb().prepare("SELECT id FROM wellness_redemptions WHERE id=? AND pass_id=? AND change=-1 AND NOT EXISTS(SELECT 1 FROM wellness_redemptions WHERE reverses_id=?)").get(v.reverseId, v.passId, v.reverseId);
      if (!original) throw new DomainError("Registreringen kan inte korrigeras igen.");
      change = 1;
    } else if (String(pass.valid_until) <= now() || Number(pass.remaining) < 1) throw new DomainError("Klippkortet är utgånget eller slut.");
    if (Number(pass.remaining) + change < 0 || Number(pass.remaining) + change > Number(pass.original_quantity) - Number(pass.refunded_quantity)) throw new DomainError("Korrigeringen skulle ge fel antal klipp.");
    await getDb().prepare("UPDATE wellness_passes SET remaining=remaining+? WHERE id=?").run(change, v.passId);
    await getDb().prepare("INSERT INTO wellness_redemptions(id,pass_id,operation_id,change,reverses_id,reason,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(randomUUID(), v.passId, v.operationId, change, v.reverseId ?? null, v.reason, actorId, now());
  });
}
export async function getWellnessAdmin(actorId: number, search = "") {
  await assertAdmin(actorId);
  const needle = `%${search.slice(0, 100).replace(/[!%_]/g, "!$&")}%`;
  const passes = await getDb().prepare("SELECT p.*,o.name,o.email,e.source AS evidence_source FROM wellness_passes p JOIN shop_orders o ON o.reference=p.order_reference LEFT JOIN wellness_payment_evidence e ON e.order_reference=p.order_reference WHERE o.name LIKE ? ESCAPE '!' OR o.email LIKE ? ESCAPE '!' ORDER BY p.created_at DESC LIMIT 200").all(needle, needle);
  const orders = await getDb().prepare("SELECT o.*,k.method,k.captured,CASE WHEN e.order_reference IS NOT NULL THEN 1 ELSE k.customer_paid END AS customer_paid FROM shop_orders o LEFT JOIN kustom_checkouts k ON k.order_reference=o.reference LEFT JOIN wellness_payment_evidence e ON e.order_reference=o.reference WHERE EXISTS(SELECT 1 FROM wellness_order_snapshots s WHERE s.order_reference=o.reference) AND (o.name LIKE ? ESCAPE '!' OR o.email LIKE ? ESCAPE '!') ORDER BY o.created_at DESC LIMIT 200").all(needle, needle);
  const receipts = await getDb().prepare(`SELECT r.id,r.number,r.order_reference,r.kind,r.created_at,r.amount_ore,o.total_ore AS order_total_ore,
    (SELECT status FROM wellness_email_outbox e WHERE e.receipt_id=r.id ORDER BY e.created_at DESC LIMIT 1) AS email_status
    FROM wellness_receipts r JOIN shop_orders o ON o.reference=r.order_reference ORDER BY r.created_at DESC LIMIT 200`).all();
  const history = await getDb().prepare("SELECT r.*,p.service_name FROM wellness_redemptions r JOIN wellness_passes p ON p.id=r.pass_id ORDER BY r.created_at DESC LIMIT 100").all();
  return { passes, orders, receipts, history };
}
export async function wellnessOrderDocuments(reference: string) {
  if (!/^[a-f0-9]{32}$/.test(reference)) return { receipts: [], passes: [] };
  const receipts = await getDb().prepare("SELECT id,number,kind FROM wellness_receipts WHERE order_reference=? ORDER BY created_at").all(reference);
  const passes = await getDb().prepare("SELECT id,service_name,original_quantity,remaining,refunded_quantity,status,valid_until FROM wellness_passes WHERE order_reference=?").all(reference);
  return { receipts, passes };
}
export async function wellnessDownloadLink(receiptId: string) {
  const token = randomToken();
  await getDb().prepare("DELETE FROM wellness_downloads WHERE expires_at<=?").run(now());
  await getDb().prepare("INSERT INTO wellness_downloads(token_hash,receipt_id,expires_at) VALUES(?,?,?)")
    .run(tokenHash(token), receiptId, new Date(Date.now() + 15 * 60000).toISOString());
  return `/api/friskvard/kvitto/${receiptId}?token=${token}`;
}

export async function correctWellnessRefund(reference: string, eventKey: string, lines: { productId: number; quantity: number; amountOre: number; taxOre?: number }[], refundedAt = now()) {
  return transaction(async () => {
    if (await getDb().prepare("SELECT event_key FROM wellness_provider_events WHERE event_key=?").get(eventKey)) return;
    const order = await getShopOrderByReference(reference);
    const original = await getDb().prepare("SELECT number FROM wellness_receipts WHERE order_reference=? AND kind='purchase'").get(reference);
    const evidence = await getDb().prepare("SELECT * FROM wellness_payment_evidence WHERE order_reference=?").get(reference);
    if (!order) throw new DomainError("Köpet finns inte.");
    const items: WellnessReceipt["items"] = [];
    for (const line of lines) {
      const item = order.items.find(item => item.productId === line.productId && item.wellness);
      if (!item) continue;
      const pass = await getDb().prepare("SELECT * FROM wellness_passes WHERE order_reference=? AND product_id=?").get(reference, line.productId);
      if (pass) {
        const remaining = Math.max(0, Number(pass.remaining) - line.quantity);
        const refunded = Number(pass.refunded_quantity) + line.quantity;
        if (refunded > Number(pass.original_quantity)) throw new DomainError("För många tillfällen skulle återbetalas.");
        await getDb().prepare("UPDATE wellness_passes SET remaining=?,refunded_quantity=?,status=? WHERE id=?")
          .run(remaining, refunded, refunded === Number(pass.original_quantity) ? "refunded" : Number(pass.remaining) < line.quantity ? "blocked" : "active", String(pass.id));
      }
      items.push({ name: item.name, quantity: -line.quantity, priceOre: item.priceOre, vatPercent: item.vatPercent, totalOre: -line.amountOre, taxOre: line.taxOre === undefined ? undefined : -line.taxOre, validUntil: pass ? String(pass.valid_until) : "" });
    }
    await getDb().prepare("INSERT INTO wellness_provider_events(event_key,created_at) VALUES(?,?)").run(eventKey, now());
    if (items.length && original && evidence) return newReceipt(order, { ...evidence, reference: eventKey, paid_at: refundedAt }, items, eventKey, "correction", String(original.number));
  });
}
export async function recordManualWellnessRefund(actorId: number, input: unknown) {
  return transaction(async () => {
    await assertAdmin(actorId);
    const v = z.object({ reference: z.string().regex(/^[a-f0-9]{32}$/), productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99),
      operationId: z.uuid(), proofReference: text(150, 5), refundedAt: z.iso.datetime(), verified: z.literal(true), reason: text(300, 3) }).parse(input);
    const previous = await getDb().prepare("SELECT * FROM wellness_refunds WHERE operation_id=?").get(v.operationId);
    if (previous) {
      const line = JSON.parse(String(previous.lines_json))[0];
      if (previous.order_reference !== v.reference || previous.proof_reference !== v.proofReference || line.productId !== v.productId || line.quantity !== v.quantity) throw new DomainError("Åtgärdsreferensen har redan använts för en annan återbetalning.");
      return;
    }
    const evidence = await getDb().prepare("SELECT source FROM wellness_payment_evidence WHERE order_reference=?").get(v.reference);
    const card = await getDb().prepare("SELECT * FROM wellness_passes WHERE order_reference=? AND product_id=?").get(v.reference, v.productId);
    const order = await getShopOrderByReference(v.reference);
    if (evidence?.source !== "manual" || !order || !card || card.status !== "active" || Number(card.remaining) < v.quantity || Date.parse(v.refundedAt) > Date.now()) throw new DomainError("Kontrollera det manuella köpet, kvarvarande klipp och återbetalningsdatum.");
    const item = order.items.find(item => item.productId === v.productId)!;
    const total = item.lineTotalOre ?? item.quantity * item.priceOre;
    const originalTax = Math.round(total * item.vatPercent / (100 + item.vatPercent)); const already = Number(card.refunded_quantity);
    const amountOre = Math.floor(total * (already + v.quantity) / item.quantity) - Math.floor(total * already / item.quantity);
    const taxOre = Math.floor(originalTax * (already + v.quantity) / item.quantity) - Math.floor(originalTax * already / item.quantity);
    const lines = [{ productId: v.productId, quantity: v.quantity, amountOre, taxOre }];
    await getDb().prepare("INSERT INTO wellness_refunds(id,order_reference,operation_id,actor_id,lines_json,amount_ore,status,proof_reference,reason,created_at) VALUES(?,?,?,?,?,?,'confirmed',?,?,?)")
      .run(randomUUID(), v.reference, v.operationId, actorId, JSON.stringify(lines), amountOre, v.proofReference, v.reason, now());
    await correctWellnessRefund(v.reference, `manual-refund:${v.proofReference}`, lines, v.refundedAt);
    if (!(await getDb().prepare("SELECT id FROM wellness_passes WHERE order_reference=? AND refunded_quantity<original_quantity LIMIT 1").get(v.reference)))
      await getDb().prepare("UPDATE shop_orders SET status='refunded',payment_status='refunded' WHERE reference=?").run(v.reference);
  });
}
