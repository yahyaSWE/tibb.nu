"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import type { ShopOrder, ShopProduct, ShopSettings } from "@/lib/shop-types";
import type {
  ShopAdminActionState,
  ShopFulfillmentFields,
  ShopProductFields,
  ShopSettingsFields,
} from "@/lib/shop-admin-state";
import {
  saveShopProductAction,
  saveShopSettingsAction,
  updateShopFulfillmentAction,
} from "@/lib/shop-admin-actions";
import { useContentForm } from "@/lib/use-content-form";
import { Field } from "./common";
import { ShopImageUpload } from "./shop-image-upload";
import { ShopBundleEditor, type ShopBundleCatalogItem } from "./shop-bundle-editor";
import "./shop-admin.css";

function useInlineForm<Values>(
  action: (
    state: ShopAdminActionState<Values>,
    form: FormData,
  ) => Promise<ShopAdminActionState<Values>>,
  defaults: Values,
) {
  const [state, formAction, pending] = useActionState(
    async (previous: ShopAdminActionState<Values>, data: FormData) => {
      try {
        return await action(previous, data);
      } catch (error) {
        unstable_rethrow(error);
        return {
          error:
            "Det gick inte att spara. Din inmatning finns kvar. Kontrollera anslutningen och försök igen.",
        };
      }
    },
    {},
  );
  const [values, setValues] = useState(state.values ?? defaults);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.values) setValues(state.values);
  }, [state]);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);
  return {
    state: {
      ...state,
      success: !pending && values === state.values ? state.success : undefined,
    },
    action: formAction,
    pending,
    values,
    setValues,
    errorRef,
  };
}
function SaveButton({
  pending,
  disabled = false,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className="button button-primary"
      disabled={pending || disabled}
    >
      {pending ? (
        <>
          <LoaderCircle
            size={17}
            className="admin-submit-spinner"
            aria-hidden="true"
          />{" "}
          Sparar…
        </>
      ) : (
        <>
          <Save size={17} aria-hidden="true" />
          {children}
        </>
      )}
    </button>
  );
}
function FormMessage({
  state,
  errorRef,
}: {
  state: { error?: string; success?: string };
  errorRef: React.RefObject<HTMLDivElement | null>;
}) {
  return state.error ? (
    <div
      className="notice notice-error"
      role="alert"
      tabIndex={-1}
      ref={errorRef}
    >
      {state.error}
    </div>
  ) : state.success ? (
    <div className="notice notice-success" role="status">
      {state.success}
    </div>
  ) : null;
}

