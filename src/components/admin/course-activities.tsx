import { FilePenLine, ListChecks, Plus } from "lucide-react";
import type { AdminCourseActivity } from "@/lib/types";
import { CourseActivityForm } from "./course-activity-form";

export function CourseLessonActivities({
  courseId,
  lessonId,
  activities,
}: {
  courseId: number;
  lessonId: number;
  activities: AdminCourseActivity[];
}) {
  const nextPosition = activities.length
    ? Math.max(...activities.map((activity) => activity.position)) + 1
    : 1;
  return (
    <section
      className="course-activities"
      aria-labelledby={`lesson-${lessonId}-activities`}
    >
      <div className="course-activity-heading">
        <div>
          <h3 id={`lesson-${lessonId}-activities`}>Quiz och skrivuppgifter</h3>
          <p>
            Lägg till flera aktiviteter i lektionen. Elever med kursåtkomst gör
            dem i elevportalen.
          </p>
        </div>
        <span className="badge">
          {activities.filter((activity) => activity.active).length} aktiva
        </span>
      </div>
      {activities.length ? (
        <div className="course-activity-list">
          {activities.map((activity) => (
            <details
              className="course-activity-card"
              key={activity.id}
              data-inactive={!activity.active}
            >
              <summary>
                {activity.kind === "quiz" ? (
                  <ListChecks size={19} aria-hidden="true" />
                ) : (
                  <FilePenLine size={19} aria-hidden="true" />
                )}
                <span className="course-activity-summary-copy">
                  <strong>{activity.title}</strong>
                  <small>
                    {activity.kind === "quiz"
                      ? `Quiz · ${activity.questions.length} frågor · Godkänt från ${activity.passPercent} %`
                      : "Skrivuppgift"}{" "}
                    · Ordning {activity.position} · Version {activity.revision}
                  </small>
                </span>
                <span
                  className={`badge ${activity.active ? "badge-green" : ""}`}
                >
                  {activity.active ? "Aktiv" : "Inaktiv"}
                </span>
              </summary>
              <div className="course-activity-editor">
                <CourseActivityForm
                  activity={activity}
                  courseId={courseId}
                  lessonId={lessonId}
                  position={activity.position}
                />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="course-activity-help">
          Lektionen har inga quiz eller skrivuppgifter ännu.
        </p>
      )}
      <details className="course-activity-new" key="new-activity">
        <summary>
          <Plus size={18} aria-hidden="true" />
          <strong>Lägg till quiz eller skrivuppgift</strong>
        </summary>
        <div className="course-activity-editor">
          <CourseActivityForm
            courseId={courseId}
            lessonId={lessonId}
            position={Math.min(10000, nextPosition)}
          />
        </div>
      </details>
    </section>
  );
}
