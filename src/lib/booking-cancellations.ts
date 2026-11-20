import { randomUUID } from "node:crypto";
import { bookingCancellationDecision, type CancellationDecision } from "./booking-cancellation-policy";
import { getBookingTerms, getBusinessSettings } from "./business-settings";
import { cancelPendingBooking, DomainError, getBookingById, getBookingByReference, getDb, refundStripeBooking, transaction, type Booking } from "./db";
import { dispatchBookingEmailOutbox, queueBookingCancellationEmails } from "./email-outbox";
import { reconcileKustomServicePayment, refundKustomBooking } from "./kustom-service-payments";
import { getStripe } from "./stripe";

const maxRefundAttempts = 5;
const refundRetryWindow = 23 * 60 * 60 * 1000;
type CancellationSource = "customer" | "admin";

export async function getBookingCancellation(bookingId: number) {
  const row = await getDb().prepare("SELECT decision,requested_at,refund_attempts FROM booking_cancellations WHERE booking_id=?").get(bookingId);
  return row ? {
    decision: row.decision as CancellationDecision,
    requestedAt: String(row.requested_at),
    attempts: Number(row.refund_attempts),
  } : null;
}

export async function getBookingCancellationHours(reference: string) {
  return (await getBookingTerms(reference))?.cancellationHours ?? (await getBusinessSettings()).cancellationHours;
}

export async function requestBookingCancellation(
  reference: string, source: CancellationSource, displayedDecision?: CancellationDecision,
) {
  const requested = new Date();
  const initial = await getBookingByReference(reference);
  if (!initial) throw new DomainError("Bokningen finns inte.");
  if (await getBookingCancellation(initial.id)) return initial.id;
  if (initial.status === "completed" || initial.status === "cancelled" ||
      (source === "customer" && (initial.status !== "confirmed" || Date.parse(initial.start) <= requested.getTime()))) {
    throw new DomainError("Bokningen kan inte avbokas här.");
  }

  if (initial.status === "pending" && initial.paymentMethod === "kustom")
    await reconcileKustomServicePayment(reference, undefined, "cancel");
  if (initial.status === "pending" && initial.paymentMethod === "stripe" && initial.checkoutSessionId) {
    await getStripe().checkout.sessions.expire(initial.checkoutSessionId);
    await cancelPendingBooking(reference);
  }

  return transaction(async () => {
    const booking = await getBookingByReference(reference);
    if (!booking) throw new DomainError("Bokningen finns inte.");
    if (await getBookingCancellation(booking.id)) return booking.id;
    const pendingWithoutCheckout = initial.status === "pending" && booking.status === "pending" &&
      booking.paymentMethod === "stripe" && !booking.checkoutSessionId;
    const closedReservation = initial.status === "pending" && booking.status === "cancelled";
    if (booking.status !== "confirmed" && !pendingWithoutCheckout && !closedReservation)
      throw new DomainError("Bokningens betalning behöver kontrolleras innan tiden kan avbokas.");
    const hours = await getBookingCancellationHours(reference);
    const decision = bookingCancellationDecision(booking, hours, requested.getTime());
    if (displayedDecision && displayedDecision !== decision)
      throw new DomainError("Villkoret för återbetalning har ändrats. Kontrollera beloppet innan du avbokar igen.");
    const requestedAt = requested.toISOString();
    const providerRefund = decision === "refund" && booking.paymentStatus === "paid" && booking.paymentMethod !== "onsite";
    await getDb().prepare(`INSERT INTO booking_cancellations(booking_id,source,decision,requested_at,refund_key,refund_next_attempt_at)
      VALUES(?,?,?,?,?,?)`).run(booking.id, source, decision, requestedAt, randomUUID(), providerRefund ? requestedAt : null);
    await getDb().prepare("UPDATE bookings SET status='cancelled',expires_at=NULL WHERE id=?").run(booking.id);
    await queueBookingCancellationEmails(booking, decision, requestedAt);
    return booking.id;
  });
}

