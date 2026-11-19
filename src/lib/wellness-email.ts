import { randomUUID } from "node:crypto";
import { assertAdmin } from "./admin";
import { DomainError, getDb, transaction } from "./db";
import { emailConfigurationStatus, sendEmail } from "./email-provider";
import { getWellnessPdf } from "./wellness-pdf";

export async function resendWellnessReceipt(actorId: number, receiptId: string) {
  await assertAdmin(actorId);
  const receipt = await getDb().prepare("SELECT snapshot_json FROM wellness_receipts WHERE id=?").get(receiptId);
  if (!receipt) throw new DomainError("Kvittot finns inte.");
  const recipient = JSON.parse(String(receipt.snapshot_json)).customer.email;
  const id = randomUUID(); const now = new Date().toISOString();
  await getDb().prepare("INSERT INTO wellness_email_outbox(id,receipt_id,event_key,recipient,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)")
    .run(id, receiptId, `resend:${id}`, recipient, now, now);
}
export async function dispatchWellnessEmails(options: { reference?: string; limit?: number } = {}) {
  const result = { configured: emailConfigurationStatus().configured, sent: 0, failed: 0 };
  if (!result.configured) return result;
  const now = new Date().toISOString();
  const rows = await getDb().prepare(`SELECT e.id FROM wellness_email_outbox e JOIN wellness_receipts r ON r.id=e.receipt_id WHERE ((e.status='pending' AND e.next_attempt_at<=?) OR (e.status='sending' AND e.lease_until<=?)) ${options.reference ? "AND r.order_reference=?" : ""} ORDER BY e.created_at LIMIT ?`)
    .all(now, now, ...(options.reference ? [options.reference] : []), Math.min(10, options.limit ?? 5));
  for (const row of rows) {
    const job = await transaction(async () => {
      const record = await getDb().prepare("SELECT e.*,r.number,r.kind,r.snapshot_json FROM wellness_email_outbox e JOIN wellness_receipts r ON r.id=e.receipt_id WHERE e.id=? AND ((e.status='pending' AND e.next_attempt_at<=?) OR (e.status='sending' AND e.lease_until<=?))").get(String(row.id), now, now);
      if (!record) return;
      if (Number(record.attempts) >= 5 || (record.first_attempt_at && Date.parse(String(record.first_attempt_at)) + 23 * 3600000 <= Date.now())) {
        await getDb().prepare("UPDATE wellness_email_outbox SET status='failed' WHERE id=?").run(String(row.id)); return;
      }
      const lease = randomUUID();
      await getDb().prepare("UPDATE wellness_email_outbox SET status='sending',attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),lease_token=?,lease_until=? WHERE id=?")
        .run(now, lease, new Date(Date.now() + 90000).toISOString(), String(row.id));
      return { id: String(record.id), receipt_id: String(record.receipt_id), kind: String(record.kind),
        recipient: String(record.recipient), number: String(record.number), attempts: Number(record.attempts), lease };
    });
    if (!job) continue;
    try {
      const pdf = await getWellnessPdf(String(job.receipt_id));
      const correction = job.kind === "correction";
      await sendEmail({ to: String(job.recipient), subject: correction ? "Korrigerat friskvårdsunderlag från Tibb.nu" : "Ditt friskvårdskvitto från Tibb.nu",
        text: correction ? "Bifogat finns ett separat korrigeringsunderlag till ditt tidigare friskvårdskvitto. Spara båda underlagen och meddela din arbetsgivare om du redan har lämnat in det ursprungliga kvittot." : "Tack för ditt köp av friskvård hos Tibb.nu. Ditt personliga klippkort är aktiverat. Bifogat finns kvittot med tjänsterna, betalningen och respektive giltighetstid. Arbetsgivaren avgör om ersättning beviljas. Du är varmt välkommen att boka dina tillfällen.",
        idempotencyKey: `wellness-${job.id}`, attachments: [{ filename: `${job.number}.pdf`, content: Buffer.from(pdf).toString("base64") }] });
      await getDb().prepare("UPDATE wellness_email_outbox SET status='sent',sent_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?")
        .run(new Date().toISOString(), String(job.id), job.lease); result.sent++;
    } catch {
      await getDb().prepare("UPDATE wellness_email_outbox SET status=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?")
        .run(Number(job.attempts) >= 4 ? "failed" : "pending", new Date(Date.now() + 60000 * 2 ** Number(job.attempts)).toISOString(), String(job.id), job.lease); result.failed++;
    }
  }
  return result;
}
