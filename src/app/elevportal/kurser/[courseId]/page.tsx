import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Play,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getCourseById,
  getLessons,
  getCourseProgress,
  hasCourseAccess,
} from "@/lib/db";
import { TextContent } from "@/components/learning/cards";

export const dynamic = "force-dynamic";

export default async function StudentCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await requireUser();
  const { courseId: rawCourseId } = await params;
  const courseId = Number(rawCourseId);
  if (
    !Number.isSafeInteger(courseId) ||
    courseId < 1 ||
    !(await hasCourseAccess(user.id, courseId))
  )
    notFound();
  const course = await getCourseById(courseId);
  if (!course) notFound();
  const [lessons, completed] = await Promise.all([
    getLessons(courseId),
    getCourseProgress(user.id, courseId),
  ]);
  const completedCount = lessons.filter((lesson) =>
    completed.includes(lesson.id),
  ).length;
  const progress = lessons.length
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;
  const nextLesson =
    lessons.find((lesson) => !completed.includes(lesson.id)) || lessons[0];
  return (
    <>
      <Link className="back-link" href="/elevportal">
        <ArrowLeft size={16} /> Mina kurser
      </Link>
      <div className="portal-course-heading">
        <div>
          <p className="eyebrow">Tibb akademi</p>
          <h1 className="page-title">{course.title}</h1>
          <TextContent text={course.description} />
        </div>
        <BookOpen size={73} strokeWidth={1} aria-hidden="true" />
      </div>
      {!course.published && (
        <p className="notice">
          Den här kursen är ett utkast. Den syns för dig som administratör.
        </p>
      )}
      <div className="portal-course-progress panel">
        <div>
          <span className="eyebrow">Dina framsteg</span>
          <h3>
            {completedCount} av {lessons.length} lektioner genomförda
          </h3>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <strong>{progress}%</strong>
        {nextLesson && (
          <Link
            className="button button-primary"
            href={`/elevportal/kurser/${courseId}/lektioner/${nextLesson.id}`}
          >
            {progress === 100
              ? "Repetera kursen"
              : completedCount
                ? "Fortsätt kursen"
                : "Börja kursen"}
            <ArrowRight size={17} />
          </Link>
        )}
      </div>
      <div className="section-heading">
        <h2>Kursens lektioner</h2>
        <span className="muted">Lär i din egen takt</span>
      </div>
      {lessons.length ? (
        <ol className="portal-lesson-list">
          {lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <Link
                href={`/elevportal/kurser/${courseId}/lektioner/${lesson.id}`}
              >
                <span className="lesson-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="portal-lesson-label">
                  <strong>{lesson.title}</strong>
                  <small className="muted">
                    {lesson.videoUrl ? "Video och läsning" : "Läsning"}
                  </small>
                </span>
                {completed.includes(lesson.id) ? (
                  <span className="lesson-status">
                    <CheckCircle2 size={19} />
                    <span>Genomförd</span>
                  </span>
                ) : (
                  <Circle className="muted" size={19} />
                )}
                <Play size={16} />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-state">
          <BookOpen size={32} />
          <h3>Lektionerna är på väg</h3>
          <p className="muted">
            Här ser du lektionerna när de lagts till av Tibb.nu.
          </p>
        </div>
      )}
    </>
  );
}
