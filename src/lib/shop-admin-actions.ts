"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { DomainError } from "./db";
import { field, idField, money } from "./validation";
import {
  getShopSettings,
  saveShopProduct,
  saveShopSettings,
  updateShopFulfillment,
} from "./shop";
import { shopInteger } from "./shop-admin-values";
import {
  shopFulfillmentFields,
  shopProductFields,
  shopSettingsFields,
  type ShopAdminActionState,
  type ShopFulfillmentFields,
  type ShopProductFields,
  type ShopSettingsFields,
} from "./shop-admin-state";

function message(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || "Kontrollera fälten och försök igen.";
  if (
    error instanceof Error &&
    /UNIQUE constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message)
  )
    return "Adressnamnet används redan av en produkt. Välj ett annat.";
  console.error(
    "Tibb shop admin action failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return "Det gick inte att spara. Din inmatning finns kvar. Försök igen.";
}
function refreshProducts() {
  revalidatePath("/admin/produkter");
  revalidatePath("/admin/produkter/[id]", "page");
  revalidatePath("/admin/butik/forhandsvisa");
  revalidatePath("/butik");
  revalidatePath("/butik/[slug]", "page");
}
export async function saveShopSettingsAction(
  _previous: ShopAdminActionState<ShopSettingsFields>,
  form: FormData,
): Promise<ShopAdminActionState<ShopSettingsFields>> {
  const user = await requireAdmin();
  const values = shopSettingsFields(form);
  try {
    const threshold = values.freeShippingThreshold.trim()
      ? z
          .string()
          .trim()
          .regex(
            /^\d{1,7}([.,]\d{1,2})?$/,
            "Ange gränsen för fri frakt i kronor, med högst två decimaler.",
          )
          .transform((value) =>
            Math.round(Number(value.replace(",", ".")) * 100),
          )
          .refine(
            (value) => value <= 100_000_000,
            "Gränsen för fri frakt får vara högst 1 000 000 kronor.",
          )
          .parse(values.freeShippingThreshold)
      : null;
    const current = await getShopSettings();
    await saveShopSettings(user.id, {
      ...current,
      enabled: values.enabled,
      shippingEnabled: values.shippingEnabled,
      pickupEnabled: values.pickupEnabled,
      shippingPriceOre: money(values.shippingPrice),
      freeShippingThresholdOre: threshold,
      pickupAddress: values.pickupAddress,
      pickupInstructions: values.pickupInstructions,
      terms: values.terms,
    });
  } catch (error) {
    return { error: message(error), values };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/butik");
  revalidatePath("/admin/butik/forhandsvisa");
  return { success: "Butikens inställningar har sparats.", values };
}
export async function saveShopProductAction(
  _previous: ShopAdminActionState<ShopProductFields>,
  form: FormData,
): Promise<ShopAdminActionState<ShopProductFields>> {
  const user = await requireAdmin();
  const values = shopProductFields(form);
  let id: number;
  try {
    const kind = z.enum(["product", "bundle"], { error: "Välj vanlig produkt eller paket." }).parse(values.kind);
    id = await saveShopProduct(
      user.id,
      field(form, "id") ? idField(form) : null,
      {
        name: values.name,
        slug: values.slug,
        description: values.description,
        ...(form.has("richDescription") ? { richDescription: values.richDescription } : {}),
        priceOre: money(values.price),
        vatPercent: Number(values.vatPercent),
        kind,
        stock: kind === "product" ? shopInteger(values.stock, "lagersaldo", 0, 1_000_000) : 0,
        weightGrams: kind === "product" ? shopInteger(values.weightGrams, "produktvikt", 0, 100_000_000) : 0,
        bundleItems: kind === "bundle" ? values.bundleItems.map(item => ({ productId: shopInteger(item.productId, "produkt-ID", 1), quantity: shopInteger(item.quantity, "antal i paketet", 1, 99) })) : [],
        published: values.published,
        imageId: values.imageId || null,
        expectedUpdatedAt: values.expectedUpdatedAt || undefined,
      },
    );
  } catch (error) {
    return { error: message(error), values };
  }
  refreshProducts();
  redirect(
    `/admin/produkter/${id}?success=${encodeURIComponent("Produkten har sparats.")}&saved=${Date.now()}&savedForm=product-${id}`,
  );
}
export async function updateShopFulfillmentAction(
  _previous: ShopAdminActionState<ShopFulfillmentFields>,
  form: FormData,
): Promise<ShopAdminActionState<ShopFulfillmentFields>> {
  const user = await requireAdmin();
  const values = shopFulfillmentFields(form);
  let id: number;
  try {
    id = idField(form);
    const fulfillment = z
      .enum(["unfulfilled", "ready", "shipped", "collected"])
      .parse(values.fulfillment);
    await updateShopFulfillment(user.id, id, {
      fulfillment,
      trackingNumber: values.trackingNumber,
    });
  } catch (error) {
    return { error: message(error), values };
  }
  revalidatePath("/admin/bestallningar");
  revalidatePath(`/admin/bestallningar/${id}`);
  revalidatePath("/bestallning/bekraftelse");
  return { success: "Beställningens leveransstatus har sparats.", values };
}
