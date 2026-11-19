import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { createFirstAdmin, createUser, getDb } from "../src/lib/db";
import { hashPassword, randomToken, tokenHash } from "../src/lib/security";
import { getShopOrderByReference, getShopSettings, getAdminShopProduct, saveShopProduct, quoteShopCart, reserveShopOrder, expireShopOrders } from "../src/lib/shop";
import { changeWellnessPass, createInitialWellnessServices, getWellnessAdmin, recordManualWellnessPurchase, recordManualWellnessRefund, recordWellnessPaymentEvidence, saveWellnessSeller, saveWellnessService, wellnessDownloadLink, wellnessExpiry, wellnessTotals } from "../src/lib/wellness";
import { createKustomCheckout, KustomApiError, kustomOrderLines, reconcileKustomOrder, refundKustomWellness, validateKustomCallback, type KustomClient } from "../src/lib/kustom";
import { kustomConfiguration } from "../src/lib/shop-payment-config";
import { getWellnessPdf } from "../src/lib/wellness-pdf";
import { dispatchWellnessEmails } from "../src/lib/wellness-email";
import { saveBusinessSettings } from "../src/lib/business-settings";
import { DEFAULT_BUSINESS_SETTINGS } from "../src/lib/business-config";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM"]) delete process.env[key];
Object.assign(process.env, { TIBB_DATABASE_PATH: ":memory:", APP_URL: "https://wellness.example.test", SHOP_PAYMENT_PROVIDER: "kustom", KUSTOM_ENVIRONMENT: "playground", KUSTOM_API_USERNAME: "synthetic-test-user", KUSTOM_API_PASSWORD: "synthetic-test-password", KUSTOM_LIVE_ENABLED: "0" });
let adminId: number, studentId: number, sequence = 0;
before(async () => {
  adminId = (await createFirstAdmin({ name: "Wellness Admin", email: "wellness-admin@example.test", passwordHash: hashPassword("synthetic wellness password") })).id;
  studentId = (await createUser({ name: "Other Customer", email: "other@example.test", passwordHash: hashPassword("synthetic customer password"), role: "student" })).id;
  await getDb().prepare("UPDATE shop_settings SET enabled=1,pickup_enabled=1,pickup_address='Fiktiv testadress 1',terms='Syntetiska testvillkor för testverksamheten' WHERE id=1").run();
  await getDb().prepare("UPDATE settings SET email='wellness@example.test',address='Fiktiv testadress 1, 12345 Teststad' WHERE id=1").run();
  await saveBusinessSettings(adminId, { ...DEFAULT_BUSINESS_SETTINGS, legalName: "Fiktiv Testverksamhet AB" });
  await saveWellnessSeller(adminId, { vatNumber: "SE000000000001", address: "Fiktiv testadress 1, 12345 Teststad" });
});
after(async () => { await getDb().close(); });
async function fixture(quantities = [7, 1], mixed = false) {
  const n = ++sequence;
  const first = await saveWellnessService(adminId, { name: `Friskvårdsakupunktur ${n}`, description: "Avslappning och välbefinnande. Syntetisk testtjänst.", priceOre: 50000, vatPercent: 25, validityMonths: 12, active: true, eligibilityConfirmed: true });
  const second = await saveWellnessService(adminId, { name: `Kostrådgivning ${n}`, description: "Hälsosamma matvanor. Syntetisk testtjänst.", priceOre: 60000, vatPercent: 25, validityMonths: 12, active: true, eligibilityConfirmed: true });
  const items = [{ productId: first, quantity: quantities[0] }, { productId: second, quantity: quantities[1] }].filter(item => item.quantity > 0);
  if (mixed) {
    const productId = await saveShopProduct(adminId, null, { name: `Vanlig produkt ${n}`, slug: `vanlig-${n}`, description: "Syntetisk vanlig produkt, inte friskvård", priceOre: 9900, vatPercent: 25, stock: 20, published: true, imageId: null });
    items.push({ productId, quantity: 1 });
  }
  const input = { name: "Anna Testkund", email: `customer-${n}@example.test`, phone: "", address: "Fiktiv kundgata 2", postcode: "12345", city: "Teststad", delivery: "pickup" as const, items, consent: true };
  return { first, second, input, order: await reserveShopOrder(input) };
}
function gateway(order: Awaited<ReturnType<typeof fixture>>["order"], method = "CARD") {
  const providerId = randomUUID();
  const checkout = { order_id: providerId, merchant_reference1: order.reference, order_amount: order.totalOre, purchase_currency: "SEK", order_lines: kustomOrderLines(order), status: "checkout_incomplete" };
  const managed = { ...checkout, status: "AUTHORIZED", fraud_status: "ACCEPTED", initial_payment_method: { type: method }, captured_amount: 0, refunded_amount: 0,
    captures: [] as { capture_id: string; captured_amount: number; captured_at: string }[],
    refunds: [] as { refund_id: string; refunded_amount: number; refunded_at: string; order_lines: ReturnType<typeof kustomOrderLines> }[] };
  const calls: { path: string; method: string; body?: object; key?: string }[] = [];
  const client: KustomClient = { async request(path, verb = "GET", body, key) {
    calls.push({ path, method: verb, body, key });
    if (path === "/checkout/v3/orders" && verb === "POST") return checkout;
    if (path === "/hpp/v1/sessions") return { session_id: randomUUID(), redirect_url: "https://payments.kustom.example.test/test", expires_at: new Date(Date.now() + 3600000).toISOString() };
    if (path.startsWith("/checkout/") && verb === "GET") return checkout;
    if (path.endsWith("/acknowledge")) return {};
    if (path.endsWith("/captures") && verb === "POST") { if (!managed.captures.length) managed.captures.push({ capture_id: randomUUID(), captured_amount: order.totalOre, captured_at: new Date().toISOString() }); managed.captured_amount = order.totalOre; managed.status = "CAPTURED"; return { capture_id: managed.captures[0].capture_id }; }
    if (path.endsWith("/refunds") && verb === "POST") {
      const value = body as { refunded_amount: number; order_lines: ReturnType<typeof kustomOrderLines> };
      let refund = managed.refunds.find(refund => refund.refund_id === key);
      if (!refund) { refund = { refund_id: key!, refunded_amount: value.refunded_amount, refunded_at: new Date().toISOString(), order_lines: value.order_lines }; managed.refunds.push(refund); managed.refunded_amount += value.refunded_amount; }
      return { refund_id: refund.refund_id };
    }
    if (path.startsWith("/ordermanagement/") && verb === "GET") { if (checkout.status !== "checkout_complete") throw new KustomApiError(404); return managed; }
    throw new Error(`Unexpected fake Kustom call ${verb} ${path}`);
  } };
  return { client, calls, checkout, managed, complete: () => { checkout.status = "checkout_complete"; } };
}
async function receipts(reference: string) { return getDb().prepare("SELECT * FROM wellness_receipts WHERE order_reference=? ORDER BY created_at").all(reference); }
async function pass(reference: string, productId: number) { return (await getDb().prepare("SELECT * FROM wellness_passes WHERE order_reference=? AND product_id=?").get(reference, productId))!; }

