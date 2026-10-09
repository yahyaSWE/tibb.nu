"use client";

import { useEffect, useId, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useContentForm } from "@/lib/use-content-form";
import type { ContentActionState } from "@/lib/content-action-state";
import type { ShopCoupon, ShopQuantityOffer } from "@/lib/shop-types";
import type { ShopCouponFields, ShopOfferFields } from "@/lib/shop-promotion-state";
import { saveShopCouponAction, saveShopQuantityOfferAction } from "@/lib/shop-promotion-actions";
import { localDateTime } from "@/lib/time";
import { Field } from "./common";
import { ShopFormMessage, ShopSaveButton } from "./shop-form-ui";
import type { ShopBundleCatalogItem } from "./shop-bundle-editor";
import "./shop-admin.css";

export function useShopEditor<Values>(action: (previous:ContentActionState<Values>,form:FormData)=>Promise<ContentActionState<Values>>,defaults:Values,formKey:string,isNew:boolean) {
  const form = useContentForm(action,defaults,formKey,isNew);
  const search = useSearchParams();
  const saved = search.get("saved");
  const savedForm = search.get("savedForm");
  const priorSaved = useRef(saved);
  const latestDefaults = useRef(defaults);
  latestDefaults.current = defaults;
  useEffect(() => {
    if(!isNew && saved && saved !== priorSaved.current && savedForm === formKey) form.setValues(latestDefaults.current);
    priorSaved.current=saved;
  },[saved,savedForm,formKey,isNew,form.setValues]);
  return form;
}

export function ShopQuantityOfferForm({offer,products}:{offer?:ShopQuantityOffer;products:ShopBundleCatalogItem[]}) {
  const prefix=useId();
  const form=useShopEditor<ShopOfferFields>(saveShopQuantityOfferAction,{name:offer?.name??"",scope:offer?.scope??"per_product",appliesTo:offer?.productIds.length?"selected":"all",productIds:(offer?.productIds??[]).map(String),minQuantity:offer?String(offer.minQuantity):"",percent:offer?String(offer.percent):"",active:offer?.active??false},`offer-${offer?.id??"new"}`,!offer);
  const change=(field:keyof ShopOfferFields,value:string|boolean)=>form.setValues({...form.values,[field]:value});
  const regular=products.filter(product=>product.kind!=="bundle");
  return <form action={form.action} onSubmit={form.onSubmit} className="stack" aria-busy={form.pending}>
    {offer && <input type="hidden" name="id" value={offer.id}/>}
    <ShopFormMessage state={{error:form.error}} errorRef={form.errorRef}/>
    <fieldset disabled={form.pending} className="stack content-form-fields"><legend className="sr-only">Mängdrabattens uppgifter</legend>
      <Field label="Namn på mängdrabatten" name={`${prefix}-name`}><input id={`${prefix}-name`} name="name" required maxLength={100} value={form.values.name} onChange={event=>change("name",event.target.value)}/></Field>
      <Field label="Hur räknas antal?" name={`${prefix}-scope`}><select id={`${prefix}-scope`} name="scope" value={form.values.scope} onChange={event=>change("scope",event.target.value)}><option value="per_product">Antal av samma produkt</option><option value="mixed">Antal av valda produkter tillsammans</option></select></Field>
      <div className="form-grid"><Field label="Minsta antal" name={`${prefix}-quantity`}><input id={`${prefix}-quantity`} name="minQuantity" type="number" required min={2} max={10000} step={1} value={form.values.minQuantity} onChange={event=>change("minQuantity",event.target.value)}/></Field><Field label="Rabatt (%)" name={`${prefix}-percent`}><input id={`${prefix}-percent`} name="percent" type="number" required min={1} max={99} step={1} value={form.values.percent} onChange={event=>change("percent",event.target.value)}/></Field></div>
      <Field label="Vilka produkter omfattas?" name={`${prefix}-applies`}><select id={`${prefix}-applies`} name="appliesTo" value={form.values.appliesTo} onChange={event=>change("appliesTo",event.target.value)}><option value="all">Alla vanliga produkter</option><option value="selected">Utvalda produkter</option></select></Field>
      {form.values.appliesTo === "selected" ? <fieldset className="shop-product-picker"><legend>Välj minst en produkt</legend>{regular.length ? regular.map(product=><label className="form-check" key={product.id}><input type="checkbox" name="productIds" value={product.id} checked={form.values.productIds.includes(String(product.id))} onChange={event=>form.setValues({...form.values,productIds:event.target.checked?[...form.values.productIds,String(product.id)]:form.values.productIds.filter(id=>id!==String(product.id))})}/><span>{product.name}{!product.published && <small className="muted"> · utkast</small>}</span></label>) : <p className="muted small">Skapa en vanlig produkt först.</p>}</fieldset> : form.values.productIds.map(id=><input type="hidden" name="productIds" key={id} value={id}/>)}
      <p className="small muted">Mängdrabatter gäller vanliga produkter. Paket har ett eget pris. Om flera mängdrabatter passar väljs den som ger kunden störst rabatt.</p>
      <label className="form-check"><input name="active" type="checkbox" checked={form.values.active} onChange={event=>change("active",event.target.checked)}/><span>Aktivera mängdrabatten</span></label>
    </fieldset><div><ShopSaveButton pending={form.pending}>{offer?"Spara mängdrabatt":"Skapa mängdrabatt"}</ShopSaveButton></div>
  </form>;
}

