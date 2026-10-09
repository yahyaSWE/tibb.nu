import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cartSummary,
  checkoutDestination,
  normalizeCart,
  readCart,
  shippingPrice,
} from "../src/components/shop/cart-data";
import type { ShopProduct, ShopSettings } from "../src/lib/shop-types";

const product: ShopProduct = {
  id: 1,
  name: "Produkt",
  slug: "produkt",
  description: "Information",
  priceOre: 9950,
  vatPercent: 25,
  stock: 4,
  published: true,
  imageId: null,
  createdAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
};
const settings: ShopSettings = {
  enabled: true,
  shippingEnabled: true,
  pickupEnabled: true,
  shippingPriceOre: 4900,
  freeShippingThresholdOre: 30000,
  pickupAddress: "Hämtningsplats",
  pickupInstructions: "",
  terms: "",
};

test("persisted cart contains only bounded numeric product IDs and quantities, never prices or customer data", () => {
  assert.deepEqual(
    normalizeCart([
      {
        productId: 1,
        quantity: 2,
        priceOre: 1,
        name: "Privat namn",
        email: "private@example.test",
      },
      { productId: 1, quantity: 1000 },
      { productId: "2", quantity: 1 },
      { productId: 2, quantity: -1 },
      { productId: 3, quantity: 1.5 },
      { productId: Number.MAX_SAFE_INTEGER + 1, quantity: 1 },
      null,
    ]),
    [{ productId: 1, quantity: 99 }],
  );
  assert.equal(
    normalizeCart(
      Array.from({ length: 30 }, (_, index) => ({
        productId: index + 1,
        quantity: 1,
      })),
    ).length,
    20,
  );
});

test("damaged, oversized or unrelated local storage cannot crash the cart or become an order", () => {
  for (const value of [
    null,
    "{",
    "null",
    '"something"',
    '{"productId":1,"quantity":2}',
    " ".repeat(20001),
  ])
    assert.deepEqual(readCart(value), []);
  assert.deepEqual(readCart('[{"productId":4,"quantity":2}]'), [
    { productId: 4, quantity: 2 },
  ]);
});

test("removed and sold-out products remain visible for deliberate correction and prevent checkout", () => {
  const missing = cartSummary([{ productId: 2, quantity: 1 }], [product]);
  assert.equal(missing.valid, false);
  assert.equal(missing.rows.length, 1);
  assert.equal(missing.rows[0].product, undefined);
  assert.ok(missing.rows[0].error);
  const soldOut = cartSummary(
    [{ productId: 1, quantity: 1 }],
    [{ ...product, stock: 0 }],
  );
  assert.equal(soldOut.valid, false);
  assert.ok(soldOut.rows[0].error);
});

test("reduced stock prevents checkout without silently changing the selected quantity", () => {
  const summary = cartSummary([{ productId: 1, quantity: 5 }], [product]);
  assert.equal(summary.valid, false);
  assert.equal(summary.rows[0].quantity, 5);
  assert.match(summary.rows[0].error!, /4/);
});

test("summary uses current product gross price in öre and empty carts cannot check out", () => {
  const summary = cartSummary([{ productId: 1, quantity: 3 }], [product]);
  assert.equal(summary.subtotalOre, 29850);
  assert.equal(summary.valid, true);
  assert.equal(cartSummary([], [product]).valid, false);
  assert.equal(
    cartSummary(
      [{ productId: 1, quantity: 3 }],
      [{ ...product, priceOre: 10001 }],
    ).subtotalOre,
    30003,
  );
});

test("delivery estimate respects actual settings, exact free-shipping threshold and pickup", () => {
  assert.equal(shippingPrice(settings, 29999, "shipping"), 4900);
  assert.equal(shippingPrice(settings, 30000, "shipping"), 0);
  assert.equal(shippingPrice(settings, 1, "pickup"), 0);
  assert.equal(
    shippingPrice(
      { ...settings, freeShippingThresholdOre: null },
      999999,
      "shipping",
    ),
    4900,
  );
  assert.equal(
    shippingPrice({ ...settings, shippingPriceOre: 0 }, 1, "shipping"),
    0,
  );
});

test("checkout accepts only Stripe HTTPS URLs and rejects script, lookalike and credential redirects", () => {
  assert.equal(
    checkoutDestination(
      "https://checkout.stripe.com/c/pay/cs_test_example#fragment",
    ),
    "https://checkout.stripe.com/c/pay/cs_test_example#fragment",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://checkout.stripe.com.evil.test/pay",
    "http://checkout.stripe.com/pay",
    "https://user:secret@checkout.stripe.com/pay",
    "/bestallning/bekraftelse",
    null,
  ])
    assert.equal(checkoutDestination(url), null);
});
