import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getShopOrders } from "@/lib/shop";
import {
  AdminHeading,
  EmptyState,
  SectionHeading,
} from "@/components/admin/common";
import { ShopOrdersTable } from "@/components/admin/shop-tables";

export default async function ShopOrdersPage() {
  const user = await requireAdmin();
  const orders = await getShopOrders(user.id);
  const toDeliver = orders.filter(
    (order) =>
      order.status === "paid" &&
      ["unfulfilled", "ready"].includes(order.fulfillment),
  ).length;
  const awaitingPayment = orders.filter(
    (order) => order.status === "pending",
  ).length;
  return (
    <>
      <AdminHeading
        eyebrow="Din butik"
        title="Beställningar"
        description={`${orders.length} beställningar · ${toDeliver} att leverera eller lämna ut · ${awaitingPayment} väntar på betalning`}
        action={
          <Link href="/admin/butik" className="button button-secondary">
            Butiksinställningar
          </Link>
        }
      />
      <section className="panel">
        <SectionHeading
          title="Kundernas beställningar"
          description="Betalningsstatus hämtas från Stripe. Öppna en betald beställning för att uppdatera leveransen."
        />
        {orders.length ? (
          <ShopOrdersTable
            orders={orders.map(
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
          <EmptyState title="Inga beställningar ännu">
            När kunder beställer från din butik visas deras beställningar här.
          </EmptyState>
        )}
      </section>
    </>
  );
}
