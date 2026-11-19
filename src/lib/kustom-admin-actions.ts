"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { getAdminShopOrder } from "./shop";
import { captureKustomOrder, reconcileKustomOrder } from "./kustom";
import { DomainError } from "./db";

export async function kustomAdminOrderAction(form: FormData) {
  const user = await requireAdmin(); const id = Number(form.get("orderId"));
  const order = Number.isSafeInteger(id) && id > 0 ? await getAdminShopOrder(user.id, id) : undefined;
  if (!order) redirect("/admin/bestallningar");
  let message = "";
  try {
    if (form.get("operation") === "capture") await captureKustomOrder(user.id, order.reference);
    else await reconcileKustomOrder(order.reference);
  } catch (error) { message = error instanceof DomainError ? error.message : "Betalningen kunde inte kontrolleras. Försök igen med samma order."; }
  revalidatePath(`/admin/bestallningar/${id}`); revalidatePath("/admin/friskvard");
  redirect(`/admin/bestallningar/${id}${message ? `?paymentError=${encodeURIComponent(message)}` : ""}`);
}
