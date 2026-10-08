import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  RotateCcw,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getAccessibleCourse,
  getLesson,
  getLessonOutline,
  getCourseProgress,
} from "@/lib/db";
import { markLessonAction } from "@/lib/actions";
import { TextContent } from "@/components/learning/cards";
import {
  LessonVideo,
  LessonMaterial,
} from "@/components/learning/lesson-media";
import { LessonActivities } from "@/components/learning/lesson-activities";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { courseId: rawCourseId, lessonId: rawLessonId } = await params;
  const courseId = Number(rawCourseId);
  const lessonId = Number(rawLessonId);
  if (
    !Number.isSafeInteger(courseId) ||
    courseId < 1 ||
    !Number.isSafeInteger(lessonId) ||
    lessonId < 1
  )
    notFound();
  const course = await getAccessibleCourse(user.id, courseId);
  if (!course) notFound();
  const [lessons, lesson, completed, query] = await Promise.all([
    getLessonOutline(courseId),
    getLesson(lessonId, courseId),
    getCourseProgress(user.id, courseId),
    searchParams,
  ]);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0 || !lesson) notFound();
  const isComplete = completed.includes(lessonId);
  const completedCount = lessons.filter((item) =>
    completed.includes(item.id),
  ).length;
  const progress = lessons.length
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;
  const coursePath = `/elevportal/kurser/${courseId}`;
  const lessonPath = `${coursePath}/lektioner/${lessonId}`;
  const nextLesson = lessons[index + 1];
  const nextPath = nextLesson
    ? `${coursePath}/lektioner/${nextLesson.id}`
    : coursePath;
  return (
    <>
      <Link className="back-link" href={coursePath}>
        <ArrowLeft size={16} /> {course.title}
      </Link>
      <div className="lesson-layout">
        <aside className="lesson-sidebar panel">
          <p className="eyebrow">Din kurs</p>
          <h2>{course.title}</h2>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="small muted">
            {completedCount} av {lessons.length} genomförda
          </p>
          <nav aria-label="Kurslektioner">
            {lessons.map((item, itemIndex) => (
              <Link
                className={item.id === lessonId ? "active" : ""}
                aria-current={item.id === lessonId ? "page" : undefined}
                key={item.id}
                href={`${coursePath}/lektioner/${item.id}`}
              >
                <span className="lesson-sidebar-icon">
                  {completed.includes(item.id) ? (
                    <CheckCircle2 size={17} />
                  ) : (
                    <Circle size={17} />
                  )}
                </span>
                <span>
                  <small>Lektion {itemIndex + 1}</small>
                  {item.title}
                </span>
              </Link>
            ))}
          </nav>
        </aside>
        <article className="lesson-content">
          <p className="eyebrow">
            Lektion {index + 1} av {lessons.length}
          </p>
          <h1>{lesson.title}</h1>
          {query.error && (
            <p className="notice notice-error" role="alert">
              {query.error}
            </p>
          )}
          <LessonVideo url={lesson.videoUrl} />
          <TextContent text={lesson.body} />
          <LessonMaterial url={lesson.materialUrl} files={lesson.materials} />
          <Suspense
            fallback={
              <p className="muted" role="status">
                Laddar lektionsaktiviteter…
              </p>
            }
          >
            <LessonActivities
              userId={user.id}
              courseId={courseId}
              lessonId={lessonId}
            />
          </Suspense>
          <div className="lesson-completion panel">
            {isComplete ? (
              <>
                <div className="lesson-completed-label">
                  <CheckCircle2 size={22} />
                  <span>Du har genomfört den här lektionen.</span>
                </div>
                <Link className="button button-primary" href={nextPath}>
                  {nextLesson ? "Nästa lektion" : "Till kursöversikten"}
                  <ArrowRight size={17} />
                </Link>
                <form action={markLessonAction}>
                  <input type="hidden" name="lessonId" value={lessonId} />
                  <input type="hidden" name="returnTo" value={lessonPath} />
                  <button className="text-link small" type="submit">
                    <RotateCcw size={14} /> Markera som ej genomförd
                  </button>
                </form>
              </>
            ) : (
              <>
                <div>
                  <h3>Redo att gå vidare?</h3>
                  <p className="muted">
                    Markera lektionen som genomförd för att spara dina framsteg.
                  </p>
                </div>
                <form action={markLessonAction}>
                  <input type="hidden" name="lessonId" value={lessonId} />
                  <input type="hidden" name="completed" value="on" />
                  <input type="hidden" name="returnTo" value={nextPath} />
                  <button className="button button-primary" type="submit">
                    <Check size={17} />
                    {nextLesson ? "Klar och gå vidare" : "Slutför kursen"}
                  </button>
                </form>
              </>
            )}
          </div>
          <nav
            className="lesson-bottom-nav"
            aria-label="Nästa och föregående lektion"
          >
            {index > 0 ? (
              <Link
                href={`${coursePath}/lektioner/${lessons[index - 1].id}`}
                className="text-link"
              >
                <ArrowLeft size={16} /> Föregående lektion
              </Link>
            ) : (
              <span />
            )}
            {nextLesson && (
              <Link href={nextPath} className="text-link">
                Nästa lektion <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
