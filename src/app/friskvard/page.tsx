import Link from "next/link";
import { getShopSettings } from "@/lib/shop";
import { createPageMetadata } from "@/lib/seo";
import { WellnessBuilder } from "@/components/wellness-builder";
import { kustomReady, shopPaymentProvider } from "@/lib/shop-payment-config";
import { getPublicWellnessServices, WELLNESS_RULES_URL } from "@/lib/wellness";
import "./wellness.css";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({ title: "Friskvård och personliga klippkort", description: "Välj friskvård för avslappning och hälsosamma matvanor. Kombinera personliga behandlingstillfällen och få ett digitalt betalningsunderlag.", path: "/friskvard" });
export default async function WellnessPage() {
  const [products, settings] = await Promise.all([getPublicWellnessServices(), getShopSettings()]);
  const available = products.length > 0 && settings.enabled && shopPaymentProvider() === "kustom" && kustomReady();
  return <div className="wellness-page container">
    <header className="wellness-intro"><div><h1>Ge ditt välbefinnande <em>lite mer utrymme.</em></h1>
      <p>Friskvård för avslappning, mjukare muskelspänningar och hälsosamma matvanor. Välj ett tillfälle eller kombinera flera i ett personligt klippkort.</p>
      <a className="text-link" href="#valj-tillfallen">Bygg ditt friskvårdspaket ↓</a></div>
      <div className="wellness-how"><h2>Från köp till ditt nästa tillfälle</h2><ol><li>Välj tjänster och antal tillfällen.</li><li>Betala tryggt genom Kustom Checkout.</li><li>Få ditt personliga klippkort och PDF-kvitto efter styrkt betalning.</li><li>Boka dina tillfällen med oss.</li></ol><Link href="/kontakt" className="text-link">Frågor före ditt köp? Kontakta oss</Link></div></header>
    <WellnessBuilder products={products} available={available}/>
    {!products.length && <section className="wellness-examples"><h2>Friskvård hos Tibb.nu</h2><div><article><h3>Friskvårdsakupunktur</h3><p>Avslappning, välbefinnande och motverkande av muskelspänningar. Avser inte medicinsk sjukdomsbehandling.</p><p>Utgångspris: 500 kr inklusive moms per tillfälle.</p></article><article><h3>Individuell kostrådgivning</h3><p>Hälsosamma matvanor, måltidsrutiner och kostprinciper inom traditionell kinesisk medicin.</p><p>Exempelpris: 600 kr inklusive moms per tillfälle. Aktuella köpbara priser visas i paketbyggaren när tjänsterna öppnar.</p></article></div></section>}
    <section className="wellness-faq"><div><h2>Så fungerar friskvårdsbidraget</h2><p>Klippkortet gäller specificerade tjänster och tillfällen. Det är personligt och kan inte bytas mot pengar eller användas som ett allmänt presentkort.</p><a className="text-link" href={WELLNESS_RULES_URL} target="_blank" rel="noopener noreferrer">Läs aktuella regler hos Skatteverket ↗</a></div><div>
      <details><summary>Kan jag använda mitt friskvårdsbidrag?</summary><p>Friskvård för avslappning, motverkande av stelhet och hälsosamma matvanor kan omfattas. Arbetsgivaren bestämmer vad som ersätts och vilket underlag som behövs. Kontrollera gärna före köpet.</p></details>
      <details><summary>Hur mycket kan jag köpa för?</summary><p>Gränsen för skattefritt friskvårdsbidrag är normalt 5 000 kr per år. För aktiviteter utan motionsinslag får varje tillfälle normalt kosta högst 1 000 kr. Du kan köpa flera specificerade tillfällen; ett köp över 5 000 kr blockeras inte, men hela beloppet kanske inte ersätts.</p></details>
      <details><summary>När får jag mitt kvitto och klippkort?</summary><p>När betalningen är styrkt skickas ett PDF-kvitto till din e-post och blir tillgängligt på din privata beställningssida. Kvitton visar bara friskvårdstjänsterna och deras faktiska belopp efter rabatt. Klippkortets giltighet framgår av ditt köp, normalt tolv månader.</p></details>
      <details><summary>Vad gäller vid faktura eller delbetalning?</summary><p>En godkänd checkout eller auktoriserad betalning räcker inte som bevis på ett betalt utlägg. För faktura och delbetalning behöver kundbetalningen styrkas innan ett kvitto kan märkas som betalt. Kontakta oss med betalningsunderlaget om det behövs.</p></details>
      <details><summary>Ingår medicinsk behandling, örter eller kosttillskott?</summary><p>Nej. Medicinsk sjukdomsbehandling, medicinsk örtrådgivning, örter och kosttillskott ingår inte i friskvårdsunderlaget. Köper du även vanliga produkter hålls de utanför friskvårdskvittot.</p></details>
      <details><summary>Hur bokar jag och använder mina klipp?</summary><p>Kontakta oss eller använd den vanliga bokningssidan. Ange att du har ett personligt klippkort innan någon separat betalning görs. Vi registrerar ett använt tillfälle efter ditt besök. <Link href="/boka" className="text-link">Se behandlingar och bokning</Link>.</p></details>
    </div></section>
  </div>;
}
