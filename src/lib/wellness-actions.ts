"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { DomainError } from "./db";
import { field, money } from "./validation";
import { stockholmToIso } from "./time";
import { changeWellnessPass, createInitialWellnessServices, recordManualWellnessPurchase, recordManualWellnessRefund, recordWellnessPaymentEvidence, saveWellnessSeller, saveWellnessService, voidDuplicateWellnessOrder } from "./wellness";
import { dispatchWellnessEmails, resendWellnessReceipt } from "./wellness-email";
import { captureKustomOrder, reconcileKustomOrder, refundKustomWellness } from "./kustom";

async function run(work: (actorId: number) => Promise<unknown>, saved = "1") {
  const user = await requireAdmin(); let error = "";
  try { await work(user.id); }
  catch (failure) { error = failure instanceof DomainError ? failure.message : failure instanceof z.ZodError ? failure.issues[0].message : "Åtgärden kunde inte slutföras. Kontrollera uppgifterna och försök igen med samma referens."; }
  revalidatePath("/admin/friskvard"); revalidatePath("/friskvard"); revalidatePath("/butik");
  if (!error && saved !== "duplicate") after(() => dispatchWellnessEmails({ limit: 5 }));
  redirect(`/admin/friskvard?${error ? `error=${encodeURIComponent(error)}` : `saved=${saved}`}`);
}
export async function initializeWellnessAction() { return run(createInitialWellnessServices); }
export async function saveWellnessServiceAction(form: FormData) {
  return run(id => saveWellnessService(id, { id: field(form, "id") ? Number(field(form, "id")) : undefined,
    name: field(form, "name"), description: field(form, "description"), priceOre: money(field(form, "price")),
    vatPercent: Number(field(form, "vatPercent")), validityMonths: Number(field(form, "validityMonths")),
    active: field(form, "active") === "on", eligibilityConfirmed: field(form, "eligibilityConfirmed") === "on" }));
}
export async function saveWellnessSellerAction(form: FormData) {
  return run(id => saveWellnessSeller(id, { vatNumber: field(form, "vatNumber"), address: field(form, "address"),
    legalName: field(form, "legalName"), organizationNumber: field(form, "organizationNumber"), phone: field(form, "phone") }));
}
export async function useWellnessPassAction(form: FormData) { return run(id => changeWellnessPass(id, { passId: field(form, "passId"), operationId: field(form, "operationId"), reason: field(form, "reason"), ...(field(form, "reverseId") ? { reverseId: field(form, "reverseId") } : {}) })); }
export async function resendWellnessAction(form: FormData) { return run(id => resendWellnessReceipt(id, field(form, "receiptId"))); }
export async function voidDuplicateWellnessAction(form: FormData) {
  return run(id => voidDuplicateWellnessOrder(id, {
    reference: field(form, "reference"), retainOrderId: Number(field(form, "retainOrderId")),
    reason: field(form, "reason"), confirmed: field(form, "confirmed") === "on",
  }), "duplicate");
}
export async function reconcileWellnessAction(form: FormData) { return run(() => reconcileKustomOrder(field(form, "reference"))); }
export async function captureWellnessAction(form: FormData) { return run(id => captureKustomOrder(id, field(form, "reference"))); }
export async function refundWellnessAction(form: FormData) { return run(id => refundKustomWellness(id, { reference: field(form, "reference"), productId: Number(field(form, "productId")), quantity: Number(field(form, "quantity")), operationId: field(form, "operationId"), reason: field(form, "reason") })); }
export async function manualWellnessRefundAction(form: FormData) {
  return run(id => recordManualWellnessRefund(id, { reference: field(form, "reference"), productId: Number(field(form, "productId")), quantity: Number(field(form, "quantity")), operationId: field(form, "operationId"), reason: field(form, "reason"), proofReference: field(form, "proofReference"), refundedAt: stockholmToIso(field(form, "refundedAt")), verified: field(form, "verified") === "on" }));
}
export async function verifyWellnessPaymentAction(form: FormData) {
  return run(id => recordWellnessPaymentEvidence(id, { reference: field(form, "reference"), proofReference: field(form, "proofReference"),
    paidAt: stockholmToIso(field(form, "paidAt")), amountOre: money(field(form, "amount")), verified: field(form, "verified") === "on" }));
}
export async function manualWellnessAction(form: FormData) {
  return run(id => recordManualWellnessPurchase(id, { operationId: field(form, "operationId"), name: field(form, "name"), email: field(form, "email"),
    personalIdentityNumber: field(form, "personalIdentityNumber"),
    address: field(form, "address"), postcode: field(form, "postcode"), city: field(form, "city"), method: field(form, "method"),
    paidAt: stockholmToIso(field(form, "paidAt")), proofReference: field(form, "proofReference"), verified: field(form, "verified") === "on",
    items: form.getAll("productId").map((productId, index) => ({ productId: Number(productId), quantity: Number(form.getAll("quantity")[index]) })).filter(item => item.quantity > 0) }));
}
