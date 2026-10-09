"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { DomainError } from "./db";
import { field, idField } from "./validation";
import { getShopSettings, saveShopSettings, saveShopQuantityOffer, saveShopCoupon, saveShopShippingRule } from "./shop";
import type { ShopAdminActionState } from "./shop-admin-state";
import { shopAdminError } from "./shop-admin-errors";
import { shopInteger, shopLocalDateTime, shopMoney } from "./shop-admin-values";
import { shopOfferFields, shopCouponFields, shopShippingRuleFields, shopShippingModeFields, type ShopOfferFields, type ShopCouponFields, type ShopShippingRuleFields, type ShopShippingModeFields } from "./shop-promotion-state";

function refreshShopRules() {
  revalidatePath("/admin/rabatter");
  revalidatePath("/admin/frakt");
  revalidatePath("/admin/butik");
  revalidatePath("/admin/butik/forhandsvisa");
  revalidatePath("/butik");
  revalidatePath("/butik/[slug]", "page");
  revalidatePath("/butik/varukorg");
  revalidatePath("/butik/kassa");
}
function successRedirect(path: string, message: string, formKey: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}&saved=${Date.now()}&savedForm=${formKey}`);
}

export async function saveShopQuantityOfferAction(_previous: ShopAdminActionState<ShopOfferFields>, form: FormData): Promise<ShopAdminActionState<ShopOfferFields>> {
  const user = await requireAdmin();
  const values = shopOfferFields(form);
  const editing = Boolean(field(form,"id"));
  let id: number;
  try {
    const appliesTo = z.enum(["all","selected"], {error:"Välj vilka produkter rabatten gäller."}).parse(values.appliesTo);
    if (appliesTo === "selected" && !values.productIds.length) throw new DomainError("Välj minst en produkt för mängdrabatten.");
    id = await saveShopQuantityOffer(user.id, editing ? idField(form) : null, {
      name: values.name,
      scope: z.enum(["per_product","mixed"], {error:"Välj hur antal ska räknas."}).parse(values.scope),
      productIds: appliesTo === "all" ? [] : values.productIds.map(value => shopInteger(value,"produkt-ID",1)),
      minQuantity: shopInteger(values.minQuantity,"minsta antal",2,10000),
      percent: shopInteger(values.percent,"rabattprocent",1,99),
      active: values.active,
    });
  } catch (error) { return {error:shopAdminError(error),values}; }
  refreshShopRules();
  successRedirect("/admin/rabatter", "Mängdrabatten har sparats.", `offer-${editing ? id : "new"}`);
}

export async function saveShopCouponAction(_previous: ShopAdminActionState<ShopCouponFields>, form: FormData): Promise<ShopAdminActionState<ShopCouponFields>> {
  const user = await requireAdmin();
  const values = shopCouponFields(form);
  const editing = Boolean(field(form,"id"));
  let id: number;
  try {
    const type = z.enum(["percent","fixed"], {error:"Välj rabatt i procent eller kronor."}).parse(values.type);
    id = await saveShopCoupon(user.id, editing ? idField(form) : null, {
      code:values.code,name:values.name,type,
      value:type === "fixed" ? shopMoney(values.value,"rabattbelopp",10_000_000) : shopInteger(values.value,"rabattprocent",1,99),
      minSubtotalOre:shopMoney(values.minSubtotal,"minsta varuvärde"),
      active:values.active,
      startsAt:shopLocalDateTime(values.startsAt),endsAt:shopLocalDateTime(values.endsAt),
      maxUses:values.maxUses.trim() ? shopInteger(values.maxUses,"maximalt antal användningar",1,1_000_000) : null,
      combineWithOffers:values.combineWithOffers,
    });
  } catch(error) {return {error:shopAdminError(error),values};}
  refreshShopRules();
  successRedirect("/admin/rabatter","Rabattkoden har sparats.",`coupon-${editing ? id : "new"}`);
}

export async function saveShopShippingRuleAction(_previous: ShopAdminActionState<ShopShippingRuleFields>, form: FormData): Promise<ShopAdminActionState<ShopShippingRuleFields>> {
  const user = await requireAdmin();
  const values = shopShippingRuleFields(form);
  const editing = Boolean(field(form,"id"));
  let id: number;
  try {
    id = await saveShopShippingRule(user.id, editing ? idField(form) : null, {
      name:values.name,carrier:values.carrier,service:values.service,active:values.active,
      priority:shopInteger(values.priority,"prioritet",0,1_000_000),
      minWeightGrams:shopInteger(values.minWeightGrams,"minsta vikt",0,100_000_000),
      maxWeightGrams:values.maxWeightGrams.trim() ? shopInteger(values.maxWeightGrams,"högsta vikt",0,100_000_000) : null,
      minSubtotalOre:shopMoney(values.minSubtotal,"minsta varuvärde"),
      maxSubtotalOre:values.maxSubtotal.trim() ? shopMoney(values.maxSubtotal,"högsta varuvärde") : null,
      postcodePrefixes:values.postcodePrefixes.split(/[\s,;]+/).filter(Boolean),
      priceOre:shopMoney(values.price,"fraktpris",1_000_000),
    });
  } catch(error) {return {error:shopAdminError(error),values};}
  refreshShopRules();
  successRedirect("/admin/frakt","Fraktregeln har sparats.",`shipping-rule-${editing ? id : "new"}`);
}

export async function saveShopShippingModeAction(_previous: ShopAdminActionState<ShopShippingModeFields>, form: FormData): Promise<ShopAdminActionState<ShopShippingModeFields>> {
  const user = await requireAdmin();
  const values = shopShippingModeFields(form);
  try {
    const current = await getShopSettings();
    await saveShopSettings(user.id,{...current,shippingRuleMode:values.shippingRuleMode,packingWeightGrams:shopInteger(values.packingWeightGrams,"emballagevikt",0,1_000_000)});
  } catch(error) {return {error:shopAdminError(error),values};}
  refreshShopRules();
  return {success:"Fraktinställningarna har sparats.",values};
}
