import { requireAdmin } from "@/lib/auth";
import {getAdminShopProducts,getAdminShopCoupons,getAdminShopQuantityOffers} from "@/lib/shop";
import {AdminHeading,AdminNotice,SectionHeading,type AdminSearchParams} from "@/components/admin/common";
import {ShopCouponForm,ShopQuantityOfferForm} from "@/components/admin/shop-promotion-forms";
export default async function DiscountsPage({searchParams}:{searchParams:AdminSearchParams}) {
 const user=await requireAdmin();const [products,coupons,offers]=await Promise.all([getAdminShopProducts(user.id),getAdminShopCoupons(user.id),getAdminShopQuantityOffers(user.id)]);
 const catalog=products.map(({id,name,priceOre,vatPercent,stock,weightGrams,kind,published})=>({id,name,priceOre,vatPercent,stock,weightGrams,kind,published}));
 return <><AdminHeading eyebrow="Din butik" title="Rabatter" description="Skapa mängdrabatter och rabattkoder. Förbered dem avstängda och aktivera när du vill."/><AdminNotice searchParams={searchParams}/><div className="stack">
 <section className="panel form-panel"><SectionHeading title="Ny mängdrabatt"/><ShopQuantityOfferForm products={catalog}/></section>
 <section className="panel"><SectionHeading title="Dina mängdrabatter"/>{!offers.length&&<p className="muted">Inga mängdrabatter ännu.</p>}<div className="stack">{offers.map(offer=><details key={offer.id} className="shop-rule-details"><summary><strong>{offer.name}</strong> · minst {offer.minQuantity} · {offer.percent} % · {offer.active?"Aktiv":"Avstängd"}</summary><ShopQuantityOfferForm offer={offer} products={catalog}/></details>)}</div></section>
 <section className="panel form-panel"><SectionHeading title="Ny rabattkod"/><ShopCouponForm/></section>
 <section className="panel"><SectionHeading title="Dina rabattkoder"/>{!coupons.length&&<p className="muted">Inga rabattkoder ännu.</p>}<div className="stack">{coupons.map(coupon=><details key={coupon.id} className="shop-rule-details"><summary><strong>{coupon.code}</strong> · {coupon.name} · {coupon.uses}{coupon.maxUses==null?" användningar":` av ${coupon.maxUses} användningar`} · {coupon.active?"Aktiv":"Avstängd"}</summary><ShopCouponForm coupon={coupon}/></details>)}</div></section>
 </div></>;
}
