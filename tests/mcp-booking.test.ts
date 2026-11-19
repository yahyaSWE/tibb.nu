import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  attachCheckout, completeStripeBooking, createFirstAdmin, getBookingByReference, getDb,
  getTreatments, reserveBooking, type Booking,
} from "../src/lib/db";
import { saveSettings, saveSlot, saveTreatment } from "../src/lib/admin";
import { getBusinessSettings, saveBusinessSettings } from "../src/lib/business-settings";
import {
  bookingCheckoutSchema, createMcpBookingCheckout, getMcpBookingStatus,
  listMcpAvailableSlots, listMcpTreatments, type BookingCheckoutGateway,
} from "../src/lib/mcp-booking";
import { createBookingMcpHandler } from "../src/lib/mcp-server";
import { hashPassword, randomToken, tokenHash } from "../src/lib/security";
import { CLIENT_CAPABILITIES_META_KEY, PROTOCOL_VERSION_META_KEY } from "@modelcontextprotocol/server";
import { reconcileKustomServicePayment } from "../src/lib/kustom-service-payments";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM", "MCP_ALLOWED_ORIGINS", "MCP_BOOKING_ENABLED", "TRUST_PROXY"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
process.env.APP_URL = "https://booking.example.test";
process.env.STRIPE_SECRET_KEY = "sk_test_synthetic_not_a_real_key";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_synthetic_not_a_real_secret";
const headers = new Headers();
let adminId: number, sequence = 0;
before(async () => {
  adminId = (await createFirstAdmin({ name: "MCP Admin", email: "mcp-admin@example.test", passwordHash: hashPassword("synthetic mcp fixture password") })).id;
  await getDb().prepare("UPDATE settings SET stripe_enabled=1").run();
});
after(async () => { await getDb().close(); });

async function fixture() {
  const number = ++sequence;
  const name = `MCP treatment ${number}`;
  await saveTreatment(adminId, { name, description: "Public treatment information", durationMinutes: 30, price: "399", active: true, deliveryMode: "remote" });
  const treatment = (await getTreatments()).find(value => value.name === name)!;
  const date = new Date(Date.now() + (number + 10) * 86400000).toISOString().slice(0, 10);
  const slotId = await saveSlot(adminId, treatment.id, `${date}T10:00`);
  const offers = await listMcpAvailableSlots({ treatmentId: treatment.id });
  const offer = offers.slots.find(value => value.slotId === slotId)!;
  const input = {
    bookingToken: offers.bookingToken, slotId, offerVersion: offer.offerVersion,
    name: `Synthetic customer ${number}`, email: `mcp-customer-${number}@example.test`, phone: "0700000000",
    userConfirmed: true as const, termsAccepted: true as const, contactConsent: true as const,
  };
  return { treatment, slotId, offers, offer, input };
}
function fakeGateway() {
  const sessions = new Map<string, { url: string; status: string }>();
  let createCalls = 0, retrieveCalls = 0;
  const gateway: BookingCheckoutGateway = {
    async create(booking) {
      createCalls++;
      const id = `cs_test_${booking.reference}`;
      if (!sessions.has(id)) sessions.set(id, { url: `https://checkout.stripe.com/c/pay/${booking.reference}`, status: "open" });
      await attachCheckout(booking.reference, id);
      return sessions.get(id)!.url;
    },
    async retrieve(id) { retrieveCalls++; return sessions.get(id)!; },
  };
  return { gateway, sessions, calls: () => ({ createCalls, retrieveCalls }) };
}
async function stored(secret: string): Promise<Booking> {
  const row = await getDb().prepare("SELECT booking_reference FROM mcp_booking_requests WHERE token_hash=?").get(tokenHash(secret));
  return (await getBookingByReference(String(row!.booking_reference)))!;
}
async function bookingCount() { return Number((await getDb().prepare("SELECT COUNT(*) total FROM bookings").get())!.total); }