export function ShopSettingsForm({ settings }: { settings: ShopSettings }) {
  const form = useInlineForm<ShopSettingsFields>(saveShopSettingsAction, {
    enabled: settings.enabled,
    shippingEnabled: settings.shippingEnabled,
    pickupEnabled: settings.pickupEnabled,
    shippingPrice: String(settings.shippingPriceOre / 100),
    freeShippingThreshold:
      settings.freeShippingThresholdOre === null
        ? ""
        : String(settings.freeShippingThresholdOre / 100),
    pickupAddress: settings.pickupAddress,
    pickupInstructions: settings.pickupInstructions,
    terms: settings.terms,
  });
  const change = (field: keyof ShopSettingsFields, value: string | boolean) =>
    form.setValues({ ...form.values, [field]: value });
  return (
    <form action={form.action} className="stack" aria-busy={form.pending}>
      <FormMessage state={form.state} errorRef={form.errorRef} />
      <fieldset disabled={form.pending} className="stack content-form-fields">
        <legend className="sr-only">Butikens inställningar</legend>
        <label className="form-check shop-open-toggle">
          <input
            type="checkbox"
            name="enabled"
            checked={form.values.enabled}
            onChange={(event) => change("enabled", event.target.checked)}
          />
          <span>
            <strong>Öppna butiken på hemsidan</strong>
            <small>
              Om du stänger butiken stoppas nya köp. Påbörjade
              Stripe-betalningar och befintliga beställningar kan fortfarande
              behandlas. Du kan fortsätta redigera och förhandsgranska här.
            </small>
          </span>
        </label>
        <h3>Leveranssätt</h3>
        {settings.shippingRuleMode && <p className="notice">Regelbaserad frakt används. De fasta beloppen nedan används när regelbaserad frakt är avstängd. Hantera reglerna på <a className="text-link" href="/admin/frakt">Frakt</a>.</p>}
        <div className="shop-check-row">
          <label className="form-check">
            <input
              type="checkbox"
              name="shippingEnabled"
              checked={form.values.shippingEnabled}
              onChange={(event) =>
                change("shippingEnabled", event.target.checked)
              }
            />
            <span>Erbjud frakt</span>
          </label>
          <label className="form-check">
            <input
              type="checkbox"
              name="pickupEnabled"
              checked={form.values.pickupEnabled}
              onChange={(event) =>
                change("pickupEnabled", event.target.checked)
              }
            />
            <span>Erbjud hämtning</span>
          </label>
        </div>
        <div className="form-grid">
          <Field
            label="Fraktkostnad (kr)"
            name="shop-shipping-price"
            help="Ange kostnaden som kunden ska betala. 0 innebär fri frakt."
          >
            <input
              id="shop-shipping-price"
              name="shippingPrice"
              type="number"
              required
              min={0}
              max={10000}
              step="0.01"
              value={form.values.shippingPrice}
              onChange={(event) => change("shippingPrice", event.target.value)}
            />
          </Field>
          <Field
            label="Fri frakt från (kr)"
            name="shop-free-shipping"
            help="Valfritt. Lämna tomt om du inte vill använda en beloppsgräns."
          >
            <input
              id="shop-free-shipping"
              name="freeShippingThreshold"
              type="number"
              min={0}
              max={1000000}
              step="0.01"
              value={form.values.freeShippingThreshold}
              onChange={(event) =>
                change("freeShippingThreshold", event.target.value)
              }
            />
          </Field>
        </div>
        <Field label="Adress för hämtning" name="shop-pickup-address">
          <textarea
            id="shop-pickup-address"
            name="pickupAddress"
            rows={3}
            maxLength={1000}
            value={form.values.pickupAddress}
            onChange={(event) => change("pickupAddress", event.target.value)}
          />
        </Field>
        <Field
          label="Information om hämtning"
          name="shop-pickup-instructions"
          help="Beskriv till exempel hur kunden kommer överens med dig om en tid."
        >
          <textarea
            id="shop-pickup-instructions"
            name="pickupInstructions"
            rows={3}
            maxLength={5000}
            value={form.values.pickupInstructions}
            onChange={(event) =>
              change("pickupInstructions", event.target.value)
            }
          />
        </Field>
        <Field
          label="Butikens köpvillkor"
          name="shop-terms"
          help="Ange verksamhetens egna villkor. Texten visas för kunden inför beställning."
        >
          <textarea
            id="shop-terms"
            name="terms"
            rows={8}
            maxLength={20000}
            value={form.values.terms}
            onChange={(event) => change("terms", event.target.value)}
          />
        </Field>
      </fieldset>
      <div>
        <SaveButton pending={form.pending}>
          Spara butiksinställningar
        </SaveButton>
      </div>
    </form>
  );
}

