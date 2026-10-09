export type ShopSettings = {
  enabled: boolean;
  shippingEnabled: boolean;
  pickupEnabled: boolean;
  shippingPriceOre: number;
  freeShippingThresholdOre: number | null;
  pickupAddress: string;
  pickupInstructions: string;
  terms: string;
  shippingRuleMode?: boolean;
  packingWeightGrams?: number;
};
export type ShopProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  priceOre: number;
  vatPercent: number;
  stock: number;
  published: boolean;
  imageId: string | null;
  createdAt: string;
  updatedAt: string;
  kind?: "product" | "bundle";
  weightGrams?: number;
  bundleItems?: { productId: number; quantity: number }[];
  bundleOriginalPriceOre?: number | null;
};
export type ShopCartLine = { productId: number; quantity: number };
export type ShopOrderItem = {
  productId: number;
  name: string;
  quantity: number;
  priceOre: number;
  vatPercent: number;
  kind?: "product" | "bundle";
  lineTotalOre?: number;
  originalLineTotalOre?: number;
  // Quantities are multiplied by the number of bundles on this order line.
  bundleParts?: { productId: number; name: string; quantity: number }[];
};
export type ShopOrder = {
  id: number;
  reference: string;
  name: string;
  email: string;
  phone: string;
  delivery: "shipping" | "pickup";
  address: string;
  postcode: string;
  city: string;
  subtotalOre: number;
  shippingOre: number;
  totalOre: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  paymentStatus: "pending" | "paid" | "refund_pending" | "refunded";
  fulfillment: "unfulfilled" | "ready" | "shipped" | "collected";
  trackingNumber: string;
  checkoutSessionId: string | null;
  expiresAt: string;
  createdAt: string;
  items: ShopOrderItem[];
  pickupAddress: string;
  pickupInstructions: string;
  terms: string;
  originalSubtotalOre?: number;
  discountOre?: number;
  discounts?: ShopDiscount[];
  weightGrams?: number | null;
  shippingLabel?: string;
  couponCode?: string | null;
};
export type ShopQuantityOffer = {
  id: number; name: string; scope: "per_product" | "mixed"; productIds: number[];
  minQuantity: number; percent: number; active: boolean;
};
export type ShopCoupon = {
  id: number; code: string; name: string; type: "percent" | "fixed"; value: number;
  minSubtotalOre: number; active: boolean; startsAt: string | null; endsAt: string | null;
  maxUses: number | null; combineWithOffers: boolean; uses: number;
};
export type ShopShippingRule = {
  id: number; name: string; carrier: string; service: string; active: boolean; priority: number;
  minWeightGrams: number; maxWeightGrams: number | null;
  minSubtotalOre: number; maxSubtotalOre: number | null;
  postcodePrefixes: string[]; priceOre: number;
};
export type ShopDiscount = { kind: "bundle" | "quantity" | "coupon"; name: string; amountOre: number; code?: string };
export type ShopQuoteItem = ShopOrderItem & { lineTotalOre: number; originalLineTotalOre: number };
export type ShopQuote = {
  items: ShopQuoteItem[]; originalSubtotalOre: number; discountOre: number; subtotalOre: number;
  shippingOre: number; totalOre: number; weightGrams: number | null; shippingLabel: string;
  discounts: ShopDiscount[]; couponCode: string | null; fingerprint: string;
};
export type ShopQuoteInput = { items: ShopCartLine[]; delivery: "shipping" | "pickup"; postcode?: string; couponCode?: string };