test("Kustom MCP checkout keeps the booking private and confirms it once after verified capture", async (t) => {
  for (const [key, value] of Object.entries({ NODE_ENV: "production", SHOP_PAYMENT_PROVIDER: "stripe", KUSTOM_ENVIRONMENT: "playground",
    KUSTOM_API_USERNAME: "synthetic", KUSTOM_API_PASSWORD: "synthetic", KUSTOM_BOOKING_VAT_PERCENT: "25" })) {
    const previous = process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
    process.env[key] = value;
  }
  const { input, treatment } = await fixture();
  let order: { order_amount: number; order_lines: Array<{ name: string; total_tax_amount: number }> } | undefined;
  let authorized = false, captured = false, captureCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === "/checkout/v3/orders") {
      const submitted = JSON.parse(String(init?.body));
      order = { ...submitted, order_id: "order-kustom-booking", status: "CHECKOUT_INCOMPLETE" };
      assert.equal(submitted.order_lines[0].name, "Behandlingsbokning");
      assert.equal(submitted.order_lines[0].total_tax_amount, 7980);
      assert.ok(!String(init?.body).includes(treatment.name));
      return Response.json(order);
    }
    if (path === "/hpp/v1/sessions") return Response.json({ session_id: "session-kustom-booking", redirect_url: "https://hpp.example.test/booking" });
    if (path === "/hpp/v1/sessions/session-kustom-booking") return Response.json({ session_id: "session-kustom-booking", status: "WAITING" });
    if (path.endsWith("/acknowledge")) return new Response(null, { status: 204 });
    if (path.endsWith("/captures")) {
      captureCalls++;
      assert.match(String((init?.headers as Record<string, string>)["Kustom-Idempotency-Key"]), /^[a-f0-9-]{36}$/);
      captured = true;
      return new Response(null, { status: 204 });
    }
    if (path === "/ordermanagement/v1/orders/order-kustom-booking") {
      if (!authorized) return new Response(null, { status: 404 });
      return Response.json({ ...order, status: captured ? "CAPTURED" : "AUTHORIZED", fraud_status: "ACCEPTED", initial_payment_method: { type: "CARD" },
        captured_amount: captured ? order!.order_amount : 0, refunded_amount: 0, refunds: [],
        captures: captured ? [{ capture_id: "capture-kustom-booking", captured_amount: order!.order_amount, captured_at: new Date().toISOString() }] : [] });
    }
    throw new Error(`Unexpected API path ${path}`);
  });
  assert.equal((await listMcpTreatments()).paymentMethod, "kustom");
  const site = { siteName: "Tibb.nu", email: "booking@example.test", phone: "", address: "", location: "Besök" };
  await saveSettings(adminId, { ...site, kustomBookingEnabled: false });
  assert.equal((await listMcpTreatments()).onlinePaymentAvailable, false);
  await assert.rejects(reserveBooking({ ...input, paymentMethod: "kustom" }), /Kustom/);
  await saveSettings(adminId, { ...site, kustomBookingEnabled: true });
  assert.equal((await listMcpTreatments()).onlinePaymentAvailable, true);
  await assert.rejects(reserveBooking({ ...input, paymentMethod: "stripe" }), /Kustom/);
  await assert.rejects(reserveBooking({ ...input, paymentMethod: "onsite" }), /Kustom/);
  const started = await createMcpBookingCheckout(input, headers);
  assert.equal(started.checkoutUrl, "https://hpp.example.test/booking");
  assert.equal((await createMcpBookingCheckout(input, headers)).checkoutUrl, started.checkoutUrl);
  const booking = await stored(input.bookingToken);
  assert.equal(booking.paymentMethod, "kustom");
  await reconcileKustomServicePayment(booking.reference);
  assert.equal((await stored(input.bookingToken)).status, "pending");
  authorized = true;
  await reconcileKustomServicePayment(booking.reference);
  await reconcileKustomServicePayment(booking.reference);
  assert.equal((await stored(input.bookingToken)).status, "confirmed");
  assert.equal(captureCalls, 1);
});

