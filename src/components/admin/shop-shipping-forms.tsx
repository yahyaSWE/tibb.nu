"use client";
import { useId } from "react";
import type { ShopSettings, ShopShippingRule } from "@/lib/shop-types";
import type { ShopShippingModeFields, ShopShippingRuleFields } from "@/lib/shop-promotion-state";
import { saveShopShippingModeAction, saveShopShippingRuleAction } from "@/lib/shop-promotion-actions";
import { Field } from "./common";
import { useShopEditor } from "./shop-promotion-forms";
import { useShopInlineForm, ShopFormMessage, ShopSaveButton } from "./shop-form-ui";
import "./shop-admin.css";

export function ShopShippingModeForm({settings}:{settings:ShopSettings}) {
  const form=useShopInlineForm<ShopShippingModeFields>(saveShopShippingModeAction,{shippingRuleMode:!!settings.shippingRuleMode,packingWeightGrams:String(settings.packingWeightGrams??0)});
  return <form action={form.action} className="stack"><ShopFormMessage state={form.state} errorRef={form.errorRef}/><fieldset disabled={form.pending} className="stack content-form-fields"><legend className="sr-only">Fraktinställningar</legend>
    <label className="form-check"><input name="shippingRuleMode" type="checkbox" checked={form.values.shippingRuleMode} onChange={event=>form.setValues({...form.values,shippingRuleMode:event.target.checked})}/><span>Använd automatisk frakt enligt reglerna nedan</span></label>
    <p className="small muted">När regler används krävs känd produktvikt och en matchande aktiv regel. Annars kan fraktköpet inte slutföras. Avstängt läge använder butikens fasta fraktkostnad.</p>
    <Field label="Emballagevikt per försändelse (gram)" name="shipping-packing-weight"><input id="shipping-packing-weight" name="packingWeightGrams" required type="number" min={0} max={1000000} step={1} value={form.values.packingWeightGrams} onChange={event=>form.setValues({...form.values,packingWeightGrams:event.target.value})}/></Field>
  </fieldset><div><ShopSaveButton pending={form.pending}>Spara fraktinställningar</ShopSaveButton></div></form>;
}
export function ShopShippingRuleForm({rule}:{rule?:ShopShippingRule}) {
  const prefix=useId();
  const form=useShopEditor<ShopShippingRuleFields>(saveShopShippingRuleAction,{name:rule?.name??"",carrier:rule?.carrier??"",service:rule?.service??"",active:rule?.active??false,priority:String(rule?.priority??0),minWeightGrams:String(rule?.minWeightGrams??0),maxWeightGrams:rule?.maxWeightGrams==null?"":String(rule.maxWeightGrams),minSubtotal:String((rule?.minSubtotalOre??0)/100),maxSubtotal:rule?.maxSubtotalOre==null?"":String(rule.maxSubtotalOre/100),postcodePrefixes:(rule?.postcodePrefixes??[]).join(", "),price:rule?String(rule.priceOre/100):""},`shipping-rule-${rule?.id??"new"}`,!rule);
  const field=(key:keyof ShopShippingRuleFields,label:string,options:{numeric?:boolean;optional?:boolean;max?:number;step?:string;help?:string}={})=><Field label={label} name={`${prefix}-${key}`} help={options.help}><input id={`${prefix}-${key}`} name={key} type={options.numeric?"number":"text"} min={options.numeric?0:undefined} max={options.max} step={options.step??1} required={!options.optional} maxLength={options.numeric?undefined:150} value={String(form.values[key])} onChange={event=>form.setValues({...form.values,[key]:event.target.value})}/></Field>;
  return <form action={form.action} onSubmit={form.onSubmit} className="stack" aria-busy={form.pending}>{rule&&<input type="hidden" name="id" value={rule.id}/>}<ShopFormMessage state={{error:form.error}} errorRef={form.errorRef}/><fieldset disabled={form.pending} className="stack content-form-fields"><legend className="sr-only">Fraktregel</legend>
    {field("name","Namn på fraktalternativet")}
    <div className="form-grid">{field("carrier","Transportör",{optional:true})}{field("service","Frakttjänst",{optional:true})}</div>
    <div className="form-grid">{field("price","Fraktpris inkl. moms (kr)",{numeric:true,max:10000,step:"0.01"})}{field("priority","Prioritet",{numeric:true,max:1000000,help:"Lägst nummer väljs först. Vid samma prioritet väljs lägst pris."})}</div>
    <div className="form-grid">{field("minWeightGrams","Minsta försändelsevikt (gram)",{numeric:true,max:100000000})}{field("maxWeightGrams","Högsta försändelsevikt (gram)",{numeric:true,optional:true,max:100000000,help:"Tomt betyder ingen övre gräns."})}</div>
    <div className="form-grid">{field("minSubtotal","Minsta varuvärde efter rabatt (kr)",{numeric:true,max:1000000,step:"0.01"})}{field("maxSubtotal","Högsta varuvärde efter rabatt (kr)",{numeric:true,optional:true,max:1000000,step:"0.01"})}</div>
    <Field label="Postnummerprefix" name={`${prefix}-prefixes`} help="Till exempel 55, 56 eller 553. Separera med komma eller ny rad. Tomt gäller hela Sverige."><textarea id={`${prefix}-prefixes`} name="postcodePrefixes" rows={3} maxLength={1000} value={form.values.postcodePrefixes} onChange={event=>form.setValues({...form.values,postcodePrefixes:event.target.value})}/></Field>
    <label className="form-check"><input name="active" type="checkbox" checked={form.values.active} onChange={event=>form.setValues({...form.values,active:event.target.checked})}/><span>Aktivera fraktregeln</span></label>
  </fieldset><div><ShopSaveButton pending={form.pending}>{rule?"Spara fraktregel":"Skapa fraktregel"}</ShopSaveButton></div></form>;
}
