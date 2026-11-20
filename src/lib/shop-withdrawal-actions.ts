"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { requireAdmin } from "./auth";
import { DomainError } from "./db";
import { enforceRequestLimit } from "./request-rate-limit";
import { dispatchShopOrderEmails } from "./shop-email";
import { markShopWithdrawalHandled, submitShopWithdrawal, withdrawalInput, withdrawalReceiptText } from "./shop-withdrawals";
import { idField } from "./validation";

type WithdrawalState = { error?: string; receipt?: string; reference?: string; name?: string; email?: string };

export async function requestShopWithdrawal(_previous: WithdrawalState, form: FormData): Promise<WithdrawalState> {
  const fields = {
    reference: String(form.get("reference") ?? "").slice(0, 32),
    name: String(form.get("name") ?? "").slice(0, 100),
    email: String(form.get("email") ?? "").slice(0, 254),
  };
  const input = withdrawalInput.safeParse({
    reference: form.get("reference"), name: form.get("name"), email: form.get("email"),
    confirmed: form.get("confirmed") === "on",
  });
  if (!input.success) return { ...fields, error: "Ange ditt namn, beställningsreferensen och e-postadressen. Bekräfta sedan att du vill ångra köpet." };
  try {
    await enforceRequestLimit("shop-withdrawal", input.data.reference, 12, await headers());
    const saved = await submitShopWithdrawal(input.data);
    after(() => dispatchShopOrderEmails({ orderId: saved.orderId, event: "withdrawal", limit: 2 }));
    return { receipt: withdrawalReceiptText(input.data.reference, saved.receivedAt) };
  } catch (error) {
    return { ...fields, error: error instanceof DomainError ? error.message : "Meddelandet kunde inte registreras just nu. Försök igen eller kontakta oss så att du kan meddela oss i tid." };
  }
}

export async function markShopWithdrawalHandledAction(form: FormData) {
  const actor = await requireAdmin();
  const id = idField(form, "orderId");
  await markShopWithdrawalHandled(actor.id, id);
  revalidatePath(`/admin/bestallningar/${id}`);
  revalidatePath("/admin/bestallningar");
}
