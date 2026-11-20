import { randomUUID } from "node:crypto";
import { assertAdmin } from "./admin";
import { DomainError, getDb, transaction } from "./db";
import { emailConfigurationStatus, requireEmailConfiguration, sendEmail } from "./email-provider";
import { renderEmailTemplate } from "./email-template";
import { getWellnessPdf } from "./wellness-pdf";

function receiptMessage(kind: string) {
  if (kind === "correction") {
    return {
      title: "Korrigerat friskvårdsunderlag",
      subject: "Korrigerat friskvårdsunderlag från Tibb.nu",
      text: "Bifogat finns ett separat korrigeringsunderlag till ditt tidigare friskvårdskvitto. Spara båda underlagen och meddela din arbetsgivare om du redan har lämnat in det ursprungliga kvittot.",
    };
  }
  return {
    title: "Ditt friskvårdskvitto",
    subject: "Ditt friskvårdskvitto från Tibb.nu",
    text: "Tack för ditt köp av friskvård hos Tibb.nu. Ditt personliga klippkort är aktiverat. Bifogat finns kvittot med tjänsterna, betalningen och respektive giltighetstid. Arbetsgivaren avgör om ersättning beviljas. Du är varmt välkommen att boka dina tillfällen.",
  };
}

export async function resendWellnessReceipt(actorId: number, receiptId: string) {
  await transaction(async () => {
    await assertAdmin(actorId);
    const receipt = await getDb().prepare(`SELECT r.snapshot_json,v.correction_id FROM wellness_receipts r
      LEFT JOIN wellness_order_voids v ON v.order_reference=r.order_reference WHERE r.id=?`).get(receiptId);
    if (!receipt) throw new DomainError("Kvittot finns inte.");
    if (receipt.correction_id && receipt.correction_id !== receiptId) throw new DomainError("Det makulerade originalet kan inte skickas igen. Välj korrigeringsunderlaget.");
    const recipient = JSON.parse(String(receipt.snapshot_json)).customer.email;
    const id = randomUUID(); const now = new Date().toISOString();
    await getDb().prepare("INSERT INTO wellness_email_outbox(id,receipt_id,event_key,recipient,next_attempt_at,created_at) VALUES(?,?,?,?,?,?)")
      .run(id, receiptId, `resend:${id}`, recipient, now, now);
  });
}
export async function dispatchWellnessEmails(options: { reference?: string; limit?: number } = {}) {
  const result = { configured: emailConfigurationStatus().configured, sent: 0, failed: 0 };
  if (!result.configured) return result;
  const { from, origin } = requireEmailConfiguration();
  const now = new Date().toISOString();
  const rows = await getDb().prepare(`SELECT e.id FROM wellness_email_outbox e JOIN wellness_receipts r ON r.id=e.receipt_id WHERE ((e.status='pending' AND e.next_attempt_at<=?) OR (e.status='sending' AND e.lease_until<=?)) ${options.reference ? "AND r.order_reference=?" : ""} ORDER BY e.created_at LIMIT ?`)
    .all(now, now, ...(options.reference ? [options.reference] : []), Math.min(10, options.limit ?? 5));
  for (const row of rows) {
    const job = await transaction(async () => {
      const record = await getDb().prepare("SELECT e.*,r.number,r.kind FROM wellness_email_outbox e JOIN wellness_receipts r ON r.id=e.receipt_id WHERE e.id=? AND ((e.status='pending' AND e.next_attempt_at<=?) OR (e.status='sending' AND e.lease_until<=?))").get(String(row.id), now, now);
      if (!record) return;
      if (Number(record.attempts) >= 5 || (record.first_attempt_at && Date.parse(String(record.first_attempt_at)) + 23 * 3600000 <= Date.now())) {
        await getDb().prepare("UPDATE wellness_email_outbox SET status='failed' WHERE id=?").run(String(row.id)); return;
      }
      const lease = randomUUID();
      const { title, subject, text } = receiptMessage(String(record.kind));
      const html = Number(record.attempts) === 0
        ? renderEmailTemplate({ title, text, origin })
        : record.html === null ? null : String(record.html);
      const sender = String(record.sender || from);
      await getDb().prepare("UPDATE wellness_email_outbox SET status='sending',sender=?,html=?,attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),lease_token=?,lease_until=? WHERE id=?")
        .run(sender, html, now, lease, new Date(Date.now() + 90000).toISOString(), String(row.id));
      return { id: String(record.id), receiptId: String(record.receipt_id), to: String(record.recipient),
        number: String(record.number), attempts: Number(record.attempts), lease, from: sender, subject, text, html };
    });
    if (!job) continue;
    try {
      const pdf = await getWellnessPdf(job.receiptId);
      await sendEmail({ ...job,
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
