import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertAdmin } from "./admin";
import { DomainError, getDb, getSettings, transaction } from "./db";
import { equalSecret } from "./security";
import { getShopOrderByReference } from "./shop";
import { formatDateTime } from "./time";

export const withdrawalInput = z.object({
  reference: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/),
  name: z.string().trim().min(2).max(100).regex(/^[^\r\n]+$/),
  email: z.email().trim().max(254),
  confirmed: z.literal(true),
});

export function withdrawalReceiptText(reference: string, receivedAt: string) {
  return `Vi tog emot ditt meddelande om att du ångrar köp ${reference} den ${formatDateTime(receivedAt)} svensk tid.\n\nVi kontaktar dig om återbetalningen eller om vi behöver fler uppgifter.`;
}

export async function submitShopWithdrawal(input: z.input<typeof withdrawalInput>) {
  const { reference, name, email } = withdrawalInput.parse(input);
  const receivedAt = new Date().toISOString();
  return transaction(async () => {
    const order = await getShopOrderByReference(reference);
    if (!order?.items.some(item => item.wellness) || !equalSecret(order.email.toLowerCase(), email.toLowerCase()))
      throw new DomainError("Vi hittar ingen friskvårdsbeställning med de uppgifterna. Kontrollera referensen och e-postadressen i din beställningsbekräftelse.");

    const existing = await getShopWithdrawal(order.id);
    if (existing) return { orderId: order.id, receivedAt: existing.receivedAt };

    const settings = await getSettings();
    const notification = process.env.EMAIL_NOTIFICATION_TO?.trim() || settings.email;
    const adminLink = new URL(`/admin/bestallningar/${order.id}`, process.env.APP_URL || "https://www.tibb.nu").href;
    await getDb().prepare("INSERT INTO shop_withdrawals(order_id,customer_name,received_at) VALUES(?,?,?)").run(order.id, name, receivedAt);
    const enqueue = getDb().prepare(`INSERT INTO shop_withdrawal_email_outbox
      (id,order_id,audience,recipient,subject,body,created_at,next_attempt_at) VALUES(?,?,?,?,?,?,?,?)`);
    await enqueue.run(randomUUID(), order.id, "customer", order.email,
      "Vi har tagit emot att du ångrar ditt köp", withdrawalReceiptText(reference, receivedAt), receivedAt, receivedAt);
    if (z.email().safeParse(notification).success) {
      await enqueue.run(randomUUID(), order.id, "admin", notification, "En kund har ångrat ett köp hos Tibb.nu",
        `En kund har skickat in ett meddelande om att ångra sitt köp.\n\nÖppna beställningen för handläggning.\n${adminLink}`,
        receivedAt, receivedAt);
    }
    return { orderId: order.id, receivedAt };
  });
}

export async function getShopWithdrawal(orderId: number) {
  const row = await getDb().prepare("SELECT customer_name,received_at,handled_at FROM shop_withdrawals WHERE order_id=?").get(orderId);
  return row ? { name: String(row.customer_name), receivedAt: String(row.received_at), handled: Boolean(row.handled_at) } : null;
}

export async function getPendingShopWithdrawalIds(actorId: number) {
  await assertAdmin(actorId);
  const rows = await getDb().prepare("SELECT order_id FROM shop_withdrawals WHERE handled_at IS NULL ORDER BY received_at").all();
  return new Set(rows.map(row => Number(row.order_id)));
}

export async function markShopWithdrawalHandled(actorId: number, orderId: number) {
  await transaction(async () => {
    await assertAdmin(actorId);
    await getDb().prepare("UPDATE shop_withdrawals SET handled_at=? WHERE order_id=? AND handled_at IS NULL").run(new Date().toISOString(), orderId);
  });
}
