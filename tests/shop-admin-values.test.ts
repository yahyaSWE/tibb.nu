import { test } from "node:test";
import assert from "node:assert/strict";
import { shopInteger, shopLocalDateTime, shopMoney } from "../src/lib/shop-admin-values";
import { shopCouponFields, shopOfferFields, shopShippingRuleFields } from "../src/lib/shop-promotion-state";

test("admin money keeps every öre and refuses incomplete, scientific or over-precision prices", () => {
  assert.equal(shopMoney(" 4990,99 ", "rabatt"), 499099);
  assert.equal(shopMoney("0.01", "frakt"), 1);
  assert.equal(shopMoney("0", "frakt"), 0);
  for (const value of ["", "1e3", "1.001", "-1", "NaN", "12 kr", "1 000"])
    assert.throws(() => shopMoney(value, "pris"));
  assert.throws(() => shopMoney("100.01", "pris", 10000));
  assert.throws(() => shopInteger("", "vikt"), "missing input must not become zero");
  assert.throws(() => shopInteger("2.5", "antal"));
  assert.throws(() => shopInteger("9007199254740992", "antal"));
});

test("coupon validity dates use Stockholm time and reject nonexistent or ambiguous clock changes", () => {
  assert.equal(shopLocalDateTime(""), null);
  assert.equal(shopLocalDateTime("2026-01-15T10:00"), "2026-01-15T09:00:00.000Z");
  assert.equal(shopLocalDateTime("2026-07-15T10:00"), "2026-07-15T08:00:00.000Z");
  assert.throws(() => shopLocalDateTime("2026-03-29T02:30"), /finns inte/);
  assert.throws(() => shopLocalDateTime("2026-10-25T02:30"), /två gånger/);
  assert.throws(() => shopLocalDateTime("2026-02-30T12:00"));
});

test("failed promotion saves can retain exact code, money, selected products and validity inputs", () => {
  const coupon = new FormData();
  for (const [key, value] of Object.entries({ code: "  HöstKod  ", name: "Testkod", type: "fixed", value: "49,99", minSubtotal: "250,01", startsAt: "2026-10-25T02:30", endsAt: "2026-10-24T12:00", maxUses: "", active: "on", combineWithOffers: "on" })) coupon.set(key, value);
  const fields = shopCouponFields(coupon);
  assert.equal(fields.code, "  HöstKod  ");
  assert.equal(fields.value, "49,99");
  assert.equal(fields.startsAt, "2026-10-25T02:30");
  assert.equal(fields.maxUses, "");
  assert.equal(fields.active, true);
  assert.equal(fields.combineWithOffers, true);
  const offer = new FormData();
  offer.set("scope", "mixed");
  offer.set("appliesTo", "selected");
  offer.append("productIds", "7");
  offer.append("productIds", "19");
  offer.set("percent", "9");
  assert.deepEqual(shopOfferFields(offer).productIds, ["7", "19"]);
  assert.equal(shopOfferFields(offer).scope, "mixed");
  assert.equal(shopOfferFields(offer).active, false);
});

test("shipping rule snapshots retain raw postcode lists and optional bounds after validation fails", () => {
  const form = new FormData();
  form.set("name", "Testregel");
  form.set("postcodePrefixes", "55, 56\n57");
  form.set("price", "49,99");
  form.set("maxWeightGrams", "");
  form.set("maxSubtotal", "");
  const fields = shopShippingRuleFields(form);
  assert.equal(fields.postcodePrefixes, "55, 56\n57");
  assert.equal(fields.price, "49,99");
  assert.equal(fields.maxWeightGrams, "");
  assert.equal(fields.maxSubtotal, "");
});