test("catalog and availability expose active public offers, exact prices and terms, without customer data", async () => {
  const { treatment, offers, offer, input } = await fixture();
  const catalog = await listMcpTreatments();
  assert.ok(catalog.treatments.some(value => value.id === treatment.id));
  assert.ok(catalog.treatments.every(value => value.priceOre >= 0));
  assert.equal(catalog.onlinePaymentAvailable, true);
  assert.equal(offer.priceOre, 39900); assert.equal(offer.timeZone, "Europe/Stockholm");
  assert.equal(offer.deliveryMode, "remote");
  assert.equal(offers.terms.termsUrl, "https://booking.example.test/villkor");
  assert.match(offers.bookingToken, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(catalog), new RegExp(input.email));
  await getDb().prepare("UPDATE treatments SET active=0 WHERE id=?").run(treatment.id);
  assert.ok(!(await listMcpTreatments()).treatments.some(value => value.id === treatment.id));
  await assert.rejects(listMcpAvailableSlots({ treatmentId: treatment.id }), /inte tillgänglig/);
});

test("availability filters occupied, blocked and inactive practitioners, and honors date and result limits", async () => {
  const { treatment, offer, input } = await fixture();
  const day = offer.start.slice(0, 10);
  // saveSlot expects Swedish local time; the exact date is immaterial here.
  const second = await saveSlot(adminId, treatment.id, `${day}T14:00`);
  const third = await saveSlot(adminId, treatment.id, `${day}T15:00`);
  await reserveBooking({ ...input, paymentMethod: "onsite" });
  await getDb().prepare("INSERT INTO availability_blocks(practitioner_id,start,end,reason,created_at) SELECT practitioner_id,start,end,'private block',? FROM slots WHERE id=?")
    .run(new Date().toISOString(), second);
  const available = await listMcpAvailableSlots({ treatmentId: treatment.id, limit: 1 });
  assert.deepEqual(available.slots.map(value => value.slotId), [third]);
  assert.doesNotMatch(JSON.stringify(available), /private block/);
  assert.equal((await listMcpAvailableSlots({ treatmentId: treatment.id, to: offer.start })).slots.length, 0);
  await getDb().prepare("UPDATE practitioners SET active=0 WHERE id=?").run(offer.practitionerId);
  assert.equal((await listMcpAvailableSlots({ treatmentId: treatment.id })).slots.length, 0);
  await getDb().prepare("UPDATE practitioners SET active=1 WHERE id=?").run(offer.practitionerId);
});

test("checkout reserves once, persists only token hashes, reuses checkout and waits for verified payment", async () => {
  const { input, treatment } = await fixture(); const fake = fakeGateway();
  const result = await createMcpBookingCheckout(input, headers, fake.gateway);
  assert.equal(result.status, "pending"); assert.equal(result.paymentVerified, false);
  assert.ok(result.checkoutUrl?.startsWith("https://checkout.stripe.com/"));
  const booking = await stored(input.bookingToken);
  assert.equal(booking.paymentStatus, "pending");
  assert.ok(Date.parse(booking.expiresAt!) > Date.now() + 34 * 60000);
  const again = await createMcpBookingCheckout(input, headers, fake.gateway);
  assert.equal(again.checkoutUrl, result.checkoutUrl);
  assert.deepEqual(fake.calls(), { createCalls: 1, retrieveCalls: 1 });
  const rows = await getDb().prepare("SELECT * FROM mcp_booking_requests").all();
  assert.doesNotMatch(JSON.stringify(rows), new RegExp(input.bookingToken));
  assert.equal((await listMcpAvailableSlots({ treatmentId: treatment.id })).slots.length, 0);
  const status = await getMcpBookingStatus({ bookingToken: input.bookingToken }, headers);
  assert.doesNotMatch(JSON.stringify(status), /Synthetic customer|mcp-customer|0700000000|meetingUrl|checkoutSessionId/);
  assert.equal(await completeStripeBooking(booking.checkoutSessionId!, booking.priceOre, "sek"), "confirmed");
  const paid = await getMcpBookingStatus({ bookingToken: input.bookingToken }, headers);
  assert.equal(paid.status, "confirmed"); assert.equal(paid.paymentVerified, true);
  assert.equal((await createMcpBookingCheckout(input, headers, fake.gateway)).checkoutUrl, null);
  assert.equal(fake.calls().createCalls, 1);
});

