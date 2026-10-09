import type { ShopOrder } from "@/lib/shop-types";

export const SHOP_ORDER_LABELS: Record<ShopOrder["status"], string> = {
  pending: "Väntar på betalning",
  paid: "Bekräftad",
  cancelled: "Avbruten",
  refunded: "Återbetald",
};
export const SHOP_PAYMENT_LABELS: Record<ShopOrder["paymentStatus"], string> = {
  pending: "Obetald",
  paid: "Betald",
  refund_pending: "Återbetalning väntar",
  refunded: "Återbetald",
};
export const SHOP_FULFILLMENT_LABELS: Record<ShopOrder["fulfillment"], string> =
  {
    unfulfilled: "Inte levererad",
    ready: "Klar för hämtning",
    shipped: "Skickad",
    collected: "Hämtad",
  };

export function ShopOrderBadge({ status }: { status: ShopOrder["status"] }) {
  return (
    <span
      className={`badge ${status === "paid" ? "badge-green" : status === "pending" ? "badge-amber" : ""}`}
    >
      {SHOP_ORDER_LABELS[status]}
    </span>
  );
}
export function ShopPaymentBadge({
  status,
}: {
  status: ShopOrder["paymentStatus"];
}) {
  return (
    <span
      className={`badge ${status === "paid" ? "badge-green" : status === "pending" || status === "refund_pending" ? "badge-amber" : ""}`}
    >
      {SHOP_PAYMENT_LABELS[status]}
    </span>
  );
}
export function ShopFulfillmentBadge({
  status,
}: {
  status: ShopOrder["fulfillment"];
}) {
  return (
    <span className={`badge ${status !== "unfulfilled" ? "badge-green" : ""}`}>
      {SHOP_FULFILLMENT_LABELS[status]}
    </span>
  );
}
