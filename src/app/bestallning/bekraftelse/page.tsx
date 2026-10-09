import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock3, Package, X } from "lucide-react";
import { getShopOrderByReference } from "@/lib/shop";
import { getSiteSettings } from "@/lib/site-data";
import { getShopOrderEmailStatus } from "@/lib/shop-email";
import { PRIVATE_METADATA } from "@/lib/seo";
import { formatDateTime, formatMoney } from "@/lib/time";
import { TextContent } from "@/components/learning/cards";
import { OrderControls } from "@/components/shop/order-controls";
import { ClearPurchasedCart } from "@/components/shop/shop-cart";

export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Din beställning" };
export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; cancelled?: string }>;
}) {
  const { ref, cancelled } = await searchParams;
  if (typeof ref !== "string" || !/^[a-f0-9]{32}$/.test(ref)) notFound();
  const order = await getShopOrderByReference(ref);
  if (!order) notFound();
  const [settings, email] = await Promise.all([
    getSiteSettings(),
    getShopOrderEmailStatus(order.id),
  ]);
  const paid = order.status === "paid" && order.paymentStatus === "paid";
  const pending = order.status === "pending";
  const refundPending = order.paymentStatus === "refund_pending";
  const title = paid
    ? "Tack för din beställning."
    : pending
      ? "Betalningen väntar på bekräftelse."
      : refundPending
        ? "Återbetalningen behandlas."
        : order.status === "refunded"
          ? "Beställningen är återbetald."
          : "Beställningen är avbruten.";
  const fulfillment = {
    unfulfilled: "Beställningen är mottagen",
    ready: "Klar för hämtning",
    shipped: "Skickad",
    collected: "Hämtad",
  }[order.fulfillment];
  return (
    <section className="shop section container narrow">
      <div className="shop-order-panel">
        <span className="shop-order-icon" aria-hidden="true">
          {paid ? (
            <Check size={30} />
          ) : pending || refundPending ? (
            <Clock3 size={30} />
          ) : (
            <X size={30} />
          )}
        </span>
        <p className="eyebrow">Din beställning</p>
        <h1 className="page-title">{title}</h1>
        <p className="muted">
          {paid
            ? "Betalningen är bekräftad. Spara denna privata sida med uppgifterna om ditt köp."
            : pending
              ? "Status hämtas från beställningen. En återkomst från betalningssidan bekräftar inte att betalningen är klar."
              : refundPending
                ? "Beställningen kommer inte att levereras. En återbetalning väntar på bekräftelse."
                : order.status === "refunded"
                  ? "Återbetalningen är registrerad för beställningen."
                  : "Ingen leverans kommer att göras från denna beställning."}
        </p>
        {cancelled === "1" && pending && (
          <p className="notice">
            Du har lämnat betalningen. Beställningen väntar fortfarande; välj
            nedan om du vill avbryta den.
          </p>
        )}
        <p className="shop-private-note">
          Länken ger tillgång till dina beställningsuppgifter. Spara den och
          dela den inte.
        </p>
        {paid && (
          <p className="muted">
            {email.customer?.status === "sent"
              ? "E-postbekräftelsen har skickats till e-posttjänsten. Kontrollera inkorg och skräppost; spara också denna sida."
              : email.configured &&
                  (email.customer?.status === "pending" ||
                    email.customer?.status === "sending")
                ? "E-postbekräftelsen väntar på utskick. Spara denna sida som bekräftelse på beställningen."
                : email.customer?.status === "failed"
                  ? "E-postbekräftelsen kunde inte skickas. Spara denna sida och kontakta verksamheten om du behöver hjälp."
                  : "Någon e-postbekräftelse är ännu inte skickad. Spara denna sida som bekräftelse på beställningen."}
          </p>
        )}
        <dl className="detail-list">
          <div>
            <dt>Beställningsreferens</dt>
            <dd className="shop-reference">{order.reference}</dd>
          </div>
          <div>
            <dt>Beställd</dt>
            <dd>{formatDateTime(order.createdAt)}</dd>
          </div>
          <div>
            <dt>Kund</dt>
            <dd>{order.name}</dd>
          </div>
          <div>
            <dt>E-post</dt>
            <dd>{order.email}</dd>
          </div>
          <div>
            <dt>Leveransval</dt>
            <dd>
              {order.delivery === "shipping"
                ? "Leverans inom Sverige"
                : "Hämtning"}
            </dd>
          </div>
          {paid && (
            <div>
              <dt>Status</dt>
              <dd>{fulfillment}</dd>
            </div>
          )}
        </dl>
        <h2 className="shop-order-subheading">Varor</h2>
        <ul className="shop-checkout-lines">
          {order.items.map((item, index) => (
            <li key={`${item.productId}-${index}`}>
              <span>
                {item.quantity} × {item.name}
                <small>
                  {formatMoney(item.priceOre)} per styck · inklusive{" "}
                  {item.vatPercent}% moms
                </small>
                {item.bundleParts?.map(part=><small key={part.productId}>{part.quantity} × {part.name} ingår totalt</small>)}
              </span>
              <strong>{formatMoney(item.lineTotalOre??item.quantity * item.priceOre)}</strong>
            </li>
          ))}
        </ul>
        <dl className="shop-order-totals">
          <div>
            <dt>Varor före rabatter</dt>
            <dd>{formatMoney(order.originalSubtotalOre??order.subtotalOre)}</dd>
          </div>
          {order.discounts?.map((discount,index)=><div key={index}><dt>{discount.name}{discount.code?` (${discount.code})`:""}</dt><dd>−{formatMoney(discount.amountOre)}</dd></div>)}
          <div><dt>Varor efter rabatter</dt><dd>{formatMoney(order.subtotalOre)}</dd></div>
          <div>
            <dt>{order.shippingLabel||(order.delivery === "shipping" ? "Frakt" : "Hämtning")}</dt>
            <dd>{formatMoney(order.shippingOre)}</dd>
          </div>
          <div className="shop-total">
            <dt>Totalt, inklusive moms</dt>
            <dd>{formatMoney(order.totalOre)}</dd>
          </div>
        </dl>
        {order.delivery === "shipping" ? (
          <div className="shop-order-address">
            <h2 className="shop-order-subheading">
              <Package size={22} aria-hidden="true" />
              Leveransadress
            </h2>
            <p>
              {order.name}
              <br />
              {order.address}
              <br />
              {order.postcode} {order.city}
              <br />
              Sverige
            </p>
            {paid && order.trackingNumber && (
              <p>
                Spårningsnummer: <strong>{order.trackingNumber}</strong>
              </p>
            )}
          </div>
        ) : (
          <div className="shop-order-address">
            <h2 className="shop-order-subheading">Hämtningsplats</h2>
            <p>{order.pickupAddress}</p>
            {order.pickupInstructions && (
              <TextContent text={order.pickupInstructions} />
            )}
            {paid && order.fulfillment === "unfulfilled" && (
              <p className="muted">
                Invänta besked om att beställningen är klar för hämtning.
              </p>
            )}
          </div>
        )}
        {order.terms && (
          <details className="shop-checkout-terms">
            <summary>Köpvillkor för denna beställning</summary>
            <TextContent text={order.terms} />
          </details>
        )}
        {settings.email && (
          <p className="muted">
            Frågor om beställningen?{" "}
            <a
              className="inline-link"
              href={`mailto:${settings.email}?subject=${encodeURIComponent(`Beställning ${order.reference}`)}`}
            >
              Kontakta {settings.email}
            </a>
            .
          </p>
        )}
        <OrderControls reference={order.reference} pending={pending} />
        {refundPending && (
          <a
            className="button button-secondary"
            href={`/bestallning/bekraftelse?ref=${order.reference}`}
          >
            Uppdatera återbetalningsstatus
          </a>
        )}
        <div className="shop-order-links">
          {paid && <ClearPurchasedCart />}
          <Link href="/" className="button button-secondary">
            Till startsidan
          </Link>
          <Link href="/kontakt" className="inline-link">
            Kontakt
          </Link>
        </div>
      </div>
    </section>
  );
}
