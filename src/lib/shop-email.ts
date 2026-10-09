import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, getSettings, transaction } from "./db";
import { getShopOrderById } from "./shop";
import { emailAppUrl, emailConfigurationStatus, requireEmailConfiguration, sendEmail } from "./email-provider";
const RETRY_WINDOW = 23 * 60 * 60 * 1000;
type Delivery = { status: "pending" | "sending" | "sent" | "failed" | "skipped"; attempts: number };

export async function queueShopOrderEmails(orderId: number) {
  await transaction(async () => {
    const order = await getShopOrderById(orderId);
    if (!order || order.status !== "paid" || order.paymentStatus !== "paid") return;
    let origin: string;
    try { origin = emailAppUrl(); } catch { return; }
    const settings = await getSettings();
    const notification = process.env.EMAIL_NOTIFICATION_TO?.trim() || settings.email;
    const messages = [
      { audience: "customer", recipient: order.email, subject: "Din beställning hos Tibb.nu är betald",
        body: `Tack för din beställning. Betalningen är bekräftad.\n\nDin privata beställningssida:\n${origin}/bestallning/bekraftelse?ref=${order.reference}\n\nSpara länken och dela den inte. Kontaktuppgifter finns på hemsidan.` },
      ...(z.email().safeParse(notification).success ? [{ audience: "admin", recipient: notification, subject: "Ny betald beställning hos Tibb.nu", body: `En ny beställning är betald.\n\nLogga in för att hantera den:\n${origin}/admin/bestallningar/${order.id}` }] : []),
    ];
    const now = new Date().toISOString();
    for (const message of messages) await getDb().prepare("INSERT INTO shop_email_outbox(id,order_id,audience,recipient,subject,body,created_at,next_attempt_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(order_id,audience) DO NOTHING")
      .run(randomUUID(), order.id, message.audience, message.recipient, message.subject, message.body, now, now);
  });
}

export async function getShopOrderEmailStatus(orderId: number) {
  const result: { configured: boolean; customer: Delivery | null; admin: Delivery | null } = { configured: emailConfigurationStatus().configured, customer: null, admin: null };
  for (const row of await getDb().prepare("SELECT audience,status,attempts FROM shop_email_outbox WHERE order_id=?").all(orderId))
    result[row.audience as "customer" | "admin"] = { status: row.status as Delivery["status"], attempts: Number(row.attempts) };
  return result;
}

async function claim(id: string, sender: string) {
  return transaction(async () => {
    const now = new Date().toISOString();
    const job = await getDb().prepare("SELECT e.*,o.status AS order_status,o.payment_status FROM shop_email_outbox e JOIN shop_orders o ON o.id=e.order_id WHERE e.id=? AND ((e.status='pending' AND e.next_attempt_at<=?) OR (e.status='sending' AND e.lease_until<=?))").get(id, now, now);
    if (!job) return null;
    if (job.order_status !== "paid" || job.payment_status !== "paid") {
      await getDb().prepare("UPDATE shop_email_outbox SET status='skipped',lease_token=NULL,lease_until=NULL WHERE id=?").run(id);
      return null;
    }
    if (Number(job.attempts) >= 5 || (job.first_attempt_at && Date.parse(String(job.first_attempt_at)) + RETRY_WINDOW <= Date.now())) {
      await getDb().prepare("UPDATE shop_email_outbox SET status='failed',lease_token=NULL,lease_until=NULL WHERE id=?").run(id);
      return null;
    }
    const lease = randomUUID();
    await getDb().prepare("UPDATE shop_email_outbox SET status='sending',sender=COALESCE(sender,?),attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),lease_until=?,lease_token=? WHERE id=?")
      .run(sender, now, new Date(Date.now() + 90000).toISOString(), lease, id);
    return { id, lease, from: String(job.sender || sender), to: String(job.recipient), subject: String(job.subject), text: String(job.body), attempts: Number(job.attempts) + 1 };
  });
}

export async function dispatchShopOrderEmails(options: { orderId?: number; limit?: number } = {}) {
  const result = { configured: emailConfigurationStatus().configured, processed: 0, sent: 0, failed: 0 };
  if (!result.configured) return result;
  const { from } = requireEmailConfiguration();
  const now = new Date().toISOString();
  const rows = await getDb().prepare(`SELECT id FROM shop_email_outbox WHERE ((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?))${options.orderId === undefined ? "" : " AND order_id=?"} ORDER BY created_at,id LIMIT ?`)
    .all(now, now, ...(options.orderId === undefined ? [] : [options.orderId]), Math.max(1, Math.min(10, options.limit ?? 10)));
  async function deliver(id: string) {
    const job = await claim(id, from);
    if (!job) return;
    result.processed++;
    try {
      const providerId = await sendEmail({ ...job, idempotencyKey: `shop-order-${id}` });
      await getDb().prepare("UPDATE shop_email_outbox SET status='sent',sent_at=?,provider_id=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?").run(new Date().toISOString(), providerId, id, job.lease);
      result.sent++;
    } catch {
      await getDb().prepare("UPDATE shop_email_outbox SET status=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?")
        .run(job.attempts >= 5 ? "failed" : "pending", new Date(Date.now() + 2 ** (job.attempts - 1) * 60000).toISOString(), id, job.lease);
      result.failed++;
    }
  }
  for (let i = 0; i < rows.length; i += 2) await Promise.all(rows.slice(i, i + 2).map(row => deliver(String(row.id))));
  return result;
}
