import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, getBookingById, getSettings, transaction, type Booking } from "./db";
import { emailAppUrl, emailConfigurationStatus, requireEmailConfiguration, sendEmail } from "./email-provider";
import { renderEmailTemplate } from "./email-template";
import { formatDateTime } from "./time";
import { anamnesPreparation } from "./booking-details";
import { bookingCancellationText, type CancellationDecision } from "./booking-cancellation-policy";

export type BookingEmailState = "pending" | "sending" | "sent" | "failed" | "skipped";
export type BookingEmailDelivery = { status: BookingEmailState; attempts: number; sentAt: string | null };
export type BookingEmailStatus = { configured: boolean; customer: BookingEmailDelivery | null; admin: BookingEmailDelivery | null };
const MAX_ATTEMPTS = 5;
// Resend retains idempotency keys for 24h. Never retry an uncertain delivery
// beyond 23h from the first attempt, even after a crash or manual request.
const RETRY_WINDOW = 23 * 60 * 60 * 1000;
type BookingEmailEvent = "confirmation" | "cancellation";
const emailTables = {
  confirmation: "booking_email_outbox",
  cancellation: "booking_cancellation_email_outbox",
} as const;

export async function queueBookingEmails(bookingId: number): Promise<void> {
  await transaction(async () => {
    const booking = await getBookingById(bookingId);
    if (!booking || booking.status !== "confirmed" || (booking.paymentMethod !== "onsite" && booking.paymentStatus !== "paid")) return;
    let origin: string;
    try { origin = emailAppUrl(); } catch { return; }
    const settings = await getSettings();
    const now = new Date().toISOString();
    const confirmation = new URL("/bokning/bekraftelse", origin);
    confirmation.searchParams.set("ref", booking.reference);
    const remoteInfo = booking.deliveryMode === "remote" ? "Mötet sker på distans. Behandlaren lägger till möteslänken på din privata bokningssida.\n\n" : "";
    const customerText = `Din tid hos Tibb.nu är bokad.\n\nTid: ${formatDateTime(booking.start)}\n\n${remoteInfo}Uppgifter om plats och betalning finns på din privata bokningssida:\n${confirmation}\n\n${anamnesPreparation(booking.start)}\nFyll i och skicka anamnesen här:\n${new URL("/anamnes", origin)}\n\nSpara bokningslänken och dela den inte. Kontakta verksamheten via hemsidan om du behöver ändra bokningen.`;
    const notify = process.env.EMAIL_NOTIFICATION_TO?.trim() || settings.email;
    const recipients: { audience: "customer" | "admin"; email: string; subject: string; body: string }[] = [
      { audience: "customer", email: booking.email, subject: "Din bokningsbekräftelse från Tibb.nu", body: customerText },
      ...(z.email().safeParse(notify).success ? [{ audience: "admin" as const, email: notify, subject: "Ny bokning hos Tibb.nu",
        body: `En ny bokning är bekräftad.\n\nTid: ${formatDateTime(booking.start)}\n\nLogga in för att se uppgifterna:\n${origin}/admin/bokningar/${booking.id}` }] : []),
    ];
    for (const recipient of recipients) await getDb().prepare(
      "INSERT INTO booking_email_outbox(id,booking_id,audience,recipient,subject,body,created_at,next_attempt_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(booking_id,audience) DO NOTHING",
    ).run(randomUUID(), booking.id, recipient.audience, recipient.email, recipient.subject, recipient.body, now, now);
  });
}
export async function queueBookingCancellationEmails(booking: Booking, decision: CancellationDecision, requestedAt: string) {
  let origin: string;
  try { origin = emailAppUrl(); } catch { return; }
  const settings = await getSettings();
  const notify = process.env.EMAIL_NOTIFICATION_TO?.trim() || settings.email;
  const customerPage = new URL("/bokning/bekraftelse", origin);
  customerPage.searchParams.set("ref", booking.reference);
  const summary = `Din bokade tid har avbokats.\n\nTid: ${formatDateTime(booking.start)}\n\n${bookingCancellationText(decision, booking.priceOre)}`;
  const recipients = [
    { audience: "customer", recipient: booking.email, subject: "Din bokning hos Tibb.nu är avbokad", body: `${summary}\n\n${customerPage}` },
    ...(z.email().safeParse(notify).success ? [{
      audience: "admin", recipient: notify, subject: "En bokning hos Tibb.nu har avbokats",
      body: `En bokad tid har avbokats.\n\nTid: ${formatDateTime(booking.start)}\n\n${bookingCancellationText(decision, booking.priceOre)}\n\n${origin}/admin/bokningar/${booking.id}`,
    }] : []),
  ];
  for (const message of recipients) {
    await getDb().prepare(`INSERT INTO booking_cancellation_email_outbox(id,booking_id,audience,recipient,subject,body,created_at,next_attempt_at)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(booking_id,audience) DO NOTHING`)
      .run(randomUUID(), booking.id, message.audience, message.recipient, message.subject, message.body, requestedAt, requestedAt);
  }
}

