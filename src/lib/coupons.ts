import { getDb } from "./database";
import { DomainError } from "./db";
import type { ShopCoupon } from "./shop-types";

type Row = Record<string, unknown>;
type Channel = "shop" | "booking";

// An unresolved Kustom payment holds its booking and coupon until reconciliation.
const couponSelect = `SELECT c.*,COALESCE(s.scope,'shop') AS applies_to,
  (SELECT COUNT(*) FROM shop_coupon_uses u JOIN shop_orders o ON o.id=u.order_id
   WHERE u.coupon_id=c.id AND (u.state='paid' OR (u.state='reserved' AND o.status='pending'
     AND (o.expires_at>?1 OR EXISTS (SELECT 1 FROM kustom_checkouts k WHERE k.order_reference=o.reference)))))
  + (SELECT COUNT(*) FROM booking_coupon_uses u JOIN bookings b ON b.id=u.booking_id
     WHERE u.coupon_id=c.id AND (u.redeemed=1 OR b.status IN ('confirmed','completed')
       OR (b.status='pending' AND (b.expires_at>?1 OR EXISTS (
         SELECT 1 FROM kustom_service_payments p WHERE p.reference=b.reference AND p.state='open'
       ))))) AS uses
  FROM shop_coupons c LEFT JOIN coupon_booking_scopes s ON s.coupon_id=c.id`;

function mapCoupon(row: Row): ShopCoupon {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as ShopCoupon["type"],
    value: Number(row.value),
    minSubtotalOre: Number(row.min_subtotal_ore),
    active: !!row.active,
    startsAt: row.starts_at ? String(row.starts_at) : null,
    endsAt: row.ends_at ? String(row.ends_at) : null,
    maxUses: row.max_uses == null ? null : Number(row.max_uses),
    combineWithOffers: !!row.combine_with_offers,
    uses: Number(row.uses),
    appliesTo: row.applies_to as ShopCoupon["appliesTo"],
  };
}

export async function listCoupons() {
  return (await getDb().prepare(`${couponSelect} ORDER BY c.id`).all(new Date().toISOString())).map(mapCoupon);
}

export async function findApplicableCoupon(code: string, subtotalOre: number, channel: Channel) {
  const now = new Date().toISOString();
  const row = await getDb().prepare(`${couponSelect} WHERE c.code=?2`).get(now, code.trim().toUpperCase());
  const coupon = row && mapCoupon(row);
  if (!coupon || !coupon.active || (coupon.appliesTo !== channel && coupon.appliesTo !== "both")
      || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt <= now)
      || subtotalOre < coupon.minSubtotalOre || (coupon.maxUses !== null && coupon.uses >= coupon.maxUses)) {
    throw new DomainError(channel === "booking"
      ? "Rabattkoden kan inte användas för den här bokningen."
      : "Rabattkoden kan inte användas för den här beställningen.");
  }
  return coupon;
}

export function couponDiscountOre(coupon: ShopCoupon, subtotalOre: number) {
  return coupon.type === "fixed" ? coupon.value : Math.round(subtotalOre * coupon.value / 100);
}

export async function bookingCouponPrice(code: string, priceOre: number) {
  const coupon = await findApplicableCoupon(code, priceOre, "booking");
  const discountOre = couponDiscountOre(coupon, priceOre);
  if (discountOre <= 0 || discountOre >= priceOre) {
    throw new DomainError("Rabattkoden kan inte användas för behandlingens pris.");
  }
  return { coupon, discountOre, totalOre: priceOre - discountOre };
}
