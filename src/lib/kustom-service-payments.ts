import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, transaction } from "./database";
import { DomainError, type Booking } from "./db";
import { KustomApiError, kustomCheckoutSchema, kustomClient, kustomIdentifier, kustomManagedOrderSchema, kustomOperationKey } from "./kustom";
import { equalSecret, randomToken, tokenHash } from "./security";
import { bookingVatPercent, kustomConfiguration } from "./shop-payment-config";

type Kind = "booking" | "course";
type Line = ReturnType<typeof serviceLine>;
const now = () => new Date().toISOString();
const payment = (reference: string) => getDb().prepare("SELECT * FROM kustom_service_payments WHERE reference=?").get(reference);

export async function openKustomBooking(booking: Booking) {
  const vat = bookingVatPercent();
  if (booking.paymentMethod !== "kustom" || booking.status !== "pending" || !booking.expiresAt || vat === null)
    throw new DomainError("Bokningen är inte öppen för Kustom-betalning.");
  return openKustomServicePayment({ reference: booking.reference, kind: "booking", amount: booking.priceOre,
    vat, email: booking.email, deadline: booking.expiresAt });
}

export async function getKustomBookingPaymentLink(reference: string) {
  const row = await payment(reference);
  if (row?.kind === "booking" && row.state === "open" && row.redirect_url && String(row.deadline) > now())
    return String(row.redirect_url);
  return null;
}

export async function wasKustomBookingCheckoutRejected(reference: string) {
  const row = await payment(reference);
  return row?.kind === "booking" && row.state === "cancelled" && !row.order_id && !row.candidate_id;
}

function serviceLine(kind: Kind, amount: number, vat: number) {
  return {
    reference: kind, type: "digital", name: kind === "booking" ? "Behandlingsbokning" : "Digital kurs",
    quantity: 1, unit_price: amount, total_amount: amount, total_discount_amount: 0,
    tax_rate: vat * 100, total_tax_amount: Math.round(amount * vat / (100 + vat)),
  };
}

function verify(remote: z.infer<typeof kustomCheckoutSchema>, reference: string, line: Line, id?: string) {
  const actual = remote.order_lines[0];
  if ((id && id !== remote.order_id) || remote.merchant_reference1 !== reference || remote.purchase_currency.toUpperCase() !== "SEK" ||
      remote.order_amount !== line.total_amount || remote.order_lines.length !== 1 || actual.reference !== line.reference ||
      actual.quantity !== line.quantity || actual.unit_price !== line.unit_price || actual.total_amount !== line.total_amount ||
      actual.tax_rate !== line.tax_rate || actual.total_tax_amount !== line.total_tax_amount) {
    throw new DomainError("Kustoms betalningsuppgifter matchar inte köpet.");
  }
}

