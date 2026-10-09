export type ShopAdminActionState<Values> = {
  error?: string;
  success?: string;
  values?: Values;
};
export type ShopSettingsFields = {
  enabled: boolean;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  shippingPrice: string;
  freeShippingThreshold: string;
  pickupAddress: string;
  pickupInstructions: string;
  terms: string;
};
export type ShopProductFields = {
  kind: string;
  weightGrams: string;
  bundleItems: { productId: string; quantity: string }[];
  name: string;
  slug: string;
  description: string;
  price: string;
  vatPercent: string;
  stock: string;
  published: boolean;
  imageId: string;
  expectedUpdatedAt: string;
};
export type ShopFulfillmentFields = {
  fulfillment: string;
  trackingNumber: string;
};
function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
export function shopSettingsFields(form: FormData): ShopSettingsFields {
  return {
    enabled: text(form, "enabled") === "on",
    shippingEnabled: text(form, "shippingEnabled") === "on",
    pickupEnabled: text(form, "pickupEnabled") === "on",
    shippingPrice: text(form, "shippingPrice"),
    freeShippingThreshold: text(form, "freeShippingThreshold"),
    pickupAddress: text(form, "pickupAddress"),
    pickupInstructions: text(form, "pickupInstructions"),
    terms: text(form, "terms"),
  };
}
export function shopProductFields(form: FormData): ShopProductFields {
  const productIds = form.getAll("bundleProductId");
  const quantities = form.getAll("bundleQuantity");
  return {
    kind: text(form, "kind") || "product",
    weightGrams: form.has("weightGrams") ? text(form, "weightGrams") : "0",
    bundleItems: productIds.map((productId, index) => ({ productId: typeof productId === "string" ? productId : "", quantity: typeof quantities[index] === "string" ? quantities[index] as string : "" })),
    name: text(form, "name"),
    slug: text(form, "slug"),
    description: text(form, "description"),
    price: text(form, "price"),
    vatPercent: text(form, "vatPercent"),
    stock: text(form, "stock"),
    published: text(form, "published") === "on",
    imageId: text(form, "imageId"),
    expectedUpdatedAt: text(form, "expectedUpdatedAt"),
  };
}
export function shopFulfillmentFields(form: FormData): ShopFulfillmentFields {
  return {
    fulfillment: text(form, "fulfillment"),
    trackingNumber: text(form, "trackingNumber"),
  };
}
