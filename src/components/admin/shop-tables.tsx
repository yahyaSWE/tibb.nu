"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation-link";
import type { ShopOrder, ShopProduct } from "@/lib/shop-types";
import { dateTime, EmptyState, Field, kronor } from "./common";
import {
  ShopFulfillmentBadge,
  ShopOrderBadge,
  ShopPaymentBadge,
  SHOP_ORDER_LABELS,
} from "./shop-status";
import "./shop-admin.css";

const PAGE_SIZE = 20;
type ProductRow = Pick<
  ShopProduct,
  | "id"
  | "name"
  | "slug"
  | "priceOre"
  | "vatPercent"
  | "stock"
  | "published"
  | "imageId"
>;
export type ShopOrderRow = Pick<
  ShopOrder,
  | "id"
  | "name"
  | "email"
  | "delivery"
  | "totalOre"
  | "status"
  | "paymentStatus"
  | "fulfillment"
  | "createdAt"
>;

function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="shop-pagination">
      <p className="small muted" role="status">
        {total} träffar · Sida {page} av {pages}
      </p>
      {pages > 1 && (
        <div className="shop-page-actions">
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Föregående
          </button>
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Nästa
          </button>
        </div>
      )}
    </div>
  );
}

export function ShopProductsTable({ products }: { products: ProductRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const query = search.trim().toLocaleLowerCase("sv-SE");
  const filtered = products.filter(
    (product) =>
      (!query ||
        `${product.name} ${product.slug}`
          .toLocaleLowerCase("sv-SE")
          .includes(query)) &&
      (status === "all" ||
        (status === "published" ? product.published : !product.published)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  return (
    <>
      <div className="shop-table-toolbar">
        <Field label="Sök produkt" name="shop-products-search">
          <input
            id="shop-products-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Namn eller adressnamn"
          />
        </Field>
        <Field label="Visa" name="shop-products-status">
          <select
            id="shop-products-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Alla produkter</option>
            <option value="published">Publicerade</option>
            <option value="draft">Utkast</option>
          </select>
        </Field>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">
              Produkter, pris, lager och publiceringsstatus
            </caption>
            <thead>
              <tr>
                <th scope="col">Produkt</th>
                <th scope="col">Pris inkl. moms</th>
                <th scope="col">Lager</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Åtgärd</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="shop-product-cell">
                      {product.imageId ? (
                        <img
                          src={`/api/shop/images/${product.imageId}`}
                          width={46}
                          height={46}
                          className="shop-thumbnail"
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="shop-thumbnail shop-thumbnail-empty">
                          <Package size={22} aria-hidden="true" />
                        </span>
                      )}
                      <div>
                        <strong>{product.name}</strong>
                        <small className="table-description">
                          /{product.slug}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {kronor(product.priceOre)}
                    <small className="table-description">
                      {product.vatPercent} % moms
                    </small>
                  </td>
                  <td>
                    {product.stock > 0 ? (
                      `${product.stock} st`
                    ) : (
                      <span className="badge badge-amber">Slutsåld</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${product.published ? "badge-green" : "badge-amber"}`}
                    >
                      {product.published ? "Publicerad" : "Utkast"}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/admin/produkter/${product.id}`}
                      intentOnly
                      className="button button-secondary button-small"
                      aria-label={`Redigera ${product.name}`}
                    >
                      Redigera
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Inga produkter matchar sökningen">
          Ändra sökningen eller välj en annan status.
        </EmptyState>
      )}
      <Pagination
        page={currentPage}
        pages={pages}
        total={filtered.length}
        onPage={setPage}
      />
    </>
  );
}

export function ShopOrdersTable({ orders }: { orders: ShopOrderRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const query = search.trim().toLocaleLowerCase("sv-SE");
  const filtered = orders.filter(
    (order) =>
      (!query ||
        `#${order.id} ${order.name} ${order.email}`
          .toLocaleLowerCase("sv-SE")
          .includes(query)) &&
      (status === "all" ||
        (status === "to-deliver"
          ? order.status === "paid" &&
            ["unfulfilled", "ready"].includes(order.fulfillment)
          : status === "refund_pending"
            ? order.paymentStatus === "refund_pending"
            : order.status === status)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  return (
    <>
      <div className="shop-table-toolbar">
        <Field label="Sök beställning" name="shop-orders-search">
          <input
            id="shop-orders-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Nummer, namn eller e-post"
          />
        </Field>
        <Field label="Visa" name="shop-orders-status">
          <select
            id="shop-orders-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Alla beställningar</option>
            <option value="to-deliver">Att leverera eller lämna ut</option>
            {Object.entries(SHOP_ORDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="refund_pending">Återbetalning väntar</option>
          </select>
        </Field>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">
              Beställningar med betalning och leveransstatus
            </caption>
            <thead>
              <tr>
                <th scope="col">Beställning</th>
                <th scope="col">Kund</th>
                <th scope="col">Summa</th>
                <th scope="col">Orderstatus</th>
                <th scope="col">Betalning</th>
                <th scope="col">Leverans</th>
                <th scope="col">
                  <span className="sr-only">Åtgärd</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>#{order.id}</strong>
                    <small className="table-description">
                      {dateTime(order.createdAt)}
                    </small>
                  </td>
                  <td>
                    <strong>{order.name}</strong>
                    <small className="table-description">{order.email}</small>
                  </td>
                  <td>{kronor(order.totalOre)}</td>
                  <td>
                    <ShopOrderBadge status={order.status} />
                  </td>
                  <td>
                    <ShopPaymentBadge status={order.paymentStatus} />
                  </td>
                  <td>
                    <ShopFulfillmentBadge status={order.fulfillment} />
                    <small className="table-description">
                      {order.delivery === "shipping" ? "Frakt" : "Hämtning"}
                    </small>
                  </td>
                  <td>
                    <Link
                      intentOnly
                      href={`/admin/bestallningar/${order.id}`}
                      className="button button-secondary button-small"
                      aria-label={`Visa beställning ${order.id}`}
                    >
                      Visa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Inga beställningar matchar sökningen">
          Ändra sökningen eller välj en annan status.
        </EmptyState>
      )}
      <Pagination
        page={currentPage}
        pages={pages}
        total={filtered.length}
        onPage={setPage}
      />
    </>
  );
}
