import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  LockKeyhole,
  Sprout,
} from "lucide-react";
import { getCourse, getLessonOutline, hasCourseAccess } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice, TextContent } from "@/components/learning/cards";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug, { publishedOnly: true });
  return {
    title: course ? course.title : "Kursen finns inte",
    description: course?.description.slice(0, 160),
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourse(slug, { publishedOnly: true });
  if (!course) notFound();
  const [lessons, user] = await Promise.all([
    getLessonOutline(course.id),
    getCurrentUser(),
  ]);
  const hasAccess = user ? await hasCourseAccess(user.id, course.id) : false;
  return (
    <section className="section container course-detail">
      <Link href="/kurser" className="back-link">
        <ArrowLeft size={16} /> Alla kurser
      </Link>
      <div className="course-detail-grid">
        <div>
          <p className="eyebrow">Tibb akademi · Onlinekurs</p>
          <h1 className="page-title">{course.title}</h1>
          <TextContent text={course.description} />
          <div className="course-detail-meta">
            <span>
              <BookOpen size={17} /> {lessons.length}{" "}
              {lessons.length === 1 ? "lektion" : "lektioner"}
            </span>
            <span>
              <Clock size={17} /> I din egen takt
            </span>
          </div>
          <div className="course-outline">
            <h2>Det här får du lära dig</h2>
            <p className="muted">
              En stegvis fördjupning, med plats för både kunskap och reflektion.
            </p>
            {lessons.length ? (
              <ol>
                {lessons.map((lesson, index) => (
                  <li key={lesson.id}>
                    <span className="lesson-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{lesson.title}</span>
                    <LockKeyhole size={16} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                Kursens lektioner presenteras här inom kort.
              </p>
            )}
          </div>
        </div>
        <aside className="course-enrollment panel">
          <div className="course-enrollment-art" aria-hidden="true">
            <Sprout size={103} strokeWidth={0.85} />
          </div>
          <p className="eyebrow">En investering i din kunskap</p>
          <p className="course-price">{formatPrice(course.priceOre)}</p>
          <ul className="check-list">
            <li>
              <Check size={16} /> Tillgång via din elevportal
            </li>
            <li>
              <Check size={16} /> Studera när det passar dig
            </li>
            <li>
              <Check size={16} /> Följ dina framsteg lektion för lektion
            </li>
          </ul>
          {hasAccess ? (
            <Link
              className="button button-primary full-width"
              href={`/elevportal/kurser/${course.id}`}
            >
              Öppna kursen <ArrowRight size={17} />
            </Link>
          ) : (
            <>
              <Link
                className="button button-primary full-width"
                href="/kontakt"
              >
                Anmäl ditt intresse <ArrowRight size={17} />
              </Link>
              <p className="small muted">
                Tibb.nu hjälper dig med anmälan och tilldelar sedan kursåtkomst.
              </p>
            </>
          )}
          {!user && (
            <p className="small muted">
              Har du redan tillgång?{" "}
              <Link
                href={`/logga-in?returnTo=${encodeURIComponent(`/elevportal/kurser/${course.id}`)}`}
                className="inline-link"
              >
                Logga in
              </Link>
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
