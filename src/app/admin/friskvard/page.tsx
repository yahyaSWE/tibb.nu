import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { getWellnessAdmin, getWellnessSeller } from "@/lib/wellness";
import { getAdminShopProducts, getShopSettings, wellnessCheckoutStatus } from "@/lib/shop";
import { formatDateTime, formatMoney } from "@/lib/time";
import { WELLNESS_ADDRESS_THRESHOLD_ORE } from "@/lib/shop-types";
import { AdminHeading, AdminSectionNav } from "@/components/admin/common";
import { captureWellnessAction, initializeWellnessAction, manualWellnessAction, manualWellnessRefundAction, reconcileWellnessAction, refundWellnessAction, resendWellnessAction, saveWellnessSellerAction, saveWellnessServiceAction, useWellnessPassAction, verifyWellnessPaymentAction, voidDuplicateWellnessAction } from "@/lib/wellness-actions";
import "./wellness-admin.css";

export default async function WellnessAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; saved?: string }> }) {
  const user = await requireAdmin(); const params = await searchParams;
  const [data, seller, all, shop] = await Promise.all([getWellnessAdmin(user.id, params.q), getWellnessSeller(), getAdminShopProducts(user.id), getShopSettings()]);
  const services = all.filter(product => product.wellnessEligible);
  const checkout = await wellnessCheckoutStatus(shop);
  const now = new Date().toISOString();
  const active = data.passes.filter(pass => pass.status === "active" && String(pass.valid_until) > now && Number(pass.remaining) > 0);
  return <>
    <AdminHeading title="Friskvård" description="Hantera klippkort, köp, kvitton och tjänster." action={<div className="admin-heading-actions">
      <Link href="/admin/rabatter#ny-rabattkod" className="text-link">Skapa rabattkod</Link>
      <Link href="/friskvard" className="button button-secondary">Visa friskvårdssidan</Link>
    </div>}/>
    {params.error && <p className="notice notice-error" role="alert">{params.error}</p>}
    {params.saved && <p className="notice notice-success" role="status">{params.saved === "duplicate" ? "Dubbletten har makulerats och dess klippkort har spärrats." : "Ändringen är sparad."}</p>}
    {checkout.ready && services.some(service => service.published)
      ? <p className="notice notice-success">Friskvårdskassan är öppen.</p>
      : <div className="notice"><p>Friskvårdskassan är pausad.</p><ul>
        {checkout.blockers.includes("payment") && <li>Kustom Checkout behöver vara konfigurerat.</li>}
        {checkout.blockers.includes("terms") && <li>Fyll i köpvillkoren under <Link href="/admin/butik#butik-leverans" className="inline-link">Butik och leverans</Link>.</li>}
        {checkout.blockers.includes("seller") && <li>Kontrollera <a href="#kvittouppgifter" className="inline-link">kvittouppgifterna</a> och verksamhetens e-postadress.</li>}
        {checkout.blockers.includes("paused") && <li>Onlineköp är avstängt i den här miljön.</li>}
        {!services.some(service => service.published) && <li>Publicera minst en friskvårdstjänst.</li>}
      </ul></div>}
    <AdminSectionNav
      sections={[
        ["klippkort", "Klippkort"], ["kop", "Köp"], ["kvitton", "Kvitton"],
        ["historik", "Historik"], ["tjanster", "Tjänster"], ["kvittouppgifter", "Kvittouppgifter"],
      ]}
      action={<a href="#manuellt-kop" className="button button-secondary">Registrera manuellt köp</a>}
    />
    <div className="wellness-admin-sections">
    <section id="klippkort" tabIndex={-1} className="panel stack admin-section-target">
      <h2>Klippkort</h2>
      <form className="wellness-admin-search" method="get"><label className="field">Sök namn eller e-post<input type="search" name="q" defaultValue={params.q} maxLength={100}/></label><button className="button button-secondary">Sök</button></form>
      <p className="small muted">{active.length} aktiva klippkort av {data.passes.length} i listan. Vid sökning uppdateras även köp och kvitton nedan.</p>
      {!data.passes.length && <p>Inga klippkort att visa. De aktiveras efter styrkt betalning.</p>}
      {data.passes.map(pass => <article className="wellness-admin-row" key={String(pass.id)}><div><h3>{String(pass.service_name)}</h3><p>{String(pass.name)} · {String(pass.email)} · <a className="text-link" href={"#order-" + pass.order_id}>Order {Number(pass.order_id)}</a></p><p><strong>{Number(pass.remaining)} av {Number(pass.original_quantity)} tillfällen kvar</strong> · {pass.status === "blocked" ? "Spärrat för kontroll" : pass.status === "refunded" ? "Återbetalt" : String(pass.valid_until) <= now ? "Utgånget" : Number(pass.remaining) === 0 ? "Förbrukat" : "Aktivt"}</p><p className="small">Giltigt till {formatDateTime(String(pass.valid_until))} · Återbetalda tillfällen: {Number(pass.refunded_quantity)}</p></div>
        <form action={useWellnessPassAction} className="stack"><input type="hidden" name="passId" value={String(pass.id)}/><input type="hidden" name="operationId" value={randomUUID()}/><label className="field">Registrering, exempelvis besökets datum<input name="reason" required minLength={3} maxLength={300}/></label><button className="button button-primary" disabled={pass.status !== "active" || Number(pass.remaining) < 1 || String(pass.valid_until) <= now}>Använd ett klipp</button></form>
        {pass.status === "active" && Number(pass.remaining) > 0 && <details><summary>Återbetala oanvända tillfällen</summary><form action={pass.evidence_source === "manual" ? manualWellnessRefundAction : refundWellnessAction} className="stack"><input type="hidden" name="reference" value={String(pass.order_reference)}/><input type="hidden" name="productId" value={Number(pass.product_id)}/><input type="hidden" name="operationId" value={randomUUID()}/><label className="field">Antal<input type="number" name="quantity" min={1} max={Number(pass.remaining)} defaultValue={1} required/></label><label className="field">Orsak<input name="reason" required minLength={3} maxLength={300}/></label>{pass.evidence_source === "manual" ? <><label className="field">Datum för genomförd återbetalning<input type="datetime-local" name="refundedAt" required/></label><label className="field">Externt återbetalningsunderlag<input name="proofReference" minLength={5} maxLength={150} required/></label><label className="form-check"><input type="checkbox" name="verified" required/><span>Återbetalningen är redan genomförd och kontrollerad i ordinarie kassasystem.</span></label><p className="small">Registreringen gör ingen ny utbetalning. Klipp och korrigeringsunderlag uppdateras för den genomförda externa återbetalningen.</p></> : <p className="small">Åtgärden begär återbetalning hos Kustom. Klipp spärras under verifieringen. Separat korrigeringsunderlag skapas; ursprungskvittot behålls.</p>}<button className="button button-secondary">{pass.evidence_source === "manual" ? "Registrera genomförd återbetalning" : "Begär återbetalning"}</button></form></details>}
      </article>)}
    </section>
    <section id="kop" tabIndex={-1} className="panel stack admin-section-target">
      <h2>Köp</h2>
      {!data.orders.length && <p>Inga köp att visa.</p>}
      {data.orders.map(order => (
        <details className="wellness-admin-entry" key={String(order.reference)} id={"order-" + order.id}>
          <summary>
            <strong>Order {Number(order.id)}</strong> · {String(order.name)} · {formatMoney(Number(order.total_ore))}
            <span className="wellness-admin-entry-state">
              {order.voided_at ? "Makulerad dubblett" : order.customer_paid ? "Betald" : order.captured ? "Inväntar betalningsbevis" : order.status === "cancelled" ? "Avbruten" : "Inväntar betalning"}
            </span>
          </summary>
          <div className="stack wellness-admin-detail">
            <p>{String(order.email)}{order.payment_reference ? " · Betalningsreferens " + order.payment_reference : ""}</p>
            <Link className="text-link" href={"/admin/bestallningar/" + order.id}>Visa beställning</Link>
            {!!order.voided_at && <p>Makulerad {formatDateTime(String(order.voided_at))}. Order {Number(order.retained_order_id)} behölls. Orsak: {String(order.void_reason)}</p>}
            {!!order.kustom_order && !order.voided_at && <div className="wellness-admin-buttons">
              <form action={reconcileWellnessAction}><input type="hidden" name="reference" value={String(order.reference)}/><button className="button button-secondary">Kontrollera hos Kustom</button></form>
              <form action={captureWellnessAction}><input type="hidden" name="reference" value={String(order.reference)}/><button className="button button-secondary" disabled={!!order.captured}>Debitera vid leverans</button></form>
            </div>}
            {!order.voided_at && order.evidence_source === "manual" && order.status === "paid" && order.fulfillment === "unfulfilled" && (
              <details className="wellness-admin-void">
                <summary>Makulera dubblett</summary>
                <form action={voidDuplicateWellnessAction} className="stack wellness-admin-detail">
                  <p>Använd när samma betalning har registrerats två gånger. Dubblettens klipp måste vara oanvända. Makuleringen spärrar klippkorten och skapar ett korrigeringsunderlag. Ingen återbetalning görs.</p>
                  <input type="hidden" name="reference" value={String(order.reference)}/>
                  <label className="field">Ordernummer för köpet som ska behållas<input type="number" name="retainOrderId" min={1} step={1} required/></label>
                  <label className="field">Orsak till makulering<input name="reason" minLength={3} maxLength={300} required/></label>
                  <label className="form-check"><input type="checkbox" name="confirmed" required/><span>Jag har kontrollerat att det bara finns en betalning och att order {Number(order.id)} är dubbletten.</span></label>
                  <button className="button button-secondary">Makulera order {Number(order.id)}</button>
                </form>
              </details>
            )}
            {!!order.captured && !order.customer_paid && <form action={verifyWellnessPaymentAction} className="stack"><h3>Registrera styrkt kundbetalning</h3><p>För faktura/delbetalning: kontrollera att kunden faktiskt har betalat hela beloppet. En debiterad order räcker inte.</p><input type="hidden" name="reference" value={String(order.reference)}/><label className="field">Betalningsdatum, svensk tid<input name="paidAt" type="datetime-local" required/></label><label className="field">Betalt belopp, kr<input name="amount" type="number" min="0.01" step="0.01" defaultValue={Number(order.total_ore)/100} required/></label><label className="field">Referens till kontrollerat betalningsunderlag<input name="proofReference" minLength={5} maxLength={150} required/></label><label className="form-check"><input name="verified" type="checkbox" required/><span>Jag har kontrollerat bevis på kundens genomförda betalning.</span></label><button className="button button-primary">Styrk betalning och skapa kvitto</button></form>}
          </div>
        </details>
      ))}
    </section>
    <section id="kvitton" tabIndex={-1} className="panel stack admin-section-target">
      <h2>Kvitton och korrigeringar</h2>
      {!data.receipts.length && <p>Inga underlag har utfärdats.</p>}
      {data.receipts.map(receipt => {
        const revoked = receipt.kind === "purchase" && !!receipt.void_correction_id;
        const kind = revoked ? "Makulerat original" : receipt.id === receipt.void_correction_id ? "Makulering" : receipt.kind === "purchase" ? "Kvitto" : "Korrigering";
        const url = "/api/friskvard/kvitto/" + receipt.id;
        return (
          <details className="wellness-admin-entry" key={String(receipt.id)}>
            <summary><strong>{String(receipt.number)}</strong> · Order {Number(receipt.order_id)} · {formatMoney(Number(receipt.amount_ore))}<span className="wellness-admin-entry-state">{kind}</span></summary>
            <div className="wellness-admin-buttons wellness-admin-detail">
              <a className="text-link" href={url}>{revoked ? "Ladda ner makulerat kvitto" : "Ladda ner PDF"}</a>
              {!revoked && <>
                <a className="text-link" href={url + "?copy=updated"}>Generera ny PDF-kopia</a>
                {Number(receipt.order_total_ore) <= WELLNESS_ADDRESS_THRESHOLD_ORE && <a className="text-link" href={url + "?copy=updated&address=omit"}>Ny kopia utan kundadress</a>}
                <form action={resendWellnessAction}><input type="hidden" name="receiptId" value={String(receipt.id)}/><button className="button button-secondary">Skicka igen</button></form>
              </>}
            </div>
          </details>
        );
      })}
    </section>
    <section id="historik" tabIndex={-1} className="panel stack admin-section-target"><h2>Användningshistorik</h2>{!data.history.length && <p>Inga tillfällen registrerade.</p>}{data.history.map(event => <div className="wellness-admin-row" key={String(event.id)}><p>{formatDateTime(String(event.created_at))} · {String(event.service_name)} · {Number(event.change) === -1 ? "Ett klipp använt" : "Registrering korrigerad"}<br/>{String(event.reason)}</p>{Number(event.change) === -1 && !data.history.some(reversal => reversal.reverses_id === event.id) && <form action={useWellnessPassAction} className="stack"><input type="hidden" name="passId" value={String(event.pass_id)}/><input type="hidden" name="reverseId" value={String(event.id)}/><input type="hidden" name="operationId" value={randomUUID()}/><label className="field">Orsak till korrigering<input name="reason" minLength={3} maxLength={300} required/></label><button className="button button-secondary">Korrigera registreringen</button></form>}</div>)}</section>
    <section id="tjanster" tabIndex={-1} className="panel stack admin-section-target"><h2>Friskvårdstjänster</h2>{!services.length && <form action={initializeWellnessAction}><p>Skapa utkast för friskvårdsakupunktur (500 kr) och individuell kostrådgivning (exempelpris 600 kr). Granska och publicera dem när kassan är redo.</p><button className="button button-primary">Skapa de två tjänsteutkasten</button></form>}
      {[...services, null].map(service => <details key={service?.id ?? "new"}><summary>{service ? `${service.name} · ${formatMoney(service.priceOre)} · ${service.published ? "Aktiv" : "Utkast"}` : "Lägg till friskvårdstjänst"}</summary><form action={saveWellnessServiceAction} className="stack wellness-admin-detail">{service && <input type="hidden" name="id" value={service.id}/>}<label className="field">Namn<input name="name" defaultValue={service?.name} required minLength={2} maxLength={150}/></label><label className="field">Friskvårdsbeskrivning<textarea name="description" defaultValue={service?.description} required minLength={10} maxLength={4000} rows={3}/></label><div className="form-grid"><label className="field">Pris per tillfälle, inklusive moms (kr)<input name="price" type="number" min="0.01" max={1000} step="0.01" defaultValue={service ? service.priceOre/100 : undefined} required/></label><label className="field">Momssats<select name="vatPercent" defaultValue={service?.vatPercent ?? 25}>{[0,6,12,25].map(value => <option key={value} value={value}>{value} %</option>)}</select></label><label className="field">Giltighet i månader<input name="validityMonths" type="number" min={1} max={36} defaultValue={service?.validityMonths ?? 12} required/></label></div><label className="form-check"><input name="eligibilityConfirmed" type="checkbox" required/><span>Specificerad friskvård, inte medicinsk behandling, medicinsk örtrådgivning, produkter eller presentkort.</span></label><label className="form-check"><input name="active" type="checkbox" defaultChecked={service?.published ?? false}/><span>Aktiv och köpbar när butiken är öppen</span></label><button className="button button-primary">Spara tjänst</button></form></details>)}</section>
    <section id="kvittouppgifter" tabIndex={-1} className="panel stack admin-section-target"><h2>Verksamhetsuppgifter på kvittot</h2><p>{seller.legalName} · Org.nr {seller.organizationNumber}<br/>{seller.email || "E-post saknas i webbplatsens inställningar"}</p><p>Företagsnamn, organisationsnummer och e-post hämtas från <Link className="text-link" href="/admin/installningar">Inställningar</Link>. Ange de registrerade uppgifterna nedan; momsnummer härleds inte automatiskt.</p><form action={saveWellnessSellerAction} className="stack"><label className="field">Registrerat momsnummer<input name="vatNumber" defaultValue={seller.vatNumber} pattern="SE[0-9]{12}" required/></label><label className="field">Fullständig företagsadress<textarea name="address" defaultValue={seller.address} minLength={5} maxLength={1000} required/></label><button className="button button-primary">Spara kvittouppgifter</button></form></section>
    <section id="manuellt-kop" tabIndex={-1} className="panel stack admin-section-target"><h2>Registrera ett köp betalt på plats</h2><p>Registrera endast ett redan genomfört köp med kontrollerat externt betalnings-/kassakvitto. Detta skapar ett kompletterande friskvårdsunderlag till samma försäljning, inte en ny debitering och inte ett kassaregisterkvitto. Kassaregisterkrav hanteras i ert ordinarie kassasystem.</p><form action={manualWellnessAction} className="stack"><input name="operationId" type="hidden" value={randomUUID()}/><div className="form-grid">{[["name","För- och efternamn"],["email","E-post"],["address","Gatuadress (valfri)"],["postcode","Postnummer (valfritt)"],["city","Ort (valfri)"]].map(([name,label]) => <label className="field" key={name}>{label}<input name={name} type={name === "email" ? "email" : "text"} maxLength={name === "postcode" ? 6 : 200} required={name === "name" || name === "email"}/></label>)}
          <label className="field">
            Personnummer (valfritt)
            <input name="personalIdentityNumber" inputMode="numeric" autoComplete="off" maxLength={13} aria-describedby="wellness-personnummer-help"/>
            <small id="wellness-personnummer-help" className="muted">Ange 10 eller 12 siffror om kunden vill ha personnumret på kvittot. Det sparas när köpet registreras och följer med i kvittots PDF.</small>
          </label>
        </div><p className="small">Kundadress behövs vid köp över 4 000 kr.</p>{services.filter(service => service.published).map(service => <label className="field" key={service.id}>{service.name} · {formatMoney(service.priceOre)} per tillfälle<input type="hidden" name="productId" value={service.id}/><input type="number" name="quantity" min={0} max={99} defaultValue={0}/></label>)}<div className="form-grid"><label className="field">Betalningsdatum, svensk tid<input name="paidAt" type="datetime-local" required/></label><label className="field">Betalsätt<select name="method">{["Swish","Kort","Kontant","Banköverföring"].map(method => <option key={method}>{method}</option>)}</select></label></div><label className="field">Externt betalnings-/kassakvittonummer<input name="proofReference" minLength={5} maxLength={150} required/></label><label className="form-check"><input name="verified" type="checkbox" required/><span>Jag har verifierat betalningen och registrerat försäljningen i ordinarie kassasystem där det krävs.</span></label><button className="button button-primary" disabled={!services.some(service => service.published)}>Registrera det betalda köpet</button></form></section>
    </div>
  </>;
}
