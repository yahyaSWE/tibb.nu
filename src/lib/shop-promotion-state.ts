export type ShopOfferFields = { name: string; scope: string; appliesTo: string; productIds: string[]; minQuantity: string; percent: string; active: boolean };
export type ShopCouponFields = { code: string; name: string; type: string; value: string; minSubtotal: string; active: boolean; startsAt: string; endsAt: string; maxUses: string; combineWithOffers: boolean };
export type ShopShippingRuleFields = { name: string; carrier: string; service: string; active: boolean; priority: string; minWeightGrams: string; maxWeightGrams: string; minSubtotal: string; maxSubtotal: string; postcodePrefixes: string; price: string };
export type ShopShippingModeFields = { shippingRuleMode: boolean; packingWeightGrams: string };

function field(form: FormData, key: string) { const value = form.get(key); return typeof value === "string" ? value : ""; }
export function shopOfferFields(form: FormData): ShopOfferFields {
  return { name: field(form,"name"),scope:field(form,"scope"),appliesTo:field(form,"appliesTo"),productIds:form.getAll("productIds").map(value => typeof value === "string" ? value : ""),minQuantity:field(form,"minQuantity"),percent:field(form,"percent"),active:field(form,"active")==="on" };
}
export function shopCouponFields(form: FormData): ShopCouponFields {
  return { code:field(form,"code"),name:field(form,"name"),type:field(form,"type"),value:field(form,"value"),minSubtotal:field(form,"minSubtotal"),active:field(form,"active")==="on",startsAt:field(form,"startsAt"),endsAt:field(form,"endsAt"),maxUses:field(form,"maxUses"),combineWithOffers:field(form,"combineWithOffers")==="on" };
}
export function shopShippingRuleFields(form: FormData): ShopShippingRuleFields {
  return {name:field(form,"name"),carrier:field(form,"carrier"),service:field(form,"service"),active:field(form,"active")==="on",priority:field(form,"priority"),minWeightGrams:field(form,"minWeightGrams"),maxWeightGrams:field(form,"maxWeightGrams"),minSubtotal:field(form,"minSubtotal"),maxSubtotal:field(form,"maxSubtotal"),postcodePrefixes:field(form,"postcodePrefixes"),price:field(form,"price")};
}
export function shopShippingModeFields(form: FormData): ShopShippingModeFields { return {shippingRuleMode:field(form,"shippingRuleMode")==="on",packingWeightGrams:field(form,"packingWeightGrams")}; }
