"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { Check, FilePenLine, ListChecks, LoaderCircle } from "lucide-react";
import { reviewAssignmentAction } from "@/lib/activity-actions";
import type {
  AdminAssignmentSubmission,
  AdminQuizAttempt,
  CourseActivityResults,
} from "@/lib/types";
import { dateTime, Field } from "./common";

type ResultRow =
  | { kind: "quiz"; result: AdminQuizAttempt; date: string }
  | { kind: "assignment"; result: AdminAssignmentSubmission; date: string };

const PAGE_SIZE = 25;

function AssignmentReviewForm({
  submission,
}: {
  submission: AdminAssignmentSubmission;
}) {
  const prefix = useId();
  const [feedback, setFeedback] = useState(submission.feedback);
  const [status, setStatus] = useState<"approved" | "needs_revision">(
    submission.status === "needs_revision" ? "needs_revision" : "approved",
  );
  const [state, action, pending] = useActionState(reviewAssignmentAction, {});
  return (
    <form action={action} className="course-review-form stack">
      <input type="hidden" name="submissionId" value={submission.id} />
      <input type="hidden" name="courseId" value={submission.courseId} />
      <input type="hidden" name="lessonId" value={submission.lessonId} />
      <h3>Återkoppling till eleven</h3>
      {state.error && (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice notice-success">
          {state.success}
        </p>
      )}
      <fieldset className="course-activity-fields stack" disabled={pending}>
        <legend className="sr-only">Granska skrivuppgift</legend>
        <Field label="Bedömning" name={`${prefix}-status`}>
          <select
            id={`${prefix}-status`}
            name="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "approved" | "needs_revision")
            }
          >
            <option value="approved">Godkänd</option>
            <option value="needs_revision">Behöver kompletteras</option>
          </select>
        </Field>
        <Field
          label="Din återkoppling"
          name={`${prefix}-feedback`}
          help={
            status === "needs_revision"
              ? "Beskriv vad eleven behöver komplettera innan nästa inlämning."
              : "Återkopplingen visas tillsammans med bedömningen i elevportalen."
          }
        >
          <textarea
            id={`${prefix}-feedback`}
            name="feedback"
            rows={5}
            maxLength={12000}
            required={status === "needs_revision"}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </Field>
      </fieldset>
      <div>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle
                size={16}
                className="admin-submit-spinner"
                aria-hidden="true"
              />{" "}
              Sparar återkoppling…
            </>
          ) : (
            "Spara bedömning och återkoppling"
          )}
        </button>
      </div>
    </form>
  );
}

function ResultBadge({ row }: { row: ResultRow }) {
  if (row.kind === "quiz") {
    return (
      <span
        className={`badge ${row.result.passed ? "badge-green" : "badge-amber"}`}
      >
        {row.result.passed ? "Godkänt" : "Ej godkänt"} ·{" "}
        {row.result.scorePercent} %
      </span>
    );
  }
  const labels = {
    draft: "Utkast",
    submitted: "Väntar på granskning",
    approved: "Godkänd",
    needs_revision: "Komplettering begärd",
  };
  return (
    <span
      className={`badge ${row.result.status === "approved" ? "badge-green" : "badge-amber"}`}
    >
      {labels[row.result.status]}
    </span>
  );
}

