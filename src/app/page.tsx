import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Leaf,
  Sprout,
} from "lucide-react";
import { getArticles, getCourses, getPractitioners, getTreatments } from "@/lib/db";
import { formatMoney } from "@/lib/time";
import { getSiteSettings } from "@/lib/site-data";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, buildOrganizationSchema, createPageMetadata, organizationId, websiteId } from "@/lib/seo";
import "./home.css";

export const metadata = {
  ...createPageMetadata({
    title: "Traditionell kinesisk medicin i Jönköping | Tibb.nu", path: "/",
    description: "Behandlingar i Jönköping hos Tibb.nu. Klassisk kinesisk medicin i ljuset av profetisk vägledning. Boka behandling, läs artiklar och utforska våra kurser.",
  }),
  // Every URL above is absolute. Preserve the requested homepage trailing slash.
  metadataBase: null,
};

export default async function HomePage() {
  const [allCourses, allArticles, treatments, settings, practitioners] = await Promise.all([
    getCourses({ publishedOnly: true }),
    getArticles({ publishedOnly: true }),
    getTreatments({ activeOnly: true }),
    getSiteSettings(),
    getPractitioners({ activeOnly: true }),
  ]);
  const courses = allCourses.slice(0, 2);
  const articles = allArticles.slice(0, 3);
  const portrait = practitioners.find((person) =>
    person.name.trim().toLocaleLowerCase("sv") === "johan yahya blomdahl"
  )?.photoUrl;
  return (
    <div className="home-page">
      <JsonLd id="website-data" data={[
        buildOrganizationSchema(settings),
        { "@context": "https://schema.org", "@type": "WebSite", "@id": websiteId(),
          name: "Tibb.nu", url: absoluteUrl("/"), inLanguage: "sv-SE", publisher: { "@id": organizationId() } },
      ]} />
      <section className="home-hero-section">
        <div className="home-hero container">
          <div className="hero-copy">
            <h1>Klassisk kinesisk medicin i Jönköping</h1>
            <p className="hero-intro">
              Hos Johan Yahya Blomdahl möts klassisk kinesisk medicin och profetisk vägledning.
            </p>
            <div className="hero-actions">
              <Link href="/boka" className="button button-primary">
                Boka en behandling <ArrowUpRight size={18} />
              </Link>
              <Link href={treatments.length ? "#behandlingar" : "/om"} className="text-link">
                {treatments.length ? "Se priser och längd" : "Om Johan"} <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className={portrait ? "hero-image-stage" : "hero-image-stage hero-still-life"}>
            <div className="hero-image-wrap">
              <Image
                src={portrait || "/images/olive-still-life.png"}
                unoptimized={Boolean(portrait)}
                alt={portrait ? "Johan Yahya Blomdahl" : ""}
                fill
                priority
                sizes="(max-width: 650px) calc(100vw - 48px), (max-width: 850px) 44vw, 470px"
                className="hero-image"
              />
            </div>
          </div>
        </div>
      </section>
      <section id="behandlingar" className="section container paths-section" aria-labelledby="treatments-title">
        <div className="section-heading">
          <h2 id="treatments-title">Behandlingar</h2>
          {treatments.length > 3 && <Link href="/boka" className="text-link">Alla behandlingar <ArrowRight size={17} /></Link>}
        </div>
        {treatments.length ? (
          <div className="paths-grid">
            {treatments.slice(0, 3).map((treatment) => (
              <Link key={treatment.id} href={`/boka?behandling=${treatment.id}`} className="path-card">
                <h3>{treatment.name}</h3>
                <p>{treatment.description}</p>
                <strong className="home-treatment-meta">
                  {formatMoney(treatment.priceOre)} · {treatment.durationMinutes} min
                  {treatment.deliveryMode === "remote" && " · Distans"}
                </strong>
                <span className="path-card-bottom">Se lediga tider <ArrowRight size={17} /></span>
              </Link>
            ))}
          </div>
        ) : (
          <p>Det finns inga behandlingar att boka just nu. <Link href="/kontakt" className="text-link">Kontakta mottagningen</Link></p>
        )}
      </section>
      <section
        className="home-visit-section container"
        aria-labelledby="home-practitioner-title home-visit-title"
      >
        <div className="home-practitioner">
          <h2 id="home-practitioner-title">Johan Yahya Blomdahl</h2>
          <p>
            Utbildad akupunktör och terapeut inom islamisk medicin.
            Verksam i Jönköping.
          </p>
          <Link href="/om" className="text-link">
            Bakgrund och utbildningar <ArrowRight size={18} />
          </Link>
        </div>
        <div className="home-visit-details">
          <h2 id="home-visit-title">Inför ditt besök</h2>
          <p>
            Vid första mötet får du berätta vad som för dig hit. Skriv gärna ner
            de frågor du vill ta upp. I bokningsbekräftelsen hittar du information om ditt besök.
          </p>
          <p>{settings.address ? `Besöksadress: ${settings.address}` : "Mottagningen finns i Jönköping. Kontakta oss för vägbeskrivning."}</p>
          <div className="home-visit-links">
            <Link href="/vanliga-fragor" className="text-link">
              Vanliga frågor <ArrowRight size={18} />
            </Link>
            <Link href="/kontakt" className="text-link">
              Kontakta oss <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="philosophy-section">
        <div className="container philosophy-inner">
          <div className="botanical-motif" aria-hidden="true">
            <svg viewBox="0 0 180 220" fill="none">
              <path
                d="M48 200C96 140 100 84 153 20"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M80 155C34 158 26 137 25 102c43 8 60 26 55 53ZM102 111C62 116 57 91 62 58c35 11 48 25 40 53ZM127 65C106 31 113 11 142 0c12 29 9 47-15 65ZM90 132c40-12 62 0 66 28-36 13-58 5-66-28ZM113 90c38-21 61-14 68 16-31 20-57 15-68-16Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div>
            <h2>
              Två klassiska traditioner
              <br />
              <em>med årtusenden av kunskap</em>
            </h2>
          </div>
          <div className="philosophy-copy">
            <p>
              Vi utforskar klassisk kinesisk medicin i ljuset av den Profetiska
              vägledningen, med respekt för traditionernas ursprung och för
              varje människas berättelse.
            </p>
            <Link href="/om" className="text-link">
              Läs mer om Tibb.nu <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      {courses.length > 0 && (
        <section className="section container home-learning-section">
          <div className="section-heading">
            <div>
              <h2>Lärande som får växa</h2>
            </div>
            <Link href="/kurser" className="text-link">
              Alla kurser <ArrowRight size={18} />
            </Link>
          </div>
          <div className="home-courses-grid">
            {courses.map((course, index) => (
              <Link
                key={course.id}
                href={`/kurser/${course.slug}`}
                className={`home-course course-tone-${index}`}
              >
                <div className="home-course-art">
                  <span className="eyebrow">TIBB AKADEMI</span>
                  {index === 0 ? (
                    <Sprout strokeWidth={0.65} />
                  ) : (
                    <BookOpen strokeWidth={0.65} />
                  )}
                  <span className="course-art-bottom">
                    KUNSKAP · REFLEKTION · FÖRDJUPNING
                  </span>
                </div>
                <div className="home-course-copy">
                  <span className="badge">Onlinekurs</span>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <span className="text-link">
                    Läs om kursen <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {articles.length > 0 && (
        <section className="articles-section section">
          <div className="container">
            <div className="section-heading">
              <div>
                <h2>Från vår kunskapsbank</h2>
              </div>
              <Link href="/artiklar" className="text-link">
                Alla artiklar <ArrowRight size={18} />
              </Link>
            </div>
            <div className="home-articles-grid">
              {articles.map((article, index) => (
                <Link
                  href={`/artiklar/${article.slug}`}
                  className="home-article"
                  key={article.id}
                >
                  <div className={`article-art article-art-${index}`}>
                    <span>
                      {index === 0 ? (
                        <Leaf strokeWidth={0.8} />
                      ) : index === 1 ? (
                        <Sprout strokeWidth={0.8} />
                      ) : (
                        <BookOpen strokeWidth={0.8} />
                      )}
                    </span>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>
                  <span className="text-link">
                    Läs artikeln <ArrowUpRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="visit-cta container">
        <div>
          <h2>Boka behandling</h2>
          <p>Se våra behandlingar och hitta en tid för ett personligt möte.</p>
        </div>
        <Link href="/boka" className="button button-primary">
          Boka en behandling <ArrowUpRight size={18} />
        </Link>
      </section>
    </div>
  );
}
