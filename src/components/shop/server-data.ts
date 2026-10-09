import "server-only";
import { cache } from "react";
import {
  getShopSettings,
  getPublicShopProduct,
  getPublicShopProducts,
} from "@/lib/shop";

// Dedupe metadata/page reads during one render; publication and stock remain
// fresh for the next request and are checked again by checkout.
export const shopSettingsForRender = cache(getShopSettings);
export const shopProductForRender = cache(getPublicShopProduct);
export const shopProductsForRender = cache(getPublicShopProducts);