export async function openKustomServicePayment(input: {
  reference: string; kind: Kind; amount: number; vat: number; email: string; deadline: string;
}, client = kustomClient) {
  const { reference, kind, amount, vat, email, deadline } = input;
  const config = kustomConfiguration();
  const line = serviceLine(kind, amount, vat);
  const secret = randomToken();
  const existing = await transaction(async () => {
    const current = await payment(reference);
    if (current) return current;
    if (deadline <= now()) throw new DomainError("Betalningstiden har gått ut.");
    await getDb().prepare(`INSERT INTO kustom_service_payments
      (reference,kind,environment,callback_hash,capture_key,line_json,deadline,checked_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(reference, kind, config.environment, tokenHash(secret), randomUUID(), JSON.stringify(line), deadline, now());
    return undefined;
  });
  if (existing) {
    if (existing.kind === kind && existing.environment === config.environment && existing.state === "open" && existing.redirect_url && String(existing.deadline) > now()) {
      return String(existing.redirect_url);
    }
    throw new DomainError("Betalningen väntar på kontroll. Återanvänd samma beställningsreferens.");
  }
  const confirmation = kind === "booking" ? `${config.origin}/bokning/bekraftelse?ref=${reference}` : `${config.origin}/kurskop/bekraftelse?session_id=kustom_${reference}`;
  const callback = `${config.origin}/api/kustom/service-push?ref=${reference}&token=${secret}`;
  const request = {
    purchase_country: "SE", purchase_currency: "SEK", locale: "sv-SE", merchant_reference1: reference,
    order_amount: amount, order_tax_amount: line.total_tax_amount, order_lines: [line], billing_address: { email },
    merchant_urls: { terms: `${config.origin}/villkor`, checkout: confirmation, confirmation, push: `${callback}&order_id={checkout.order.id}` },
    options: { auto_capture: false, verify_national_identification_number: false },
  };
  let result: unknown;
  try {
    result = await client.request("/checkout/v3/orders", "POST", request);
  } catch (error) {
    if (error instanceof KustomApiError && [400, 401, 403, 404, 422].includes(error.status)) {
      await applyResult(reference, kind, "cancelled", "");
    }
    throw error;
  }
  const order = kustomCheckoutSchema.parse(result);
  verify(order, reference, line);
  await getDb().prepare("UPDATE kustom_service_payments SET order_id=? WHERE reference=? AND (candidate_id IS NULL OR candidate_id=?)").run(order.order_id, reference, order.order_id);
  if ((await payment(reference))?.order_id !== order.order_id) throw new DomainError("Betalningsreferensen behöver kontrolleras.");
  const session = z.object({ session_id: kustomIdentifier, redirect_url: z.url() }).parse(await client.request("/hpp/v1/sessions", "POST", {
    payment_session_url: `${config.base}/checkout/v3/orders/${order.order_id}`,
    merchant_urls: { success: confirmation, cancel: confirmation, error: confirmation, failure: confirmation, status_update: callback },
  }));
  const url = new URL(session.redirect_url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid Kustom redirect");
  const updated = await getDb().prepare("UPDATE kustom_service_payments SET redirect_url=?,session_id=? WHERE reference=? AND state='open'").run(url.href, session.session_id, reference);
  if (!updated.changes) throw new DomainError("Betalningslänken är inte längre öppen.");
  if (deadline <= now()) throw new DomainError("Betalningstiden har gått ut.");
  return url.href;
}

export async function recordKustomServiceCallback(reference: string, secret: string, suppliedId: string) {
  const row = await payment(reference);
  if (!row || !equalSecret(String(row.callback_hash), tokenHash(secret))) return false;
  if (!suppliedId && !row.order_id) return true;
  const result = kustomIdentifier.safeParse(suppliedId || row.order_id);
  if (!result.success) return false;
  const update = await getDb().prepare(`UPDATE kustom_service_payments SET candidate_id=?,needs_reconcile=1
    WHERE reference=? AND (order_id IS NULL OR order_id=?) AND (candidate_id IS NULL OR candidate_id=?)`)
    .run(result.data, reference, result.data, result.data);
  return !!update.changes;
}

async function applyResult(reference: string, kind: Kind, status: "paid" | "cancelled" | "refunded", orderId: string, paidAt?: string) {
  await transaction(async () => {
    const current = await payment(reference);
    if (!current || current.state === "refunded" || (current.state !== "open" && status !== "refunded")) return;
    await getDb().prepare("UPDATE kustom_service_payments SET state=?,checked_at=?,order_id=COALESCE(order_id,?) WHERE reference=?")
      .run(status, now(), orderId || null, reference);
    if (kind === "booking") {
      if (status === "paid") {
        if (!paidAt) throw new DomainError("Kustom saknar debiteringsdatum för bokningen.");
        const updated = await getDb().prepare(`UPDATE bookings SET status='confirmed',payment_status='paid',expires_at=NULL
          WHERE reference=? AND online_payment_provider='kustom' AND status='pending' AND julianday(start)>julianday(?) RETURNING id`).get(reference, paidAt);
        if (!updated) throw new DomainError("Debiteringen behöver granskas innan bokningen kan bekräftas.");
        const { queueBookingEmails } = await import("./email-outbox");
        await queueBookingEmails(Number(updated.id));
      } else if (status === "cancelled") {
        await getDb().prepare("UPDATE bookings SET status='cancelled' WHERE reference=? AND online_payment_provider='kustom' AND status='pending'").run(reference);
      } else {
        await getDb().prepare("UPDATE bookings SET status='cancelled',payment_status='refunded',expires_at=NULL WHERE reference=? AND online_payment_provider='kustom'").run(reference);
      }
    } else {
      const { applyKustomCourseResult } = await import("./course-purchase-billing");
      await applyKustomCourseResult(reference, status, orderId, paidAt);
    }
  });
}

export async function reconcileKustomServicePayment(reference: string, client = kustomClient, cancel = false) {
  const row = await payment(reference);
  if (!row || ["refunded", "cancelled"].includes(String(row.state))) return;
  if (row.environment !== kustomConfiguration().environment) throw new DomainError("Fel betalningsmiljö.");
  const orderId = kustomIdentifier.parse(row.order_id || row.candidate_id);
  const kind = row.kind as Kind;
  const line: Line = JSON.parse(String(row.line_json));
  const path = `/ordermanagement/v1/orders/${orderId}`;
  const read = async () => {
    const result = kustomManagedOrderSchema.parse(await client.request(path));
    verify(result, reference, line, orderId);
    return result;
  };
  const expired = String(row.deadline) <= now();
  let managed;
  try { managed = await read(); }
  catch (error) {
    if (!(error instanceof KustomApiError && error.status === 404)) throw error;
    let sessionClosed = false;
    if (row.state === "open" && row.session_id && !cancel && !expired) {
      const sessionId = kustomIdentifier.parse(row.session_id);
      const session = z.object({ session_id: kustomIdentifier, status: z.string() }).parse(await client.request(`/hpp/v1/sessions/${sessionId}`));
      sessionClosed = session.session_id === sessionId && ["CANCELLED", "DISABLED"].includes(session.status);
    }
    if (row.state === "open" && (cancel || expired || sessionClosed)) {
      const checkoutPath = `/checkout/v3/orders/${orderId}`;
      if (!row.order_id) verify(kustomCheckoutSchema.parse(await client.request(checkoutPath)), reference, line, orderId);
      const aborted = kustomCheckoutSchema.parse(await client.request(`${checkoutPath}/abort`, "POST", {}));
      verify(aborted, reference, line, orderId);
      await applyResult(reference, kind, "cancelled", orderId);
    }
    return;
  }
  if (["CANCELLED", "EXPIRED"].includes(managed.status) && managed.captured_amount === 0) {
    await applyResult(reference, kind, "cancelled", orderId);
    return;
  }
  if (managed.refunded_amount > 0 && managed.refunds.reduce((sum, refund) => sum + refund.refunded_amount, 0) === managed.refunded_amount) {
    if (managed.refunded_amount !== line.total_amount || managed.captured_amount !== line.total_amount) return;
    await applyResult(reference, kind, "refunded", orderId);
    return;
  }
  if (row.state === "paid") return;
  if (managed.fraud_status !== "ACCEPTED" || managed.refunded_amount) return;
  if (managed.status === "AUTHORIZED" && (cancel || expired)) {
    await client.request(`${path}/cancel`, "POST", {}, kustomOperationKey(reference, "cancel"));
    managed = await read();
    if (["CANCELLED", "EXPIRED"].includes(managed.status) && managed.captured_amount === 0) {
      await applyResult(reference, kind, "cancelled", orderId);
    }
    return;
  }
  if (managed.status === "AUTHORIZED") {
    await client.request(`${path}/acknowledge`, "POST", {}, kustomOperationKey(reference, "acknowledge"));
    await client.request(`${path}/captures`, "POST", { captured_amount: line.total_amount, order_lines: [line] }, String(row.capture_key));
    managed = await read();
  }
  if (managed.fraud_status !== "ACCEPTED" || managed.refunded_amount || !["CAPTURED", "CLOSED"].includes(managed.status) ||
      managed.captured_amount !== line.total_amount || managed.captures.reduce((sum, capture) => sum + capture.captured_amount, 0) !== line.total_amount) return;
  await applyResult(reference, kind, "paid", orderId, managed.captures.map(capture => capture.captured_at).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1));
}

export async function cancelKustomServicePayment(reference: string) {
  await reconcileKustomServicePayment(reference, kustomClient, true);
  if ((await payment(reference))?.state !== "cancelled") throw new DomainError("Betalningen behöver kontrolleras hos Kustom innan köpet kan avbrytas.");
}
