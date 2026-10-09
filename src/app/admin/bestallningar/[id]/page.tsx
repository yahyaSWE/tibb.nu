import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAdminShopOrder } from "@/lib/shop";
import { getShopOrderEmailStatus } from "@/lib/shop-email";
import { ShopOrderEmailRetry } from "@/components/admin/shop-order-email";
import {
  AdminHeading,
  dateTime,
  kronor,
  SectionHeading,
} from "@/components/admin/common";
import { ShopFulfillmentForm } from "@/components/admin/shop-forms";
import {
  ShopFulfillmentBadge,
  ShopOrderBadge,
  ShopPaymentBadge,
} from "@/components/admin/shop-status";

export default async function ShopOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound();
  const order = await getAdminShopOrder(user.id, orderId);
  if (!order) notFound();
  const email = await getShopOrderEmailStatus(order.id);
  const emailLabels = { pending: "Väntar på utskick", sending: "Behandlas", sent: "Accepterat av e-posttjänsten", failed: "Försöken har avslutats – kontrollera Resend", skipped: "Utskick avbrutet" };
  return (
    <>
      <AdminHeading
        eyebrow="Din butik"
        title={`Beställning #${order.id}`}
        description={`Skapad ${dateTime(order.createdAt)} · ${order.delivery === "shipping" ? "Frakt" : "Hämtning"}`}
        action={
          <Link href="/admin/bestallningar" className="text-link">
            Alla beställningar
          </Link>
        }
      />
      <div className="stack">
        <div className="shop-status-row">
          <span>
            <span className="sr-only">Orderstatus: </span>
            <ShopOrderBadge status={order.status} />
          </span>
          <span>
            <span className="sr-only">Betalning: </span>
            <ShopPaymentBadge status={order.paymentStatus} />
          </span>
          <span>
            <span className="sr-only">Leverans: </span>
            <ShopFulfillmentBadge status={order.fulfillment} />
          </span>
        </div>
        {order.paymentStatus === "refund_pending" && (
          <div className="notice">
            En betalning har registrerats för en avbruten beställning och
            återbetalning väntar. Kontrollera betalningen i Stripe.
            Beställningen ska inte levereras.
          </div>
        )}
        <div className="shop-detail-grid">
          <div className="stack">
            <section className="panel">
              <SectionHeading title="Produkter" />
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">
                    Beställningens produkter och priser vid köpet
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Produkt</th>
                      <th scope="col">Antal</th>
                      <th scope="col">Pris/st inkl. moms</th>
                      <th scope="col">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={`${item.productId}-${index}`}>
                        <td>
                          <strong>{item.name}</strong>
                          <small className="table-description">
                            {item.vatPercent} % moms
                          </small>
                          {item.bundleParts?.map(part=><small className="table-description" key={part.productId}>{part.quantity} × {part.name} ingår totalt</small>)}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{kronor(item.priceOre)}</td>
                        <td>{kronor(item.lineTotalOre??item.priceOre * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shop-totals">
                <div>
                  <span>Produkter före rabatter</span>
                  <strong>{kronor(order.originalSubtotalOre??order.subtotalOre)}</strong>
                </div>
                {order.discounts?.map((discount,index)=><div key={index}><span>{discount.name}{discount.code?` (${discount.code})`:""}</span><strong>−{kronor(discount.amountOre)}</strong></div>)}
                <div><span>Produkter efter rabatter</span><strong>{kronor(order.subtotalOre)}</strong></div>
                <div>
                  <span>
                    {order.shippingLabel||(order.delivery === "shipping" ? "Frakt" : "Hämtning")}
                  </span>
                  <strong>{kronor(order.shippingOre)}</strong>
                </div>
                <div className="shop-total">
                  <span>Totalt inkl. moms</span>
                  <span>{kronor(order.totalOre)}</span>
                </div>
              </div>
              <p className="small muted">
                Priserna och produktuppgifterna är sparade från
                beställningstillfället.
              </p>
            </section>
            <section className="panel">
              <SectionHeading title="Leveransstatus" />
              <ShopFulfillmentForm order={{ id: order.id, delivery: order.delivery, status: order.status, fulfillment: order.fulfillment, trackingNumber: order.trackingNumber }} />
            </section>
            <section className="panel">
              <details>
                <summary>
                  <strong>Köpvillkor vid beställningen</strong>
                </summary>
                <p className="shop-saved-text">
                  {order.terms ||
                    "Inga köpvillkor sparades för den här beställningen."}
                </p>
              </details>
            </section>
          </div>
          <div className="stack">
            <section className="panel">
              <SectionHeading title="Kund" />
              <dl className="shop-order-data">
                <div>
                  <dt>Namn</dt>
                  <dd>{order.name}</dd>
                </div>
                <div>
                  <dt>E-post</dt>
                  <dd>
                    <a className="text-link" href={`mailto:${order.email}`}>
                      {order.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Telefon</dt>
                  <dd>
                    {order.phone ? (
                      <a
                        className="text-link"
                        href={`tel:${order.phone.replace(/[^+\d]/g, "")}`}
                      >
                        {order.phone}
                      </a>
                    ) : (
                      "Ej angivet"
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="panel">
              <SectionHeading
                title={
                  order.delivery === "shipping" ? "Leveransadress" : "Hämtning"
                }
              />
              <dl className="shop-order-data">
                {order.delivery === "shipping" ? (
                  <>
                    <div>
                      <dt>Adress</dt>
                      <dd>
                        {order.address}
                        {"\n"}
                        {order.postcode} {order.city}
                      </dd>
                    </div>
                    {order.trackingNumber && (
                      <div>
                        <dt>Spårningsnummer</dt>
                        <dd>{order.trackingNumber}</dd>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <dt>Adress för hämtning</dt>
                      <dd>{order.pickupAddress}</dd>
                    </div>
                    {order.pickupInstructions && (
                      <div>
                        <dt>Information till kunden</dt>
                        <dd>{order.pickupInstructions}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </section>
            <section className="panel">
              <SectionHeading title="Betalning" />
              <ShopPaymentBadge status={order.paymentStatus} />
              <p className="small muted">
                Betalningsstatus uppdateras från Stripe och kan inte sättas
                manuellt här. Eventuell manuell återbetalning hanteras i Stripe.
              </p>
            </section>
            <section className="panel stack">
              <SectionHeading title="Orderbekräftelse via e-post" description="Accepterat betyder att Resend har tagit emot meddelandet. Kontrollera faktisk leverans i Resend." />
              {!email.configured && <p className="notice">E-posttjänsten är inte ansluten. Beställningen finns kvar; bekräftelsen väntar tills Resend har konfigurerats.</p>}
              <dl className="shop-order-data">
                {(["customer", "admin"] as const).map(recipient => <div key={recipient}>
                  <dt>{recipient === "customer" ? "Kundbekräftelse" : "Avisering till verksamheten"}</dt>
                  <dd>{email[recipient] ? emailLabels[email[recipient].status] : "Inget utskick registrerat"}</dd>
                </div>)}
              </dl>
              {email.configured && order.status === "paid" && order.paymentStatus === "paid" && <ShopOrderEmailRetry orderId={order.id} />}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
