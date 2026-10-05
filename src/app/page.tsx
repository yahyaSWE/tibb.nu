import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Leaf,
  MoveUpRight,
  Sprout,
} from "lucide-react";
import { getArticles, getCourses, getTreatments } from "@/lib/db";

export default async function HomePage() {
  const [allCourses, allArticles, treatments] = await Promise.all([
    getCourses({ publishedOnly: true }),
    getArticles({ publishedOnly: true }),
    getTreatments({ activeOnly: true }),
  ]);
  const courses = allCourses.slice(0, 2);
  const articles = allArticles.slice(0, 3);
  return (
    <>
      <section className="home-hero container">
        <div className="hero-copy">
          <h1>Traditionell medicin och behandlingar</h1>
          <p className="hero-intro">
            Klassisk kinesisk medicin i ljuset av den Profetiska vägledningen.
          </p>
          <p className="hero-description">
            En plats där traditionell kunskap möter omtanke om hela människan.
            Välkommen att utforska, lära och ta tid för dig själv.
          </p>
          <div className="hero-actions">
            <Link href="/boka" className="button button-primary">
              Boka en behandling <ArrowUpRight size={18} />
            </Link>
            <Link href="/kurser" className="text-link">
              Utforska våra kurser <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="hero-image-wrap">
          <Image
            src="/images/olive-still-life.png"
            alt="Olivkvistar i en handgjord keramikvas i varmt solljus"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
            className="hero-image"
          />
        </div>
      </section>
      <section className="section container paths-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">VÄLKOMMEN TILL TIBB</span>
            <h2>Din väg börjar här.</h2>
          </div>
          <p>
            För dig som söker ett personligt möte,
            <br />
            ny förståelse eller tid för reflektion.
          </p>
        </div>
        <div className="paths-grid">
          <Link href="/boka" className="path-card">
            <span className="path-number">01</span>
            <span className="path-icon">
              <Leaf size={26} strokeWidth={1.2} />
            </span>
            <h3>Behandlingar</h3>
            <p>
              Ett möte med utrymme för dig. Läs om våra behandlingar och hitta
              en tid som passar.
            </p>
            <span className="path-card-bottom">
              {treatments.length
                ? `${treatments.length} behandlingar att utforska`
                : "Se tillgängliga behandlingar"}
              <MoveUpRight size={20} />
            </span>
          </Link>
          <Link href="/kurser" className="path-card">
            <span className="path-number">02</span>
            <span className="path-icon">
              <BookOpen size={26} strokeWidth={1.2} />
            </span>
            <h3>Kurser & lärande</h3>
            <p>
              Fördjupa din kunskap i din egen takt. Samla lektioner,
              reflektioner och material i elevportalen.
            </p>
            <span className="path-card-bottom">
              Upptäck våra kurser
              <MoveUpRight size={20} />
            </span>
          </Link>
          <Link href="/artiklar" className="path-card">
            <span className="path-number">03</span>
            <span className="path-icon">
              <Sprout size={26} strokeWidth={1.2} />
            </span>
            <h3>Kunskap & inspiration</h3>
            <p>
              Perspektiv på tradition, vardag och eftertanke. Ta del av våra
              senaste artiklar.
            </p>
            <span className="path-card-bottom">
              Läs och reflektera
              <MoveUpRight size={20} />
            </span>
          </Link>
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
            <span className="eyebrow">VÅRT FÖRHÅLLNINGSSÄTT</span>
            <h2>
              Två traditioner.
              <br />
              <em>En omsorg om människan.</em>
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
      <section className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GE DIN KUNSKAP UTRYMME</span>
            <h2>Lärande som får växa.</h2>
          </div>
          <Link href="/kurser" className="text-link">
            Alla kurser <ArrowRight size={18} />
          </Link>
        </div>
        {courses.length ? (
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
        ) : (
          <div className="empty-state">
            <BookOpen />
            <h3>Nya kurser är på väg.</h3>
            <p>Här hittar du kurserna när de är publicerade.</p>
          </div>
        )}
      </section>
      <section className="articles-section section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LÄS, UTFORSKA & REFLEKTERA</span>
              <h2>Från vår kunskapsbank.</h2>
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
                <span className="eyebrow">{"Kunskap & reflektion"}</span>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
                <span className="text-link">
                  Läs artikeln <ArrowUpRight size={16} />
                </span>
              </Link>
            ))}
          </div>
          {!articles.length && (
            <p className="empty-state">Artiklar publiceras här inom kort.</p>
          )}
        </div>
      </section>
      <section className="visit-cta container">
        <div>
          <span className="eyebrow">ETT FÖRSTA STEG</span>
          <h2>Boka behandling</h2>
          <p>Se våra behandlingar och hitta en tid för ett personligt möte.</p>
        </div>
        <Link href="/boka" className="button button-primary">
          <CalendarDays size={18} /> Hitta din tid <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