export function ShopProductForm({ product, catalog = [], shippingRuleMode = false }: { product?: ShopProduct; catalog?: ShopBundleCatalogItem[]; shippingRuleMode?: boolean }) {
  const form = useContentForm<ShopProductFields>(
    saveShopProductAction,
    {
      kind: product?.kind ?? "product",
      weightGrams: String(product?.weightGrams ?? 0),
      bundleItems: (product?.bundleItems ?? []).map(item => ({productId:String(item.productId),quantity:String(item.quantity)})),
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      description: product?.description ?? "",
      price: product ? String(product.priceOre / 100) : "",
      vatPercent: String(product?.vatPercent ?? 25),
      stock: String(product?.stock ?? 0),
      published: product?.published ?? false,
      imageId: product?.imageId ?? "",
      expectedUpdatedAt: product?.updatedAt ?? "",
    },
    `product-${product?.id ?? "new"}`,
  );
  const search = useSearchParams();
  const saved = search.get("saved");
  const lastSaved = useRef(saved);
  useEffect(() => {
    if (
      product &&
      saved &&
      saved !== lastSaved.current &&
      search.get("savedForm") === `product-${product.id}`
    )
      form.setValues({
        kind: product.kind ?? "product",
        weightGrams: String(product.weightGrams ?? 0),
        bundleItems: (product.bundleItems ?? []).map(item => ({productId:String(item.productId),quantity:String(item.quantity)})),
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: String(product.priceOre / 100),
        vatPercent: String(product.vatPercent),
        stock: String(product.stock),
        published: product.published,
        imageId: product.imageId ?? "",
        expectedUpdatedAt: product.updatedAt,
      });
    lastSaved.current = saved;
  }, [saved, search, product, form.setValues]);
  const [imageBusy, setImageBusy] = useState(false);
  const change = (field: keyof ShopProductFields, value: string | boolean) =>
    form.setValues({ ...form.values, [field]: value });
  const bundle = form.values.kind === "bundle";
  return (
    <form
      action={form.action}
      className="stack"
      aria-busy={form.pending || imageBusy}
      onSubmit={(event) => {
        if (imageBusy) event.preventDefault();
        else form.onSubmit();
      }}
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      {product && (
        <input
          type="hidden"
          name="expectedUpdatedAt"
          value={form.values.expectedUpdatedAt}
        />
      )}
      {form.error && (
        <div
          className="notice notice-error"
          role="alert"
          tabIndex={-1}
          ref={form.errorRef}
        >
          {form.error}
        </div>
      )}
      <fieldset
        disabled={form.pending || imageBusy}
        className="stack content-form-fields"
      >
        <legend className="sr-only">Produktens uppgifter</legend>
        {product&&<input type="hidden" name="kind" value={form.values.kind}/>}
        <Field label="Produkttyp" name="shop-product-kind" help="Välj typen när du skapar produkten. Ett paket får eget pris och använder delarnas lager. Typen kan sedan inte ändras."><select id="shop-product-kind" name="kind" disabled={!!product} value={form.values.kind} onChange={event => change("kind", event.target.value)}><option value="product">Vanlig produkt</option><option value="bundle">Paket av produkter</option></select></Field>
        <div className="form-grid">
          <Field label="Produktnamn" name="shop-product-name">
            <input
              id="shop-product-name"
              name="name"
              required
              minLength={2}
              maxLength={150}
              value={form.values.name}
              onChange={(event) => change("name", event.target.value)}
            />
          </Field>
          <Field
            label="Adressnamn"
            name="shop-product-slug"
            help="Lämna tomt för att skapa adressen från produktnamnet."
          >
            <input
              id="shop-product-slug"
              name="slug"
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.values.slug}
              onChange={(event) => change("slug", event.target.value)}
            />
          </Field>
        </div>
        {!bundle ? <><Field label="Produktvikt (gram)" name="shop-product-weight" help={shippingRuleMode ? "Regelbaserad frakt används. Ange en positiv vikt för att produkten ska kunna skickas. 0 innebär okänd vikt." : "Ange produktens vikt utan emballage. 0 innebär okänd vikt."}><input id="shop-product-weight" name="weightGrams" type="number" required min={0} max={100000000} step={1} value={form.values.weightGrams} onChange={event => change("weightGrams", event.target.value)}/></Field>{form.values.bundleItems.map((item,index) => <span key={index}><input type="hidden" name="bundleProductId" value={item.productId}/><input type="hidden" name="bundleQuantity" value={item.quantity}/></span>)}</> : <><input type="hidden" name="weightGrams" value={form.values.weightGrams}/><ShopBundleEditor items={form.values.bundleItems} catalog={catalog.filter(item => item.id !== product?.id && item.kind !== "bundle")} onChange={items => form.setValues({...form.values,bundleItems:items})}/></>}
        <Field
          label="Produktbeskrivning"
          name="shop-product-description"
          help="Beskriv produkten och vad kunden får. Tomma rader skiljer stycken."
        >
          <textarea
            id="shop-product-description"
            name="description"
            rows={8}
            maxLength={20000}
            value={form.values.description}
            onChange={(event) => change("description", event.target.value)}
          />
        </Field>
        <div className="shop-product-numbers">
          <Field label="Pris inklusive moms (kr)" name="shop-product-price">
            <input
              id="shop-product-price"
              name="price"
              type="number"
              required
              min={0.01}
              max={100000}
              step="0.01"
              value={form.values.price}
              onChange={(event) => change("price", event.target.value)}
            />
          </Field>
          <Field label="Moms (%)" name="shop-product-vat">
            <select
              id="shop-product-vat"
              name="vatPercent"
              value={form.values.vatPercent}
              onChange={(event) => change("vatPercent", event.target.value)}
            >
              {[25, 12, 6, 0].map((value) => (
                <option value={value} key={value}>
                  {value} %
                </option>
              ))}
            </select>
          </Field>
          {!bundle ? <Field
            label="Tillgängligt lagersaldo"
            name="shop-product-stock"
            help="Väntande beställningars reserverade exemplar är redan avdragna."
          >
            <input
              id="shop-product-stock"
              name="stock"
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              value={form.values.stock}
              onChange={(event) => change("stock", event.target.value)}
            />
          </Field> : <div className="field"><span className="field-label">Lagersaldo</span><p className="small muted">Räknas automatiskt från delarna i paketet.</p><input type="hidden" name="stock" value={form.values.stock}/></div>}
        </div>
        <ShopImageUpload
          imageId={form.values.imageId}
          productName={form.values.name}
          disabled={form.pending}
          onChange={(id) => change("imageId", id)}
          onBusyChange={setImageBusy}
        />
        <label className="form-check">
          <input
            type="checkbox"
            name="published"
            checked={form.values.published}
            onChange={(event) => change("published", event.target.checked)}
          />
          <span>Publicera produkten i butiken</span>
        </label>
        <p className="small muted">
          En publicerad produkt visas först när butiken också är öppen. Utkast
          och slutsålda produkter kan fortsätta redigeras här.
        </p>
      </fieldset>
      <div>
        <SaveButton pending={form.pending} disabled={imageBusy}>
          {product ? "Spara produkt" : "Skapa produkt"}
        </SaveButton>
      </div>
    </form>
  );
}

