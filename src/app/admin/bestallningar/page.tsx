import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getShopOrders } from "@/lib/shop";
import { getPendingShopWithdrawalIds } from "@/lib/shop-withdrawals";
import {
  AdminHeading,
  type AdminSearchParams,
  EmptyState,
  SectionHeading,
} from "@/components/admin/common";
import { ShopOrdersTable } from "@/components/admin/shop-tables";

export default async function ShopOrdersPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const user = await requireAdmin();
  const [orders, query, withdrawals] = await Promise.all([getShopOrders(user.id), searchParams, getPendingShopWithdrawalIds(user.id)]);
  const toDeliver = orders.filter(
    (order) =>
      order.status === "paid" && !withdrawals.has(order.id) &&
      order.items.some(item => !item.isService && !item.wellness) &&
      ["unfulfilled", "ready"].includes(order.fulfillment),
  );
  const awaitingPayment = orders.filter(
    (order) => order.status === "pending",
  );
  const filters = [
    { key: "alla", label: "Alla", orders },
    { key: "leverans", label: "Att leverera", orders: toDeliver },
    { key: "betalning", label: "Väntar på betalning", orders: awaitingPayment },
    { key: "angrade", label: "Ångrade köp", orders: orders.filter(order => withdrawals.has(order.id)) },
  ];
  const selected = filters.find(filter => filter.key === query.visa) ?? filters[0];
  return (
    <>
      <AdminHeading
        title="Beställningar"
        description="Följ betalningar och hantera leveranser och utlämning."
        action={
          <Link href="/admin/butik" className="button button-secondary">
            Butiksinställningar
          </Link>
        }
      />
      <nav className="admin-filter-tabs" aria-label="Filtrera beställningar">
        {filters.map(filter => (
          <Link key={filter.key} aria-current={filter === selected ? "page" : undefined}
            className={`button button-small ${filter === selected ? "button-primary" : "button-secondary"}`}
            href={filter.key === "alla" ? "/admin/bestallningar" : `/admin/bestallningar?visa=${filter.key}`}>
            {filter.label} ({filter.orders.length})
          </Link>
        ))}
      </nav>
      <section className="panel">
        <SectionHeading
          title="Kundernas beställningar"
          description="Öppna en beställning för att se betalningen eller uppdatera leveransen."
        />
        {selected.orders.length ? (
          <ShopOrdersTable
            orders={selected.orders.map(
              ({
                id,
                name,
                email,
                delivery,
                totalOre,
                status,
                paymentStatus,
                fulfillment,
                createdAt,
              }) => ({
                id,
                name,
                email,
                delivery,
                totalOre,
                status,
                paymentStatus,
                fulfillment,
                createdAt,
              }),
            )}
          />
        ) : (
          <EmptyState title={selected.key === "alla" ? "Inga beställningar ännu" : "Inga beställningar i det här urvalet"}>
            {selected.key === "alla" ? "När kunder beställer från din butik visas deras beställningar här." : (
              <Link className="text-link" href="/admin/bestallningar">Visa alla beställningar</Link>
            )}
          </EmptyState>
        )}
      </section>
    </>
  );
}