function ResultDetails({ row }: { row: ResultRow }) {
  const result = row.result;
  return (
    <details className="course-result-card">
      <summary>
        {row.kind === "quiz" ? (
          <ListChecks size={20} aria-hidden="true" />
        ) : (
          <FilePenLine size={20} aria-hidden="true" />
        )}
        <span className="course-result-title">
          <strong>
            {result.userName} · {result.activityTitle}
          </strong>
          <small>
            {result.lessonTitle} · {dateTime(row.date)}
          </small>
        </span>
        <ResultBadge row={row} />
      </summary>
      <div className="course-result-body">
        <dl className="course-result-meta">
          <div>
            <dt>Elev</dt>
            <dd>
              {result.userName}
              <br />
              {result.userEmail}
            </dd>
          </div>
          <div>
            <dt>Lektion</dt>
            <dd>{result.lessonTitle}</dd>
          </div>
          <div>
            <dt>Aktivitet</dt>
            <dd>
              {result.activityTitle} · Version {result.revision}
            </dd>
          </div>
          <div>
            <dt>Inlämnad</dt>
            <dd>{dateTime(row.date)}</dd>
          </div>
        </dl>
        {result.instructions && (
          <div>
            <h3>Uppgiftens instruktion</h3>
            <p className="course-submission-text">{result.instructions}</p>
          </div>
        )}
        {row.kind === "quiz" ? (
          <>
            <div className="notice">
              Försök {row.result.attemptNumber}: {row.result.correctCount} av{" "}
              {row.result.questionCount} rätt ({row.result.scorePercent} %).
              Gränsen för godkänt var {row.result.passPercent} %.
            </div>
            <ol className="course-result-answers">
              {row.result.answers.map((answer, index) => (
                <li key={answer.questionId}>
                  <strong>
                    {index + 1}. {answer.prompt}
                  </strong>
                  <p>
                    Elevens svar:{" "}
                    {answer.options[answer.selectedOption] ?? "Inget svar"}
                  </p>
                  <p>
                    Rätt svar:{" "}
                    {answer.options[answer.correctOption] ?? "Svar saknas"}
                  </p>
                  <span
                    className={`badge ${answer.correct ? "badge-green" : "badge-amber"}`}
                  >
                    {answer.correct && <Check size={12} aria-hidden="true" />}
                    {answer.correct ? "Rätt" : "Fel"}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <div>
              <h3>Elevens inlämning</h3>
              <p className="course-submission-text">{row.result.text}</p>
            </div>
            {row.result.reviewedAt && (
              <div>
                <p className="course-activity-help">
                  Senast granskad {dateTime(row.result.reviewedAt)}
                  {row.result.reviewerName
                    ? ` av ${row.result.reviewerName}`
                    : ""}
                  .
                </p>
                {row.result.feedback && (
                  <p className="course-result-feedback">
                    {row.result.feedback}
                  </p>
                )}
              </div>
            )}
            <AssignmentReviewForm submission={row.result} />
          </>
        )}
      </div>
    </details>
  );
}

export function CourseActivityResultsPanel({
  results,
}: {
  results: CourseActivityResults;
}) {
  const prefix = useId();
  const [search, setSearch] = useState("");
  const [lesson, setLesson] = useState("");
  const [kind, setKind] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo<ResultRow[]>(
    () =>
      [
        ...results.quizAttempts.map(
          (result): ResultRow => ({
            kind: "quiz",
            result,
            date: result.submittedAt,
          }),
        ),
        ...results.assignmentSubmissions
          .filter((result) => result.status !== "draft")
          .map(
            (result): ResultRow => ({
              kind: "assignment",
              result,
              date: result.submittedAt ?? result.createdAt,
            }),
          ),
      ].sort(
        (first, second) =>
          new Date(second.date).getTime() - new Date(first.date).getTime() ||
          second.result.id - first.result.id,
      ),
    [results],
  );
  const lessons = Array.from(
    new Map(
      rows.map((row) => [row.result.lessonId, row.result.lessonTitle]),
    ).entries(),
  );
  const query = search.trim().toLocaleLowerCase("sv-SE");
  const filtered = rows.filter((row) => {
    if (lesson && String(row.result.lessonId) !== lesson) return false;
    if (kind && row.kind !== kind) return false;
    if (
      query &&
      !`${row.result.userName} ${row.result.userEmail} ${row.result.activityTitle}`
        .toLocaleLowerCase("sv-SE")
        .includes(query)
    )
      return false;
    if (
      outcome === "submitted" ||
      outcome === "approved" ||
      outcome === "needs_revision"
    ) {
      if (row.kind !== "assignment" || row.result.status !== outcome)
        return false;
    } else if (outcome === "passed" || outcome === "failed") {
      if (row.kind !== "quiz" || row.result.passed !== (outcome === "passed"))
        return false;
    }
    return true;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const displayed = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const awaiting = rows.filter(
    (row) => row.kind === "assignment" && row.result.status === "submitted",
  ).length;

  if (!rows.length) {
    return (
      <div className="empty-state">
        <ListChecks size={26} aria-hidden="true" />
        <h3>Inga elevresultat ännu</h3>
        <p>
          Här visas quizförsök och skrivuppgifter när eleverna lämnar in dem.
          Elevens utkast visas inte här.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="course-activity-help course-results-count">
        {results.quizAttempts.length} quizförsök ·{" "}
        {rows.filter((row) => row.kind === "assignment").length} inlämningar ·{" "}
        {awaiting} väntar på granskning
      </p>
      <div className="course-results-filters">
        <Field label="Sök elev eller aktivitet" name={`${prefix}-search`}>
          <input
            id={`${prefix}-search`}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Namn, e-post eller aktivitet"
          />
        </Field>
        <Field label="Lektion" name={`${prefix}-lesson`}>
          <select
            id={`${prefix}-lesson`}
            value={lesson}
            onChange={(event) => {
              setLesson(event.target.value);
              setPage(0);
            }}
          >
            <option value="">Alla lektioner</option>
            {lessons.map(([id, title]) => (
              <option value={id} key={id}>
                {title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Typ" name={`${prefix}-kind`}>
          <select
            id={`${prefix}-kind`}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(0);
            }}
          >
            <option value="">Alla aktiviteter</option>
            <option value="quiz">Quiz</option>
            <option value="assignment">Skrivuppgifter</option>
          </select>
        </Field>
        <Field label="Resultat eller status" name={`${prefix}-outcome`}>
          <select
            id={`${prefix}-outcome`}
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value);
              setPage(0);
            }}
          >
            <option value="">Alla resultat</option>
            <option value="submitted">Väntar på granskning</option>
            <option value="approved">Godkända skrivuppgifter</option>
            <option value="needs_revision">Komplettering begärd</option>
            <option value="passed">Godkända quiz</option>
            <option value="failed">Quiz som inte är godkända</option>
          </select>
        </Field>
      </div>
      <p className="course-activity-help course-results-count" role="status">
        {filtered.length} resultat matchar dina val.
      </p>
      {displayed.length ? (
        <div className="course-results-list">
          {displayed.map((row) => (
            <ResultDetails key={`${row.kind}-${row.result.id}`} row={row} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>Inga resultat matchar dina val.</p>
        </div>
      )}
      {pageCount > 1 && (
        <nav
          className="course-results-pagination"
          aria-label="Sidor med elevresultat"
        >
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Föregående
          </button>
          <span>
            Sida {currentPage + 1} av {pageCount}
          </span>
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Nästa
          </button>
        </nav>
      )}
    </div>
  );
}