test("simultaneous retries share a reservation; competing tokens cannot double book", async () => {
  const { input } = await fixture(); const fake = fakeGateway(); const beforeCount = await bookingCount();
  const results = await Promise.all([createMcpBookingCheckout(input, headers, fake.gateway), createMcpBookingCheckout(input, headers, fake.gateway)]);
  assert.equal(await bookingCount(), beforeCount + 1);
  assert.equal(results[0].confirmationUrl, results[1].confirmationUrl);
  assert.equal(fake.sessions.size, 1);
  await assert.rejects(createMcpBookingCheckout({ ...input, bookingToken: randomToken() }, headers, fake.gateway), /bokas|tillgänglig/);
  assert.equal(await bookingCount(), beforeCount + 1);
});

test("ambiguous checkout failures keep the hold and recover with the same token", async () => {
  const { input } = await fixture(); const fake = fakeGateway();
  const failing: BookingCheckoutGateway = { ...fake.gateway, async create(booking) { await fake.gateway.create(booking); throw new Error("synthetic network timeout with private credentials"); } };
  await assert.rejects(createMcpBookingCheckout(input, headers, failing), /samma bokningstoken/);
  const booking = await stored(input.bookingToken); assert.equal(booking.status, "pending");
  const result = await createMcpBookingCheckout(input, headers, fake.gateway);
  assert.ok(result.checkoutUrl); assert.equal(fake.sessions.size, 1);
  assert.equal(fake.calls().createCalls, 1);
});

test("lost checkout responses before database attachment recover without a second reservation", async () => {
  const { input } = await fixture(); const fake = fakeGateway(); const beforeCount = await bookingCount();
  await assert.rejects(createMcpBookingCheckout(input, headers, { ...fake.gateway, async create() { throw new Error("timeout"); } }));
  assert.equal((await stored(input.bookingToken)).checkoutSessionId, null);
  await createMcpBookingCheckout(input, headers, fake.gateway);
  assert.equal(await bookingCount(), beforeCount + 1); assert.equal(fake.sessions.size, 1);
});

test("a changed price, time or terms requires a new customer-approved offer before reserving", async () => {
  for (const change of ["price", "time", "terms"]) {
    const { input, treatment } = await fixture(); const fake = fakeGateway(); const count = await bookingCount();
    const business = await getBusinessSettings();
    if (change === "price") await getDb().prepare("UPDATE treatments SET price_ore=49900 WHERE id=?").run(treatment.id);
    if (change === "time") await getDb().prepare("UPDATE slots SET start='2090-01-01T10:00:00.000Z',end='2090-01-01T10:30:00.000Z' WHERE id=?").run(input.slotId);
    if (change === "terms") await saveBusinessSettings(adminId, { ...business, cancellationHours: 48 });
    await assert.rejects(createMcpBookingCheckout(input, headers, fake.gateway), /ändrats/);
    assert.equal(await bookingCount(), count); assert.equal(fake.calls().createCalls, 0);
    if (change === "terms") await saveBusinessSettings(adminId, business);
  }
});

test("explicit confirmations are mandatory and payment or health fields cannot be injected", async () => {
  const { input } = await fixture(); const fake = fakeGateway(); const count = await bookingCount();
  for (const field of ["userConfirmed", "termsAccepted", "contactConsent"]) {
    await assert.rejects(createMcpBookingCheckout({ ...input, [field]: false }, headers, fake.gateway));
    const missing: Record<string, unknown> = { ...input }; delete missing[field];
    assert.equal(bookingCheckoutSchema.safeParse(missing).success, false);
  }
  for (const extra of [{ paymentStatus: "paid" }, { priceOre: 1 }, { paymentMethod: "onsite" }, { cardNumber: "synthetic" }, { anamnes: "synthetic health data" }])
    await assert.rejects(createMcpBookingCheckout({ ...input, ...extra }, headers, fake.gateway));
  assert.equal(await bookingCount(), count); assert.equal(fake.calls().createCalls, 0);
});

