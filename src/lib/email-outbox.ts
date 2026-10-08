import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, getBookingById, getSettings, transaction } from "./db";
import { emailAppUrl, emailConfigurationStatus, requireEmailConfiguration, sendEmail } from "./email-provider";
import { formatDateTime } from "./time";

export type BookingEmailState = "pending" | "sending" | "sent" | "failed" | "skipped";
export type BookingEmailDelivery = { status: BookingEmailState; attempts: number; sentAt: string | null };
export type BookingEmailStatus = { configured: boolean; customer: BookingEmailDelivery | null; admin: BookingEmailDelivery | null };
const MAX_ATTEMPTS = 5;
// Resend retains idempotency keys for 24h. Never retry an uncertain delivery
// beyond 23h from the first attempt, even after a crash or manual request.
const RETRY_WINDOW = 23 * 60 * 60 * 1000;

export async function queueBookingEmails(bookingId: number): Promise<void> {
  await transaction(async () => {
    const booking = await getBookingById(bookingId);
    if (!booking || booking.status !== "confirmed" || (booking.paymentMethod === "stripe" && booking.paymentStatus !== "paid")) return;
    let origin: string;
    try { origin = emailAppUrl(); } catch { return; }
    const settings = await getSettings();
    const now = new Date().toISOString();
    const confirmation = new URL("/bokning/bekraftelse", origin);
    confirmation.searchParams.set("ref", booking.reference);
    const customerText = `Din tid hos Tibb.nu är bokad.\n\nTid: ${formatDateTime(booking.start)}\n\nUppgifter om plats och betalning finns på din privata bokningssida:\n${confirmation}\n\nSpara länken och dela den inte. Kontakta verksamheten via hemsidan om du behöver ändra bokningen.`;
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
export async function getBookingEmailStatus(bookingId: number): Promise<BookingEmailStatus> {
  const result: BookingEmailStatus = { configured: emailConfigurationStatus().configured, customer: null, admin: null };
  const rows = await getDb().prepare("SELECT audience,status,attempts,sent_at FROM booking_email_outbox WHERE booking_id=?").all(bookingId);
  for (const row of rows) result[row.audience as "customer" | "admin"] = {
    status: row.status as BookingEmailState, attempts: Number(row.attempts), sentAt: row.sent_at ? String(row.sent_at) : null,
  };
  return result;
}
async function claim(id: string, from: string) {
  return transaction(async () => {
    const now = new Date().toISOString();
    const job = await getDb().prepare(
      "SELECT o.*,b.status AS booking_status,b.payment_method,b.payment_status,b.start FROM booking_email_outbox o JOIN bookings b ON b.id=o.booking_id WHERE o.id=? AND ((o.status='pending' AND o.next_attempt_at<=?) OR (o.status='sending' AND o.lease_until<=?))",
    ).get(id, now, now);
    if (!job) return null;
    if (job.booking_status !== "confirmed" || (job.payment_method === "stripe" && job.payment_status !== "paid") || String(job.start) <= now) {
      await getDb().prepare("UPDATE booking_email_outbox SET status='skipped',lease_until=NULL,lease_token=NULL WHERE id=?").run(id);
      return null;
    }
    if (Number(job.attempts) >= MAX_ATTEMPTS || (job.first_attempt_at && Date.parse(String(job.first_attempt_at)) + RETRY_WINDOW <= Date.now())) {
      await getDb().prepare("UPDATE booking_email_outbox SET status='failed',lease_until=NULL,lease_token=NULL WHERE id=?").run(id);
      return null;
    }
    const lease = randomUUID();
    await getDb().prepare(
      "UPDATE booking_email_outbox SET status='sending',sender=COALESCE(sender,?),attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),lease_until=?,lease_token=? WHERE id=?",
    ).run(from, now, new Date(Date.now() + 90000).toISOString(), lease, id);
    return { id, lease, from: String(job.sender || from), to: String(job.recipient), subject: String(job.subject), text: String(job.body), attempts: Number(job.attempts) + 1 };
  });
}
export async function dispatchBookingEmailOutbox(options: { bookingId?: number; limit?: number } = {}) {
  const status = emailConfigurationStatus();
  if (!status.configured) return { configured: false, processed: 0, sent: 0, failed: 0 };
  const { from } = requireEmailConfiguration();
  const limit = Math.max(1, Math.min(10, options.limit ?? 10));
  const now = new Date().toISOString();
  const jobs = await getDb().prepare(
    `SELECT id FROM booking_email_outbox WHERE ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?))${options.bookingId === undefined ? "" : " AND booking_id=?"} ORDER BY created_at,id LIMIT ?`,
  ).all(now, now, ...(options.bookingId === undefined ? [] : [options.bookingId]), limit);
  const result = { configured: true, processed: 0, sent: 0, failed: 0 };
  // At most two requests concurrently; no network request holds a DB lock.
  async function deliver(id: string) {
    const job = await claim(id, from);
    if (!job) return;
    result.processed++;
    try {
      const providerId = await sendEmail({ ...job, idempotencyKey: `booking-email-${job.id}` });
      await getDb().prepare("UPDATE booking_email_outbox SET status='sent',sent_at=?,provider_id=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?")
        .run(new Date().toISOString(), providerId, job.id, job.lease);
      result.sent++;
    } catch {
      await getDb().prepare("UPDATE booking_email_outbox SET status=?,next_attempt_at=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?")
        .run(job.attempts >= MAX_ATTEMPTS ? "failed" : "pending", new Date(Date.now() + Math.pow(2, job.attempts - 1) * 60000).toISOString(), job.id, job.lease);
      result.failed++;
    }
  }
  for (let offset = 0; offset < jobs.length; offset += 2)
    await Promise.all(jobs.slice(offset, offset + 2).map((job) => deliver(String(job.id))));
  return result;
}
