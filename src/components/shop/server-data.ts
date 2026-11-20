import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import {
  getShopSettings,
  getPublicShopProduct,
  getPublicShopProducts,
  wellnessCheckoutReady,
} from "@/lib/shop";
import { getPublicWellnessServices } from "@/lib/wellness";

// Dedupe metadata/page reads during one render; publication and stock remain
// fresh for the next request and are checked again by checkout.
export const shopSettingsForRender = cache(getShopSettings);
export const shopProductForRender = cache(getPublicShopProduct);
export const shopProductsForRender = cache(getPublicShopProducts);

export const purchaseDataForRender = cache(async () => {
  const settings = await shopSettingsForRender();
  if (settings.enabled) return { settings, products: await shopProductsForRender(), wellnessOnly: false };
  if (!await wellnessCheckoutReady(settings)) notFound();
  const products = await getPublicWellnessServices();
  if (!products.length) notFound();
  return { settings: { ...settings, enabled: true }, products, wellnessOnly: true };
});