test("a token cannot change booking details or expose someone else's booking, and expires after the visit", async () => {
  const { input } = await fixture(); const fake = fakeGateway();
  await createMcpBookingCheckout(input, headers, fake.gateway);
  await assert.rejects(createMcpBookingCheckout({ ...input, email: "other@example.test" }, headers, fake.gateway), /andra uppgifter/);
  await assert.rejects(getMcpBookingStatus({ bookingToken: randomToken() }, headers), /hittades inte/);
  const booking = await stored(input.bookingToken);
  await assert.rejects(getMcpBookingStatus({ reference: booking.reference }, headers));
  await getDb().prepare("UPDATE mcp_booking_requests SET access_expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash=?").run(tokenHash(input.bookingToken));
  await assert.rejects(getMcpBookingStatus({ bookingToken: input.bookingToken }, headers), /hittades inte/);
  await assert.rejects(createMcpBookingCheckout(input, headers, fake.gateway), /gått ut/);
});

test("expired reservations release the time and old tokens cannot create another checkout", async () => {
  const { input, treatment } = await fixture(); const fake = fakeGateway();
  await createMcpBookingCheckout(input, headers, fake.gateway);
  const booking = await stored(input.bookingToken);
  await getDb().prepare("UPDATE bookings SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(booking.id);
  assert.equal((await getMcpBookingStatus({ bookingToken: input.bookingToken }, headers)).status, "cancelled");
  assert.equal((await createMcpBookingCheckout(input, headers, fake.gateway)).checkoutUrl, null);
  assert.equal(fake.calls().createCalls, 1);
  assert.equal((await listMcpAvailableSlots({ treatmentId: treatment.id })).slots.length, 1);
});

test("disabled Stripe and per-customer limits reject checkout before reserving a slot", async () => {
  const { input } = await fixture(); const fake = fakeGateway(); const count = await bookingCount();
  await getDb().prepare("UPDATE settings SET stripe_enabled=0").run();
  await assert.rejects(createMcpBookingCheckout(input, headers, fake.gateway), /inte tillgänglig/);
  assert.equal((await listMcpTreatments()).onlinePaymentAvailable, false);
  await getDb().prepare("UPDATE settings SET stripe_enabled=1").run();
  await getDb().prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,10,?)")
    .run(`booking:${tokenHash(input.email)}`, new Date(Date.now() + 900000).toISOString());
  await assert.rejects(createMcpBookingCheckout(input, headers, fake.gateway), /många försök/);
  assert.equal(await bookingCount(), count); assert.equal(fake.calls().createCalls, 0);
});

type RpcResult = { result?: { tools?: { name: string; annotations: { readOnlyHint: boolean } }[]; serverInfo?: { name: string }; structuredContent?: Record<string, unknown>; isError?: boolean; content?: { text: string }[] }; error?: { message: string; code: number } };
async function rpc(handler: ReturnType<typeof createBookingMcpHandler>, method: string, params: object = {}, modern = false) {
  const response = await handler(new Request("https://booking.example.test/api/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": modern ? "2026-07-28" : "2025-11-25", ...(modern ? { "MCP-Method": method, ...(method === "tools/call" ? { "MCP-Name": (params as { name: string }).name } : {}) } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: modern ? { ...params, _meta: { [PROTOCOL_VERSION_META_KEY]: "2026-07-28", [CLIENT_CAPABILITIES_META_KEY]: {} } } : params }),
  }));
  const text = await response.text();
  const json = response.headers.get("content-type")?.includes("text/event-stream")
    ? JSON.parse(text.split("\n").find(line => line.startsWith("data: "))!.slice(6)) : JSON.parse(text);
  return { response, body: json as RpcResult };
}

test("official SDK serves 2025 initialization and tools plus current MCP discovery and tool calls", async () => {
  const handler = createBookingMcpHandler(fakeGateway().gateway);
  const init = await rpc(handler, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "synthetic-test", version: "1.0" } });
  assert.equal(init.response.status, 200); assert.equal(init.body.result?.serverInfo?.name, "tibb-nu-booking");
  for (const modern of [false, true]) {
    const list = await rpc(handler, "tools/list", {}, modern);
    assert.equal(list.response.status, 200, JSON.stringify(list.body));
    assert.deepEqual(list.body.result?.tools?.map(value => value.name), ["list_treatments", "get_available_slots", "create_booking_checkout", "get_booking_status"]);
    assert.equal(list.body.result?.tools?.find(value => value.name === "create_booking_checkout")?.annotations.readOnlyHint, false);
    const catalog = await rpc(handler, "tools/call", { name: "list_treatments", arguments: {} }, modern);
    assert.equal(catalog.response.status, 200, JSON.stringify(catalog.body));
    assert.ok(catalog.body.result?.structuredContent?.treatments);
  }
  const discover = await rpc(handler, "server/discover", {}, true);
  assert.equal(discover.response.status, 200, JSON.stringify(discover.body));
});

