import Link from "next/link";
import { getDb } from "@/lib/db";
import { wellnessDownloadLink, wellnessOrderDocuments } from "@/lib/wellness";
import { formatDateTime } from "@/lib/time";

export async function WellnessOrderDocuments({ reference }: { reference: string }) {
  const [documents, state, snapshot] = await Promise.all([wellnessOrderDocuments(reference),
    getDb().prepare("SELECT captured,customer_paid,method,state,redirect_url FROM kustom_checkouts WHERE order_reference=?").get(reference),
    getDb().prepare("SELECT order_reference FROM wellness_order_snapshots WHERE order_reference=?").get(reference)]);
  const continuePayment = state?.state === "ready" && !state.captured && !!state.redirect_url;
  const needsPaymentProof = !!state?.captured && !state.customer_paid;
  if (!snapshot && !continuePayment && !needsPaymentProof && state?.state !== "uncertain") return null;
  const links = await Promise.all(documents.receipts.map(async receipt => ({ receipt, url: await wellnessDownloadLink(String(receipt.id)) })));
  return <section className="stack" style={{ marginBlock: 28 }}><h2>{snapshot ? "Ditt personliga friskvårdsköp" : "Din Kustom-betalning"}</h2>
    {documents.voided && <p>Det här köpet registrerades dubbelt och har makulerats. Ingen återbetalning gjordes.</p>}
    {state?.state === "uncertain" && <p className="notice">Betalningssessionen behöver kontrolleras. Gör inte ett nytt köp för samma beställning. Kontakta oss med beställningsreferensen på den här sidan.</p>}
    {needsPaymentProof && <p className="notice">Köpet är debiterat genom Kustom {String(state?.method)}. Kontakta oss med betalningsunderlaget för din faktura eller delbetalning.{snapshot && " Kvitto och klippkort blir tillgängliga när betalningen har kontrollerats."}</p>}
    {continuePayment && <Link className="button button-primary" href={`/api/kustom/redirect?ref=${reference}`} prefetch={false}>Fortsätt till Kustom Checkout</Link>}
    {!links.length && !!snapshot && <p>Inget betalt friskvårdskvitto har utfärdats ännu. En slutförd checkout eller auktorisation räcker inte som betalningsbevis.</p>}
    {links.map(({ receipt, url }) => <a className="text-link" key={String(receipt.id)} href={url}>{receipt.kind === "correction" ? "Ladda ner korrigeringsunderlag" : "Ladda ner friskvårdskvitto"} {String(receipt.number)} (PDF)</a>)}
    {documents.passes.map(pass => <div key={String(pass.id)}><h3>{String(pass.service_name)}</h3><p>{Number(pass.remaining)} av {Number(pass.original_quantity)} tillfällen kvar · Giltigt till {formatDateTime(String(pass.valid_until))}</p><p>{pass.status === "blocked" ? "Klippkortet är spärrat för kontroll." : pass.status === "refunded" ? "Klippkortet är återbetalt." : String(pass.valid_until) < new Date().toISOString() ? "Klippkortet har gått ut." : "Klippkortet är personligt. Kontakta oss när du vill boka ett tillfälle."}</p></div>)}
  </section>;
}