export function ShopCouponForm({coupon}:{coupon?:ShopCoupon}) {
  const prefix=useId();
  const form=useShopEditor<ShopCouponFields>(saveShopCouponAction,{code:coupon?.code??"",name:coupon?.name??"",type:coupon?.type??"percent",value:coupon?String(coupon.type==="fixed"?coupon.value/100:coupon.value):"",minSubtotal:String((coupon?.minSubtotalOre??0)/100),active:coupon?.active??false,startsAt:coupon?.startsAt?localDateTime(coupon.startsAt):"",endsAt:coupon?.endsAt?localDateTime(coupon.endsAt):"",maxUses:coupon?.maxUses===null||coupon?.maxUses===undefined?"":String(coupon.maxUses),combineWithOffers:coupon?.combineWithOffers??false},`coupon-${coupon?.id??"new"}`,!coupon);
  const change=(field:keyof ShopCouponFields,value:string|boolean)=>form.setValues({...form.values,[field]:value});
  const fixed=form.values.type==="fixed";
  return <form action={form.action} onSubmit={form.onSubmit} className="stack" aria-busy={form.pending}>
    {coupon && <input type="hidden" name="id" value={coupon.id}/>}
    <ShopFormMessage state={{error:form.error}} errorRef={form.errorRef}/>
    <fieldset disabled={form.pending} className="stack content-form-fields"><legend className="sr-only">Rabattkodens uppgifter</legend>
      <div className="form-grid"><Field label="Rabattkod" name={`${prefix}-code`} help="3–50 tecken: A–Z, siffror, bindestreck eller understreck. Börja med en bokstav eller siffra."><input id={`${prefix}-code`} name="code" required minLength={3} maxLength={50} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,49}" autoCapitalize="characters" spellCheck={false} value={form.values.code} onChange={event=>change("code",event.target.value)}/></Field><Field label="Namn" name={`${prefix}-name`}><input id={`${prefix}-name`} name="name" required maxLength={100} value={form.values.name} onChange={event=>change("name",event.target.value)}/></Field></div>
      <div className="form-grid"><Field label="Typ av rabatt" name={`${prefix}-type`}><select id={`${prefix}-type`} name="type" value={form.values.type} onChange={event=>change("type",event.target.value)}><option value="percent">Procent</option><option value="fixed">Fast belopp i kronor</option></select></Field><Field label={fixed?"Rabattbelopp (kr)":"Rabatt (%)"} name={`${prefix}-value`}><input id={`${prefix}-value`} name="value" type="number" required min={fixed?0.01:1} max={fixed?100000:99} step={fixed?"0.01":1} value={form.values.value} onChange={event=>change("value",event.target.value)}/></Field></div>
      <div className="form-grid"><Field label="Minsta varuvärde (kr)" name={`${prefix}-subtotal`} help="0 innebär ingen beloppsgräns. Frakt räknas inte in."><input id={`${prefix}-subtotal`} name="minSubtotal" type="number" required min={0} max={1000000} step="0.01" value={form.values.minSubtotal} onChange={event=>change("minSubtotal",event.target.value)}/></Field><Field label="Maximalt antal användningar" name={`${prefix}-uses`} help={coupon?`${coupon.uses} användningar registrerade. Lämna tomt för obegränsat antal.`:"Lämna tomt för obegränsat antal."}><input id={`${prefix}-uses`} name="maxUses" type="number" min={1} max={1000000} step={1} value={form.values.maxUses} onChange={event=>change("maxUses",event.target.value)}/></Field></div>
      <div className="form-grid"><Field label="Gäller från (svensk tid)" name={`${prefix}-start`} help="Valfritt. Tomt innebär att koden kan användas direkt när den aktiveras."><input id={`${prefix}-start`} name="startsAt" type="datetime-local" value={form.values.startsAt} onChange={event=>change("startsAt",event.target.value)}/></Field><Field label="Gäller till (svensk tid)" name={`${prefix}-end`} help="Valfritt. Tomt innebär inget slutdatum."><input id={`${prefix}-end`} name="endsAt" type="datetime-local" value={form.values.endsAt} onChange={event=>change("endsAt",event.target.value)}/></Field></div>
      <label className="form-check"><input name="combineWithOffers" type="checkbox" checked={form.values.combineWithOffers} onChange={event=>change("combineWithOffers",event.target.checked)}/><span>Kan kombineras med mängdrabatter och paket</span></label>
      <p className="small muted">Om kombination är avstängd ersätter koden mängdrabatter och kan inte användas tillsammans med paket. Rabatten dras från varuvärdet, inte från frakten.</p>
      <label className="form-check"><input name="active" type="checkbox" checked={form.values.active} onChange={event=>change("active",event.target.checked)}/><span>Aktivera rabattkoden</span></label>
    </fieldset><div><ShopSaveButton pending={form.pending}>{coupon?"Spara rabattkod":"Skapa rabattkod"}</ShopSaveButton></div>
  </form>;
}
