import Link from "next/link";
import { Mail, MapPin, ArrowRight } from "lucide-react";
import { getSettings } from "@/lib/db";
export const metadata = { title: "Kontakt" };
export default async function ContactPage() {
  const s = await getSettings();
  return (
    <section className="section container narrow">
      <div className="page-heading">
        <span className="eyebrow">KONTAKT</span>
        <h1>Vi hörs gärna.</h1>
        <p>Har du frågor om behandlingar eller kurser? Här når du oss.</p>
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
        {s.location && (
          <p>
            <MapPin />
            {s.location}
          </p>
        )}
        {s.address && <p>{s.address}</p>}
        {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
        <Link href="/boka" className="text-link">
          Se behandlingar och lediga tider <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
