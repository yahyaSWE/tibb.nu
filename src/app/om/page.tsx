import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, createPageMetadata, organizationId, practitionerId, websiteId } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Johan Yahya Blomdahl – akupunktör i Jönköping", path: "/om",
  description: "Lär känna Johan Yahya Blomdahl, utbildad akupunktör och terapeut inom islamisk medicin. Läs om bakgrunden och behandlingarna hos Tibb.nu i Jönköping.",
});
export default function AboutPage() {
  return (
    <div className="container section">
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Person", "@id": practitionerId(),
          name: "Johan Yahya Blomdahl", url: absoluteUrl("/om"),
          jobTitle: "Akupunktör och terapeut inom islamisk medicin",
          description: "Utbildad akupunktör, terapeut inom islamisk medicin, elev till Dr Feroz Latib i Sydafrika och hijamautbildning i Egypten.",
          worksFor: { "@type": "Organization", "@id": organizationId(), name: "Tibb.nu" },
          workLocation: { "@type": "Place", name: "Jönköping" },
          knowsAbout: ["Akupunktur", "Klassisk kinesisk medicin", "Islamisk medicin", "Hijama"] },
        { "@context": "https://schema.org", "@type": "AboutPage", "@id": absoluteUrl("/om"),
          url: absoluteUrl("/om"), name: "Om Johan Yahya Blomdahl och Tibb.nu", inLanguage: "sv-SE",
          mainEntity: { "@id": practitionerId() }, isPartOf: { "@id": websiteId() } },
      ]} />
      <div className="page-heading">
        <span className="eyebrow">OM TIBB.NU</span>
        <h1>
          Rotad i tradition.
          <br />
          <em>Med människan i centrum.</em>
        </h1>
      </div>
      <div className="about-grid">
        <div className="about-image">
          <Image
            src="/images/olive-still-life.png"
            alt="Olivträdets blad och keramik i solljus"
            fill
            sizes="(max-width:760px) 100vw, 45vw"
          />
        </div>
        <div className="prose">
          <h2>Johan Yahya Blomdahl</h2>
          <p>Jag är verksam i Jönköping och arbetar med klassisk kinesisk medicin i ljuset av den Profetiska vägledningen.</p>
          <h3>Bakgrund och utbildning</h3>
          <ul>
            <li>Utbildad akupunktör.</li>
            <li>Terapeut inom islamisk medicin.</li>
            <li>Elev till Dr Feroz Latib i Sydafrika.</li>
            <li>Hijamautbildning i Egypten.</li>
          </ul>
          <p>Jag ansvarar för webbplatsens innehåll och presentation av verksamheten. Har du frågor om min bakgrund eller om en behandling är du välkommen att <Link href="/kontakt">kontakta mig</Link>.</p>
          <h2>En plats för möten och kunskap.</h2>
          <p>
            Tibb.nu är en plats för klassisk kinesisk medicin i ljuset av den
            Profetiska vägledningen. Här ryms personliga möten, lärande och
            reflektion.
          </p>
          <p>
            Vårt förhållningssätt börjar med att lyssna. Vi värdesätter varje
            människas berättelse, respekt för traditionernas ursprung och ett
            varsamt sätt att dela kunskap.
          </p>
          <h3>Olivträdet som inspiration</h3>
          <p>
            Olivträdet står för våra visuella rötter: långsam tillväxt, naturlig
            enkelhet och ett lugnt uttryck. Här finns utrymme att stanna upp och
            fördjupa din förståelse.
          </p>
          <Link href="/boka" className="button button-primary">
            Utforska behandlingar <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