export async function getBookingEmailStatus(bookingId: number, event: BookingEmailEvent = "confirmation"): Promise<BookingEmailStatus> {
  const result: BookingEmailStatus = { configured: emailConfigurationStatus().configured, customer: null, admin: null };
  const rows = await getDb().prepare(`SELECT audience,status,attempts,sent_at FROM ${emailTables[event]} WHERE booking_id=?`).all(bookingId);
  for (const row of rows) result[row.audience as "customer" | "admin"] = {
    status: row.status as BookingEmailState, attempts: Number(row.attempts), sentAt: row.sent_at ? String(row.sent_at) : null,
  };
  return result;
}
async function claim(id: string, event: BookingEmailEvent, { from, origin }: ReturnType<typeof requireEmailConfiguration>) {
  return transaction(async () => {
    const table = emailTables[event];
    const now = new Date().toISOString();
    const job = await getDb().prepare(
      `SELECT o.*,b.status AS booking_status,b.payment_method,b.payment_status,b.start FROM ${table} o JOIN bookings b ON b.id=o.booking_id WHERE o.id=? AND ((o.status='pending' AND o.next_attempt_at<=?) OR (o.status='sending' AND o.lease_until<=?))`,
    ).get(id, now, now);
    if (!job) return null;
    const valid = event === "cancellation" ? job.booking_status === "cancelled"
      : job.booking_status === "confirmed" && (job.payment_method !== "stripe" || job.payment_status === "paid") && String(job.start) > now;
    if (!valid) {
      await getDb().prepare(`UPDATE ${table} SET status='skipped',lease_until=NULL,lease_token=NULL WHERE id=?`).run(id);
      return null;
    }
    if (Number(job.attempts) >= MAX_ATTEMPTS || (job.first_attempt_at && Date.parse(String(job.first_attempt_at)) + RETRY_WINDOW <= Date.now())) {
      await getDb().prepare(`UPDATE ${table} SET status='failed',lease_until=NULL,lease_token=NULL WHERE id=?`).run(id);
      return null;
    }
    const lease = randomUUID();
    const text = String(job.body);
    // Preserve the exact request when retrying, including jobs first sent before HTML was added.
    const title = event === "cancellation" ? "Bokningen är avbokad" : job.audience === "customer" ? "Din tid är bokad" : "Ny bekräftad bokning";
    const html = Number(job.attempts) === 0
      ? renderEmailTemplate({ title, text, origin })
      : job.html === null ? null : String(job.html);
    await getDb().prepare(
      `UPDATE ${table} SET status='sending',sender=COALESCE(sender,?),html=?,attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),lease_until=?,lease_token=? WHERE id=?`,
    ).run(from, html, now, new Date(Date.now() + 90000).toISOString(), lease, id);
    return { id, lease, from: String(job.sender || from), to: String(job.recipient), subject: String(job.subject), text, html, attempts: Number(job.attempts) + 1 };
  });
}
export async function dispatchBookingEmailOutbox(options: { bookingId?: number; limit?: number; event?: BookingEmailEvent } = {}) {
  const status = emailConfigurationStatus();
  if (!status.configured) return { configured: false, processed: 0, sent: 0, failed: 0 };
  const config = requireEmailConfiguration();
  const event = options.event ?? "confirmation";
  const table = emailTables[event];
  const limit = Math.max(1, Math.min(10, options.limit ?? 10));
  const now = new Date().toISOString();
  const jobs = await getDb().prepare(
    `SELECT id FROM ${table} WHERE ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?))${options.bookingId === undefined ? "" : " AND booking_id=?"} ORDER BY created_at,id LIMIT ?`,
  ).all(now, now, ...(options.bookingId === undefined ? [] : [options.bookingId]), limit);
  const result = { configured: true, processed: 0, sent: 0, failed: 0 };
  // At most two requests concurrently; no network request holds a DB lock.
  async function deliver(id: string) {
    const job = await claim(id, event, config);
    if (!job) return;
    result.processed++;
    try {
      const providerId = await sendEmail({ ...job, idempotencyKey: `booking-email-${job.id}` });
      await getDb().prepare(`UPDATE ${table} SET status='sent',sent_at=?,provider_id=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?`)
        .run(new Date().toISOString(), providerId, job.id, job.lease);
      result.sent++;
    } catch {
      await getDb().prepare(`UPDATE ${table} SET status=?,next_attempt_at=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?`)
        .run(job.attempts >= MAX_ATTEMPTS ? "failed" : "pending", new Date(Date.now() + Math.pow(2, job.attempts - 1) * 60000).toISOString(), job.id, job.lease);
      result.failed++;
    }
  }
  for (let offset = 0; offset < jobs.length; offset += 2)
    await Promise.all(jobs.slice(offset, offset + 2).map((job) => deliver(String(job.id))));
  return result;
}
