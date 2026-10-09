import type { ShopProduct, ShopQuote, ShopQuoteInput, ShopSettings } from "@/lib/shop-types";

export function normalizedCoupon(value: string) { return value.trim().toUpperCase(); }
export function normalizedPostcode(value: string) { return value.replace(/\s/g, ""); }

export function quoteRequestKey(input: ShopQuoteInput, products: ShopProduct[], settings: ShopSettings, revision = 0) {
  return JSON.stringify({
    items: [...input.items].sort((a, b) => a.productId - b.productId),
    delivery: input.delivery,
    postcode: input.delivery === "shipping" ? normalizedPostcode(input.postcode || "") : "",
    couponCode: normalizedCoupon(input.couponCode || ""),
    products: products.map((product) => [product.id, product.updatedAt, product.priceOre, product.stock, product.kind, product.bundleItems]),
    settings,
    revision,
  });
}

export function readShopQuote(value: unknown): ShopQuote | null {
  if (!value || typeof value !== "object") return null;
  const quote = value as ShopQuote;
  const money = [quote.originalSubtotalOre, quote.discountOre, quote.subtotalOre, quote.shippingOre, quote.totalOre];
  if (!money.every((amount) => Number.isSafeInteger(amount) && amount >= 0)
    || quote.originalSubtotalOre - quote.discountOre !== quote.subtotalOre
    || quote.subtotalOre + quote.shippingOre !== quote.totalOre
    || typeof quote.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(quote.fingerprint)
    || typeof quote.shippingLabel !== "string"
    || !Array.isArray(quote.items) || !Array.isArray(quote.discounts)
    || !(quote.couponCode === null || typeof quote.couponCode === "string")) return null;
  if (!quote.items.every((item) => Number.isSafeInteger(item.productId) && item.productId > 0
    && Number.isSafeInteger(item.quantity) && item.quantity > 0 && typeof item.name === "string"
    && Number.isSafeInteger(item.lineTotalOre) && item.lineTotalOre >= 0
    && Number.isSafeInteger(item.originalLineTotalOre) && item.originalLineTotalOre >= item.lineTotalOre)) return null;
  if (!quote.discounts.every((discount) => ["bundle", "quantity", "coupon"].includes(discount.kind)
    && typeof discount.name === "string" && Number.isSafeInteger(discount.amountOre) && discount.amountOre >= 0)) return null;
  if(quote.items.reduce((sum,item)=>sum+item.lineTotalOre,0)!==quote.subtotalOre || quote.discounts.reduce((sum,item)=>sum+item.amountOre,0)!==quote.discountOre) return null;
  return quote;
}
