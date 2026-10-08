import Link from "next/link";
import { Mail, MapPin, ArrowRight } from "lucide-react";
import { getSiteSettings } from "@/lib/site-data";
import { getBusinessSettings } from "@/lib/business-settings";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildOrganizationSchema, createPageMetadata, organizationId, websiteId } from "@/lib/seo";
export const metadata = createPageMetadata({
  title: "Kontakta Tibb.nu i Jönköping", path: "/kontakt",
  description: "Kontakta Johan Yahya Blomdahl på Tibb.nu om behandlingar i Jönköping, bokning och kurser. Här hittar du verksamhetens kontaktuppgifter.",
});
export default async function ContactPage() {
  const [s, business] = await Promise.all([getSiteSettings(), getBusinessSettings()]);
  return (
    <section className="section container narrow">
      <JsonLd data={[
        buildOrganizationSchema(s),
        { "@context": "https://schema.org", "@type": "ContactPage", "@id": absoluteUrl("/kontakt"),
          url: absoluteUrl("/kontakt"), name: "Kontakta Tibb.nu i Jönköping", inLanguage: "sv-SE",
          mainEntity: { "@id": organizationId() }, isPartOf: { "@id": websiteId() } },
      ]} />
      <div className="page-heading">
        <span className="eyebrow">KONTAKT</span>
        <h1>Vi hörs gärna.</h1>
        <p>Har du frågor om behandlingar i Jönköping eller kurser? Här når du Johan Yahya Blomdahl på Tibb.nu.</p>
      </div>
      <div className="panel contact-details">
        {s.email ? (
          <a href={`mailto:${s.email}`}>
            <Mail />
            {s.email}
          </a>
        ) : (
          <p>
            Kontaktuppgifter publiceras här när mottagningen öppnar för
            bokningar.
          </p>
        )}
        <p><MapPin /> {s.address || "Jönköping"}</p>
        {s.location && s.location !== "Jönköping" && (
          <p>
            <MapPin />
            {s.location}
          </p>
        )}
        {!s.address && <p>Kontakta oss för besöksadress och vägbeskrivning innan du bokar.</p>}
        {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
        <p>{business.legalName} · Org.nr {business.organizationNumber}</p>
        <Link href="/boka" className="text-link">
          Se behandlingar och lediga tider <ArrowRight size={18} />
        </Link>
        <Link href="/vanliga-fragor" className="text-link">Vanliga frågor om bokning och kurser <ArrowRight size={18} /></Link>
        <Link href="/villkor" className="text-link">Boknings- och kursvillkor <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}
