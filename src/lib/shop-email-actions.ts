"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { getAdminShopOrder } from "./shop";
import { DomainError } from "./db";
import { idField } from "./validation";
import { EmailConfigurationError, requireEmailConfiguration } from "./email-provider";
import { queueShopOrderEmails, dispatchShopOrderEmails } from "./shop-email";

export async function retryShopOrderEmailsAction(_previous: { error?: string; message?: string }, form: FormData): Promise<{ error?: string; message?: string }> {
  const user = await requireAdmin();
  try {
    const id = idField(form, "orderId");
    const order = await getAdminShopOrder(user.id, id);
    if (!order || order.status !== "paid" || order.paymentStatus !== "paid") throw new DomainError("Endast betalda beställningar kan få en orderbekräftelse.");
    requireEmailConfiguration();
    await queueShopOrderEmails(id);
    const result = await dispatchShopOrderEmails({ orderId: id, limit: 2 });
    revalidatePath(`/admin/bestallningar/${id}`);
    revalidatePath("/bestallning/bekraftelse");
    return { message: result.sent ? "E-posttjänsten har accepterat utskicket. Kontrollera faktisk leverans i Resend." : "Inga nya meddelanden accepterades. Kontrollera utskicksstatus och Resend innan du försöker igen." };
  } catch (error) {
    if (error instanceof DomainError || error instanceof EmailConfigurationError) return { error: error.message };
    return { error: "Utskicken kunde inte behandlas. Beställningen finns kvar. Försök igen om en stund." };
  }
}