test("MCP errors do not leak internals and protocol checkout and status share persistent booking state", async () => {
  const { input } = await fixture(); const fake = fakeGateway();
  const handler = createBookingMcpHandler(fake.gateway);
  const create = await rpc(handler, "tools/call", { name: "create_booking_checkout", arguments: input });
  assert.equal(create.body.result?.isError, undefined, JSON.stringify(create.body));
  assert.equal(create.body.result?.structuredContent?.status, "pending");
  // A fresh handler represents another Vercel function instance.
  const status = await rpc(createBookingMcpHandler(fake.gateway), "tools/call", { name: "get_booking_status", arguments: { bookingToken: input.bookingToken } }, true);
  assert.equal(status.body.result?.structuredContent?.status, "pending", JSON.stringify(status.body));
  const invalid = await rpc(handler, "tools/call", { name: "get_booking_status", arguments: { bookingToken: randomToken() } });
  assert.equal(invalid.body.result?.isError, true);
  assert.doesNotMatch(JSON.stringify(invalid.body), /SELECT|token_hash|stack|sk_test|whsec/);
});

test("HTTP endpoint rejects untrusted browser origins, bounds payloads and disables caching", async () => {
  const handler = createBookingMcpHandler(fakeGateway().gateway);
  const request = (method: string, extra: Record<string, string> = {}, body?: string) => new Request("https://booking.example.test/api/mcp", {
    method, headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...extra }, body,
  });
  assert.equal((await handler(request("POST", { Origin: "https://evil.example.test" }, "{}"))).status, 403);
  assert.equal((await handler(request("OPTIONS", { Origin: "null" }))).status, 403);
  const preflight = await handler(request("OPTIONS", { Origin: "https://booking.example.test" }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "https://booking.example.test");
  process.env.MCP_ALLOWED_ORIGINS = "https://agent.example.test";
  assert.equal((await handler(request("OPTIONS", { Origin: "https://agent.example.test" }))).status, 204);
  delete process.env.MCP_ALLOWED_ORIGINS;
  assert.equal((await handler(request("GET"))).status, 405);
  assert.equal((await handler(request("DELETE"))).status, 405);
  assert.equal((await handler(request("POST", { "Content-Length": "17000" }, "{}"))).status, 413);
  assert.equal((await handler(request("POST", {}, " ".repeat(17000)))).status, 413);
  const malformed = await handler(request("POST", {}, "{not-json"));
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get("Cache-Control")!, /no-store/);
  assert.equal(malformed.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(malformed.headers.get("Access-Control-Allow-Origin"), null);
  process.env.MCP_BOOKING_ENABLED = "0";
  assert.equal((await handler(request("GET"))).status, 503);
  delete process.env.MCP_BOOKING_ENABLED;
});

test("trusted proxy IP limits apply before MCP dispatch while spoofed local IP headers are ignored", async () => {
  const handler = createBookingMcpHandler(fakeGateway().gateway);
  const ip = "203.0.113.7";
  await getDb().prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,300,?)")
    .run(`mcp-http:ip:${tokenHash(ip)}`, new Date(Date.now() + 900000).toISOString());
  const request = () => new Request("https://booking.example.test/api/mcp", { headers: { "X-Forwarded-For": ip } });
  assert.equal((await handler(request())).status, 405);
  process.env.TRUST_PROXY = "1";
  try {
    const blocked = await handler(request());
    assert.equal(blocked.status, 429); assert.equal(blocked.headers.get("Retry-After"), "900");
  } finally { delete process.env.TRUST_PROXY; }
});
