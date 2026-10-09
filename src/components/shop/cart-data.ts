import type { ShopCartLine, ShopProduct, ShopSettings } from "@/lib/shop-types";

export const MAX_CART_ITEMS = 20;
export const MAX_CART_QUANTITY = 99;

export function normalizeCart(value: unknown): ShopCartLine[] {
  if (!Array.isArray(value)) return [];
  const lines = new Map<number, number>();
  for (const candidate of value.slice(0, 200)) {
    if (!candidate || typeof candidate !== "object") continue;
    const { productId, quantity } = candidate as Record<string, unknown>;
    if (
      typeof productId !== "number" ||
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    )
      continue;
    if (!lines.has(productId) && lines.size >= MAX_CART_ITEMS) continue;
    lines.set(
      productId,
      Math.min(MAX_CART_QUANTITY, (lines.get(productId) ?? 0) + quantity),
    );
  }
  return [...lines].map(([productId, quantity]) => ({ productId, quantity }));
}

export function readCart(value: string | null): ShopCartLine[] {
  if (!value || value.length > 20000) return [];
  try {
    return normalizeCart(JSON.parse(value));
  } catch {
    return [];
  }
}

export function cartSummary(lines: ShopCartLine[], products: ShopProduct[]) {
  const available = new Map(products.map((product) => [product.id, product]));
  const rows = lines.map((line) => {
    const product = available.get(line.productId);
    const error = !product
      ? "Varan finns inte längre i det aktuella sortimentet."
      : product.stock < 1
        ? "Varan är slut i lager."
        : line.quantity > product.stock
          ? `Endast ${product.stock} finns i lager. Minska antalet för att fortsätta.`
          : null;
    return {
      ...line,
      product,
      error,
      totalOre: product ? product.priceOre * line.quantity : 0,
    };
  });
  return {
    rows,
    subtotalOre: rows.reduce((sum, row) => sum + row.totalOre, 0),
    valid: rows.length > 0 && rows.every((row) => !row.error),
  };
}

export function shippingPrice(
  settings: ShopSettings,
  subtotalOre: number,
  delivery: "shipping" | "pickup",
) {
  return delivery === "pickup" ||
    (settings.freeShippingThresholdOre !== null &&
      subtotalOre >= settings.freeShippingThresholdOre)
    ? 0
    : settings.shippingPriceOre;
}

export function checkoutDestination(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "checkout.stripe.com" &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