async function refundStripe(booking: Booking, key: string, allowWrite: boolean) {
  if (!booking.checkoutSessionId) throw new DomainError("Kortbetalningens referens saknas.");
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(booking.checkoutSessionId, { expand: ["payment_intent.latest_charge"] });
  const intent = session.payment_intent;
  const charge = intent && typeof intent === "object" ? intent.latest_charge : null;
  if (!charge || typeof charge !== "object" || session.payment_status !== "paid" ||
      session.amount_total !== booking.priceOre || session.currency !== "sek" ||
      charge.amount_captured !== booking.priceOre || charge.currency !== "sek")
    throw new DomainError("Kortbetalningen matchar inte bokningen.");
  if (charge.refunded && charge.amount_refunded === booking.priceOre) {
    await refundStripeBooking(booking.checkoutSessionId);
    return true;
  }
  if (!allowWrite || charge.amount_refunded !== 0) return false;
  const refund = await stripe.refunds.create({ charge: charge.id, amount: booking.priceOre }, { idempotencyKey: key });
  if (refund.status !== "succeeded" || refund.amount !== booking.priceOre || refund.currency !== "sek") return false;
  await refundStripeBooking(booking.checkoutSessionId);
  return true;
}

async function claimBookingRefund(bookingId: number, verifyOnly: boolean) {
  return transaction(async () => {
    const now = new Date();
    const iso = now.toISOString();
    const booking = await getBookingById(bookingId);
    if (!booking || booking.status !== "cancelled" || booking.paymentStatus !== "paid" || booking.paymentMethod === "onsite")
      return null;
    const row = await getDb().prepare(`SELECT * FROM booking_cancellations WHERE booking_id=? AND decision='refund'
      AND (refund_lease_until IS NULL OR refund_lease_until<=?)`).get(bookingId, iso);
    if (!row || (!verifyOnly && (!row.refund_next_attempt_at || String(row.refund_next_attempt_at) > iso))) return null;
    const attempts = Number(row.refund_attempts);
    const allowWrite = !verifyOnly && attempts < maxRefundAttempts &&
      (!row.refund_first_attempt_at || Date.parse(String(row.refund_first_attempt_at)) + refundRetryWindow > now.getTime());
    const lease = randomUUID();
    await getDb().prepare(`UPDATE booking_cancellations SET refund_lease_token=?,refund_lease_until=?,
      refund_attempts=refund_attempts+?,refund_first_attempt_at=COALESCE(refund_first_attempt_at,?) WHERE booking_id=?`)
      .run(lease, new Date(now.getTime() + 90000).toISOString(), allowWrite ? 1 : 0, allowWrite ? iso : null, bookingId);
    return { booking, lease, key: String(row.refund_key), allowWrite, attempts: attempts + Number(allowWrite) };
  });
}

export async function dispatchBookingRefund(bookingId: number, verifyOnly = false) {
  const job = await claimBookingRefund(bookingId, verifyOnly);
  if (!job) return false;
  let completed = false;
  try {
    completed = job.booking.paymentMethod === "kustom"
      ? await refundKustomBooking(job.booking, job.key, job.allowWrite)
      : await refundStripe(job.booking, job.key, job.allowWrite);
    return completed;
  } catch {
    console.error("Booking refund could not be verified", { provider: job.booking.paymentMethod });
    return false;
  } finally {
    const next = !completed && job.allowWrite && job.attempts < maxRefundAttempts
      ? new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60000).toISOString() : null;
    await getDb().prepare(`UPDATE booking_cancellations SET refund_lease_token=NULL,refund_lease_until=NULL,
      refund_next_attempt_at=CASE WHEN ? THEN refund_next_attempt_at ELSE ? END WHERE booking_id=? AND refund_lease_token=?`)
      .run(verifyOnly && !completed ? 1 : 0, next, bookingId, job.lease);
  }
}

export async function dispatchDueBookingRefunds(limit = 2) {
  const due = await getDb().prepare(`SELECT c.booking_id FROM booking_cancellations c JOIN bookings b ON b.id=c.booking_id
    WHERE c.refund_next_attempt_at<=? AND b.payment_status='paid' ORDER BY c.refund_next_attempt_at LIMIT ?`).all(new Date().toISOString(), limit);
  let refunded = 0;
  for (const row of due) if (await dispatchBookingRefund(Number(row.booking_id))) refunded++;
  return refunded;
}

export async function processBookingCancellation(bookingId: number) {
  await Promise.allSettled([
    dispatchBookingRefund(bookingId),
    dispatchBookingEmailOutbox({ bookingId, event: "cancellation", limit: 2 }),
  ]);
}
