import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getShopSettings,getAdminShopShippingRules } from "@/lib/shop";
import { AdminHeading,AdminNotice,SectionHeading,kronor,type AdminSearchParams } from "@/components/admin/common";
import { ShopShippingModeForm,ShopShippingRuleForm } from "@/components/admin/shop-shipping-forms";
export default async function ShippingPage({searchParams}:{searchParams:AdminSearchParams}) {
 const user=await requireAdmin();const [settings,rules]=await Promise.all([getShopSettings(),getAdminShopShippingRules(user.id)]);
 return <><AdminHeading eyebrow="Din butik" title="Frakt" description="Beräkna leveranspris från försändelsens vikt, varuvärde och postnummer." action={<Link href="/admin/butik" className="text-link">Butiksinställningar</Link>}/><AdminNotice searchParams={searchParams}/><div className="stack">
 <section className="panel form-panel"><SectionHeading title="Automatisk frakt"/><ShopShippingModeForm settings={settings}/></section>
 <p className="notice">Du anger priserna enligt ditt fraktavtal. Transportör och tjänst är information till kunden; reglerna hämtar inga externa priser och skapar inga fraktetiketter.</p>
 <section className="panel form-panel"><SectionHeading title="Ny fraktregel"/><ShopShippingRuleForm/></section>
 <section className="panel"><SectionHeading title="Dina fraktregler" description="Lägst prioritetsnummer väljs först, därefter lägst pris. Vikt och belopp omfattar båda gränserna."/>{!rules.length&&<p className="muted">Inga fraktregler har lagts in ännu.</p>}<div className="stack">{rules.map(rule=><details key={rule.id} className="shop-rule-details"><summary><strong>{rule.name}</strong> · {kronor(rule.priceOre)} · prioritet {rule.priority} · {rule.active?"Aktiv":"Avstängd"}</summary><ShopShippingRuleForm rule={rule}/></details>)}</div></section>
 </div></>;
}