test("wellness prices and tax are integer öre; 500, 4000 and 4100 examples have exact VAT and no shipping", async () => {
  for (const [quantities, total] of [[[1,0],50000], [[8,0],400000], [[7,1],410000]] as const) {
    const { order } = await fixture([...quantities]);
    assert.equal(order.totalOre, total); assert.equal(order.shippingOre, 0);
    assert.deepEqual(wellnessTotals(order.items.map(item => ({ totalOre: item.lineTotalOre!, vatPercent: item.vatPercent }))), [{ percent: 25, taxOre: total/5, netOre: total*4/5 }]);
    const lines = kustomOrderLines(order); assert.equal(lines.reduce((sum,line)=>sum+line.total_amount,0), total);
    assert.equal(lines[0].quantity, quantities[0]); assert.equal(lines[0].unit_price,50000);
  }
});
test("service administration enforces eligibility, per-visit limits, roles and personal validity", async () => {
  const value = { name: "Testtjänst", description: "Avslappning och välbefinnande.", priceOre: 100001, vatPercent: 25, validityMonths: 12, active: true, eligibilityConfirmed: true };
  await assert.rejects(saveWellnessService(adminId, value));
  await assert.rejects(saveWellnessService(studentId, { ...value, priceOre: 50000 }), /behörighet/);
  await assert.rejects(saveWellnessService(adminId, { ...value, priceOre: 50000, eligibilityConfirmed: false }));
  assert.equal(wellnessExpiry("2024-02-29T10:00:00.000Z",12), "2025-02-28T10:00:00.000Z");
  assert.equal(wellnessExpiry("2026-01-31T10:00:00.000Z",1), "2026-02-28T10:00:00.000Z");
});
test("checkout completion/authorization alone cannot create a paid order, receipt, or pass", async () => {
  const { order } = await fixture([1,0], true); const fake = gateway(order);
  await createKustomCheckout(order.reference, fake.client);
  await reconcileKustomOrder(order.reference,{ client:fake.client });
  assert.equal((await getShopOrderByReference(order.reference))!.status,"pending");
  fake.complete(); await reconcileKustomOrder(order.reference,{ client:fake.client });
  assert.equal((await getShopOrderByReference(order.reference))!.status,"pending");
  assert.equal((await receipts(order.reference)).length,0);
  assert.equal((await getDb().prepare("SELECT id FROM wellness_passes WHERE order_reference=?").all(order.reference)).length,0);
});
test("verified digital card capture activates each service once, snapshots history, and creates one receipt/outbox entry", async () => {
  const { order, first, second } = await fixture(); const fake = gateway(order);
  const url = await createKustomCheckout(order.reference,fake.client); assert.match(url,/^\/api\/kustom\/redirect\?ref=/);
  assert.equal(await createKustomCheckout(order.reference,fake.client),url);
  assert.equal(fake.calls.filter(call=>call.path==="/checkout/v3/orders").length,1);
  fake.complete();
  await Promise.all([reconcileKustomOrder(order.reference,{client:fake.client}),reconcileKustomOrder(order.reference,{client:fake.client})]);
  assert.equal((await getShopOrderByReference(order.reference))!.paymentStatus,"paid");
  assert.equal(Number((await pass(order.reference,first)).remaining),7);
  assert.equal(Number((await pass(order.reference,second)).remaining),1);
  assert.equal((await receipts(order.reference)).length,1);
  const receipt = (await receipts(order.reference))[0]; const snapshot = JSON.parse(String(receipt.snapshot_json));
  assert.equal(snapshot.totalOre,410000); assert.equal(snapshot.vat[0].taxOre,82000);
  const product = (await getAdminShopProduct(adminId,first))!;
  await saveWellnessService(adminId,{id:first,name:"Nytt namn",description:product.description,priceOre:65000,vatPercent:25,validityMonths:6,active:true,eligibilityConfirmed:true});
  assert.equal(String((await receipts(order.reference))[0].snapshot_json),String(receipt.snapshot_json));
  const pdf = await getWellnessPdf(String(receipt.id));
  assert.ok(pdf.byteLength>1000); assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);
  assert.deepEqual(await getWellnessPdf(String(receipt.id)),pdf);
  await writeFile(join(tmpdir(),"tibb-wellness-preview.pdf"),pdf);
});
test("invoice capture is not customer payment; verified documentary payment activates it later", async () => {
  const { order }=await fixture([1,0]); const fake=gateway(order,"INVOICE");
  await createKustomCheckout(order.reference,fake.client); fake.complete();
  await reconcileKustomOrder(order.reference,{client:fake.client});
  assert.equal((await receipts(order.reference)).length,0); assert.equal((await getShopOrderByReference(order.reference))!.status,"pending");
  await assert.rejects(recordWellnessPaymentEvidence(studentId,{}),/behörighet/);
  await recordWellnessPaymentEvidence(adminId,{reference:order.reference,proofReference:`bank-proof-${randomUUID()}`,paidAt:new Date().toISOString(),amountOre:order.totalOre,verified:true});
  assert.equal((await receipts(order.reference)).length,1); assert.equal((await getShopOrderByReference(order.reference))!.status,"paid");
});
test("mixed orders exclude physical goods and shipping from wellness receipts and honor actual discounted line totals", async () => {
  const { order }=await fixture([2,1],true); const fake=gateway(order);
  await createKustomCheckout(order.reference,fake.client); fake.complete();
  await reconcileKustomOrder(order.reference,{client:fake.client,capture:true});
  const snapshot=JSON.parse(String((await receipts(order.reference))[0].snapshot_json));
  assert.equal(snapshot.totalOre,160000);assert.equal(snapshot.items.length,2);assert.doesNotMatch(JSON.stringify(snapshot.items),/Vanlig produkt/);
});
test("mismatched money, currency and provider identity fail closed, and callback secrets are not guessed",async()=>{
  const {order}=await fixture([1,0]);const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);
  await assert.rejects(validateKustomCallback(order.reference,randomToken(),fake.checkout.order_id));
  fake.complete();fake.managed.order_amount++;
  await assert.rejects(reconcileKustomOrder(order.reference,{client:fake.client}));assert.equal((await receipts(order.reference)).length,0);
  fake.managed.order_amount--;fake.managed.purchase_currency="EUR";
  await assert.rejects(reconcileKustomOrder(order.reference,{client:fake.client}));
});
test("ambiguous checkout creation is quarantined rather than retried or releasing the stock reservation",async()=>{
  const {order}=await fixture([1,0]); let calls=0;
  const failing:KustomClient={async request(){calls++;throw new Error("private timeout with credentials");}};
  await assert.rejects(createKustomCheckout(order.reference,failing),/kontroll|bekräftas/);
  await assert.rejects(createKustomCheckout(order.reference,failing));assert.equal(calls,1);
  await getDb().prepare("UPDATE shop_orders SET expires_at='2000-01-01T00:00:00.000Z' WHERE reference=?").run(order.reference);
  await expireShopOrders();assert.equal((await getShopOrderByReference(order.reference))!.status,"pending");
});
test("redemptions are atomic, idempotent, cannot become negative, and reversals are audited once",async()=>{
  const {order,first}=await fixture([1,0]);const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);fake.complete();await reconcileKustomOrder(order.reference,{client:fake.client});
  const card=await pass(order.reference,first);const input={passId:String(card.id),operationId:randomUUID(),reason:"Besök 2026-11-19"};
  await Promise.all([changeWellnessPass(adminId,input),changeWellnessPass(adminId,input)]);
  assert.equal(Number((await pass(order.reference,first)).remaining),0);
  await assert.rejects(changeWellnessPass(adminId,{...input,operationId:randomUUID()}),/slut/);
  const event=(await getDb().prepare("SELECT id FROM wellness_redemptions WHERE operation_id=?").get(input.operationId))!;
  const reversal={passId:String(card.id),operationId:randomUUID(),reverseId:String(event.id),reason:"Felregistrerat besök"};
  await changeWellnessPass(adminId,reversal);await changeWellnessPass(adminId,reversal);
  assert.equal(Number((await pass(order.reference,first)).remaining),1);
  await assert.rejects(changeWellnessPass(adminId,{...reversal,operationId:randomUUID()}),/korrigeras/);
  await assert.rejects(getWellnessAdmin(studentId),/behörighet/);
});
test("partial refunds reduce unused sessions once and issue a separate immutable credit document",async()=>{
  const {order,first}=await fixture([3,0]);const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);fake.complete();await reconcileKustomOrder(order.reference,{client:fake.client});
  const original=String((await receipts(order.reference))[0].snapshot_json);
  const request={reference:order.reference,productId:first,quantity:1,operationId:randomUUID(),reason:"Kunden avstår ett tillfälle"};
  await refundKustomWellness(adminId,request,fake.client);await refundKustomWellness(adminId,request,fake.client);
  assert.equal(Number((await pass(order.reference,first)).remaining),2);assert.equal(Number((await pass(order.reference,first)).refunded_quantity),1);
  const documents=await receipts(order.reference);assert.equal(documents.length,2);assert.equal(String(documents[0].snapshot_json),original);
  assert.equal(Number(documents[1].amount_ore),-50000);
  await reconcileKustomOrder(order.reference,{client:fake.client});assert.equal((await receipts(order.reference)).length,2);
});
test("manual purchases require explicit verified external evidence and cannot double-register a reference",async()=>{
  const {first}=await fixture([1,0]);
  const input={operationId:randomUUID(),name:"Manuell Testkund",email:"manual@example.test",address:"Testgatan 3",postcode:"12345",city:"Teststad",paidAt:new Date().toISOString(),method:"Swish",proofReference:`cash-register-${randomUUID()}`,verified:true,items:[{productId:first,quantity:2}]};
  await assert.rejects(recordManualWellnessPurchase(adminId,{...input,verified:false}));
  const reference=await recordManualWellnessPurchase(adminId,input);assert.equal((await receipts(reference)).length,1);
  assert.equal(await recordManualWellnessPurchase(adminId,input),reference);
  await assert.rejects(recordManualWellnessPurchase(adminId,{...input,operationId:randomUUID()}),/redan/);
});
test("download tokens are private and time limited, and live API use requires an explicit deployment gate",async()=>{
  const row=(await getDb().prepare("SELECT id FROM wellness_receipts LIMIT 1").get())!;
  const link=await wellnessDownloadLink(String(row.id));const token=new URL(link,"https://test.example").searchParams.get("token")!;
  const stored=(await getDb().prepare("SELECT * FROM wellness_downloads WHERE token_hash=?").get(tokenHash(token)))!;
  assert.equal(stored.receipt_id,row.id);assert.ok(Date.parse(String(stored.expires_at))-Date.now()<=900000);assert.doesNotMatch(JSON.stringify(stored),new RegExp(token));
  process.env.KUSTOM_ENVIRONMENT="production";assert.throws(kustomConfiguration);process.env.KUSTOM_ENVIRONMENT="playground";
  assert.equal((await dispatchWellnessEmails()).configured,false);
});
test("admin can search customers using literal percent/underscore safely and read receipts and redemption history", async()=>{
  const all=await getWellnessAdmin(adminId);assert.ok(all.passes.length);assert.ok(all.orders.length);assert.ok(all.receipts.length);assert.ok(all.history.length);
  const manual=await getWellnessAdmin(adminId,"manual@example.test");assert.equal(manual.orders.length,1);assert.equal(manual.orders[0].name,"Manuell Testkund");
  assert.equal((await getWellnessAdmin(adminId,"%_!")).orders.length,0);
});
test("Kustom browser retries reuse the exact local order and reject a changed payload under the same attempt",async()=>{
  const {input}=await fixture([1,0]);const attempt={...input,checkoutAttemptId:randomUUID()};
  const [a,b]=await Promise.all([reserveShopOrder(attempt),reserveShopOrder(attempt)]);assert.equal(a.reference,b.reference);
  await assert.rejects(reserveShopOrder({...attempt,name:"Annat Testnamn"}),/andra uppgifter/);
});
test("a coupon discounts wellness and physical lines before issuing the receipt, and purchases over 5000 are allowed",async()=>{
  const {input}=await fixture([7,1],true);const code=`WELLNESS-${randomUUID().slice(0,8)}`.toUpperCase();
  await getDb().prepare("INSERT INTO shop_coupons(code,name,type,value,min_subtotal_ore,active,combine_with_offers) VALUES(?,?,'percent',10,0,1,1)").run(code,"Syntetisk rabatt");
  const order=await reserveShopOrder({...input,couponCode:code});const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);fake.complete();await reconcileKustomOrder(order.reference,{client:fake.client,capture:true});
  const snapshot=JSON.parse(String((await receipts(order.reference))[0].snapshot_json));assert.equal(snapshot.totalOre,369000);assert.equal(snapshot.vat[0].taxOre,73800);
  assert.equal((await fixture([11,0])).order.totalOre,550000);
});
test("a failed provider refund keeps passes blocked and a retry uses the same operation key",async()=>{
  const {order,first}=await fixture([2,0]);const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);fake.complete();await reconcileKustomOrder(order.reference,{client:fake.client});
  const request={reference:order.reference,productId:first,quantity:1,operationId:randomUUID(),reason:"Syntetisk återbetalning"};
  const broken:KustomClient={async request(path,method,body,key){if(path.endsWith('/refunds'))throw new Error('synthetic timeout');return fake.client.request(path,method,body,key);}};
  await assert.rejects(refundKustomWellness(adminId,request,broken));const card=await pass(order.reference,first);assert.equal(card.status,'blocked');assert.equal(card.remaining,2);
  await assert.rejects(changeWellnessPass(adminId,{passId:String(card.id),operationId:randomUUID(),reason:"Ska inte kunna användas"}),/spärrat/);
  await refundKustomWellness(adminId,request,fake.client);assert.equal((await pass(order.reference,first)).remaining,1);assert.equal((await pass(order.reference,first)).status,'active');
  assert.equal(fake.calls.find(call=>call.path.endsWith('/refunds'))!.key,request.operationId);
});
test("full refunds cannot be revived by stale reads and Checkout expiry does not hide managed refunds",async()=>{
  const {order,first}=await fixture([1,0]);const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);fake.complete();await reconcileKustomOrder(order.reference,{client:fake.client});
  await refundKustomWellness(adminId,{reference:order.reference,productId:first,quantity:1,operationId:randomUUID(),reason:"Återbetala hela köpet"},fake.client);
  assert.equal((await getShopOrderByReference(order.reference))!.status,'refunded');assert.equal((await pass(order.reference,first)).remaining,0);
  const stable:KustomClient={async request(path,method,body,key){if(path.startsWith('/checkout/'))throw new KustomApiError(404);return fake.client.request(path,method,body,key);}};
  await reconcileKustomOrder(order.reference,{client:stable});assert.equal((await receipts(order.reference)).length,2);
  fake.managed.refunded_amount=0;fake.managed.refunds=[];
  await assert.rejects(reconcileKustomOrder(order.reference,{client:fake.client}),/äldre/);
  assert.equal((await pass(order.reference,first)).status,'refunded');
});
test("manual refunds record an already completed external repayment exactly once without making API calls",async()=>{
  const existing=(await getWellnessAdmin(adminId,"manual@example.test")).passes[0];
  const request={reference:String(existing.order_reference),productId:Number(existing.product_id),quantity:1,operationId:randomUUID(),proofReference:`external-refund-${randomUUID()}`,refundedAt:new Date().toISOString(),verified:true,reason:"Redan återbetalt i kassan"};
  await assert.rejects(recordManualWellnessRefund(adminId,{...request,verified:false}));
  await recordManualWellnessRefund(adminId,request);await recordManualWellnessRefund(adminId,request);
  assert.equal((await pass(request.reference,request.productId)).remaining,1);assert.equal((await receipts(request.reference)).length,2);
});
test("receipt attachment delivery retries the same provider key and concurrent workers cannot duplicate a mail",async()=>{
  const {order}=await fixture([1,0]);const fake=gateway(order);await createKustomCheckout(order.reference,fake.client);fake.complete();await reconcileKustomOrder(order.reference,{client:fake.client});
  const original=globalThis.fetch;const keys:string[]=[];let accepted=0;let first=true;
  process.env.RESEND_API_KEY='synthetic-mail-key';process.env.EMAIL_FROM='Tibb Test <noreply@example.test>';
  globalThis.fetch=async (_url,init)=>{
    const headers=new Headers(init?.headers);keys.push(headers.get('Idempotency-Key')!);
    const body=JSON.parse(String(init?.body));assert.equal(body.subject,'Ditt friskvårdskvitto från Tibb.nu');assert.ok(body.attachments[0].filename.endsWith('.pdf'));
    assert.equal((await PDFDocument.load(Buffer.from(body.attachments[0].content,'base64'))).getPageCount(),1);
    if(first){first=false;accepted++;throw new Error('synthetic lost response after provider acceptance');}
    return Response.json({id:'synthetic-accepted-message'});
  };
  try{
    await dispatchWellnessEmails({reference:order.reference});
    await getDb().prepare("UPDATE wellness_email_outbox SET next_attempt_at='2000-01-01T00:00:00.000Z' WHERE receipt_id IN (SELECT id FROM wellness_receipts WHERE order_reference=?)").run(order.reference);
    await Promise.all([dispatchWellnessEmails({reference:order.reference}),dispatchWellnessEmails({reference:order.reference})]);
    assert.equal(keys.length,2);assert.equal(new Set(keys).size,1);assert.equal(accepted,1);
    assert.equal((await getDb().prepare("SELECT status FROM wellness_email_outbox WHERE receipt_id IN (SELECT id FROM wellness_receipts WHERE order_reference=?)").get(order.reference))!.status,'sent');
  }finally{globalThis.fetch=original;delete process.env.RESEND_API_KEY;delete process.env.EMAIL_FROM;}
});
