import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import { getShopSettings, wellnessCheckoutReady } from "@/lib/shop";
import { createPageMetadata } from "@/lib/seo";
import { WellnessBuilder } from "@/components/wellness-builder";
import { getPublicWellnessServices, WELLNESS_RULES_URL } from "@/lib/wellness";
import "./wellness.css";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Friskvård och personliga klippkort",
  description: "Välj friskvård för avslappning och hälsosamma matvanor. Kombinera personliga behandlingstillfällen och få ett digitalt betalningsunderlag.",
  path: "/friskvard",
});

const questions = [
  {
    title: "Kan jag använda mitt friskvårdsbidrag?",
    answer: "Friskvård för avslappning, motverkande av stelhet och hälsosamma matvanor kan omfattas. Fråga din arbetsgivare vilka tjänster som ersätts och vilket underlag som behövs.",
  },
  {
    title: "Hur mycket kan jag köpa för?",
    answer: "Gränsen för skattefritt friskvårdsbidrag är normalt 5 000 kr per år. För aktiviteter utan motionsinslag får varje tillfälle normalt kosta högst 1 000 kr. Du kan köpa ett paket över 5 000 kr, men hela beloppet kanske inte ersätts.",
  },
  {
    title: "När får jag mitt kvitto och klippkort?",
    answer: "När betalningen är styrkt får du ditt klippkort och ett PDF-kvitto. Kvittot skickas till din e-post och finns på din privata beställningssida. Det visar bara friskvårdstjänsterna och beloppen efter eventuell rabatt.",
  },
  {
    title: "Vad gäller för klippkortet?",
    answer: "Klippkortet är personligt och gäller de tjänster och tillfällen som står på kvittot. Giltigheten framgår av köpet, normalt tolv månader. Klippkortet kan inte bytas mot pengar eller användas som ett allmänt presentkort.",
  },
  {
    title: "Vad gäller vid faktura eller delbetalning?",
    answer: "Kundbetalningen behöver styrkas innan kvittot kan märkas som betalt. Kontakta oss med betalningsunderlaget om det behövs.",
  },
  {
    title: "Ingår medicinsk behandling, örter eller kosttillskott?",
    answer: "Medicinsk sjukdomsbehandling, medicinsk örtrådgivning, örter och kosttillskott ingår inte i friskvårdsunderlaget. Vanliga produkter i samma order hålls utanför friskvårdskvittot.",
  },
];

export default async function WellnessPage() {
  const [products, settings] = await Promise.all([getPublicWellnessServices(), getShopSettings()]);
  const available = products.length > 0 && await wellnessCheckoutReady(settings);

  return (
    <div className="wellness-page container">
      <header className="wellness-intro">
        <div className="wellness-intro-copy">
          <h1>Friskvård på <em>dina villkor</em></h1>
          <p>Välj friskvård för avslappning och hälsosamma matvanor. Börja med ett tillfälle eller kombinera flera i ett personligt klippkort.</p>
          <div className="wellness-intro-actions">
            <a className="button button-primary" href="#valj-tillfallen">
              Se tjänster och priser <ArrowDown size={17} aria-hidden="true" />
            </a>
            <a className="text-link" href="#friskvardsbidrag">Så fungerar friskvårdsbidraget</a>
          </div>
          {products.length > 0 && !available && <p className="wellness-intro-status">Onlineköp är pausat. Du kan fortfarande se priser och sätta ihop ett paket.</p>}
        </div>
        <div className="wellness-intro-image">
          <Image src="/images/olive-still-life.png" alt="" fill sizes="(max-width: 720px) 94vw, (max-width: 1200px) 42vw, 580px" loading="eager" />
        </div>
      </header>

      <WellnessBuilder products={products} available={available} />

      {!products.length && (
        <section className="wellness-examples">
          <h2>Exempel på friskvård hos Tibb.nu</h2>
          <div>
            <article>
              <h3>Friskvårdsakupunktur</h3>
              <p>Avslappning, välbefinnande och motverkande av muskelspänningar. Avser inte medicinsk sjukdomsbehandling.</p>
              <p>Utgångspris 500 kr inklusive moms per tillfälle.</p>
            </article>
            <article>
              <h3>Individuell kostrådgivning</h3>
              <p>Hälsosamma matvanor, måltidsrutiner och kostprinciper inom traditionell kinesisk medicin.</p>
              <p>Exempelpris 600 kr inklusive moms per tillfälle.</p>
            </article>
          </div>
        </section>
      )}

      <section className="wellness-faq" id="friskvardsbidrag" aria-labelledby="friskvardsbidrag-title">
        <div>
          <h2 id="friskvardsbidrag-title">Så fungerar friskvårdsbidraget</h2>
          <p>Din arbetsgivare avgör vilka aktiviteter som ersätts. När betalningen är verifierad får du ett PDF-kvitto att lämna till arbetsgivaren.</p>
          <p><a className="text-link" href={WELLNESS_RULES_URL}>Se reglerna hos Skatteverket <ArrowRight size={15} aria-hidden="true" /></a></p>
        </div>
        <div>
          {questions.map(({ title, answer }) => (
            <details key={title}>
              <summary>{title}<ChevronDown size={18} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
          <details>
            <summary>Hur bokar jag och använder mina klipp?<ChevronDown size={18} aria-hidden="true" /></summary>
            <p>Kontakta oss eller använd den vanliga bokningssidan. Berätta att du har ett klippkort innan du betalar. Vi registrerar ett använt tillfälle efter besöket.</p>
            <p><Link href="/boka" className="text-link">Se behandlingar och bokning <ArrowRight size={15} aria-hidden="true" /></Link></p>
          </details>
        </div>
      </section>
    </div>
  );
}