export function ShopFulfillmentForm({
  order,
}: {
  order: Pick<
    ShopOrder,
    "id" | "delivery" | "status" | "fulfillment" | "trackingNumber"
  >;
}) {
  const form = useInlineForm<ShopFulfillmentFields>(
    updateShopFulfillmentAction,
    { fulfillment: order.fulfillment, trackingNumber: order.trackingNumber },
  );
  const options =
    order.delivery === "shipping"
      ? [
          { value: "unfulfilled", label: "Inte skickad" },
          { value: "shipped", label: "Skickad" },
        ]
      : [
          { value: "unfulfilled", label: "Inte klar för hämtning" },
          { value: "ready", label: "Klar för hämtning" },
          { value: "collected", label: "Hämtad" },
        ];
  if (order.status !== "paid")
    return (
      <div className="notice">
        Leveransstatus kan ändras när beställningen är betald och bekräftad.
      </div>
    );
  return (
    <form action={form.action} className="stack" aria-busy={form.pending}>
      <input type="hidden" name="id" value={order.id} />
      <FormMessage state={form.state} errorRef={form.errorRef} />
      <fieldset disabled={form.pending} className="stack content-form-fields">
        <legend className="sr-only">Beställningens leverans</legend>
        <Field label="Leveransstatus" name="shop-order-fulfillment">
          <select
            id="shop-order-fulfillment"
            name="fulfillment"
            value={form.values.fulfillment}
            onChange={(event) =>
              form.setValues({
                ...form.values,
                fulfillment: event.target.value,
              })
            }
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {order.delivery === "shipping" ? (
          <Field
            label="Spårningsnummer"
            name="shop-order-tracking"
            help="Valfritt. Ange transportörens spårningsnummer när du skickar beställningen."
          >
            <input
              id="shop-order-tracking"
              name="trackingNumber"
              maxLength={100}
              value={form.values.trackingNumber}
              onChange={(event) =>
                form.setValues({
                  ...form.values,
                  trackingNumber: event.target.value,
                })
              }
            />
          </Field>
        ) : (
          <input type="hidden" name="trackingNumber" value="" />
        )}
      </fieldset>
      <div>
        <SaveButton pending={form.pending}>Spara leveransstatus</SaveButton>
      </div>
    </form>
  );
}
