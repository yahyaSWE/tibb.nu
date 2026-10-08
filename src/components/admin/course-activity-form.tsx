"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  FilePenLine,
  ListChecks,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { saveCourseActivityAction } from "@/lib/activity-actions";
import type { ActivityActionState } from "@/lib/activity-action-state";
import type {
  AdminCourseActivity,
  CourseActivityKind,
  QuizQuestion,
} from "@/lib/types";
import { Field } from "./common";

function emptyQuestion(id: string): QuizQuestion {
  return { id, prompt: "", options: ["", ""], correctOption: -1 };
}

export function CourseActivityForm({
  activity,
  courseId,
  lessonId,
  position,
}: {
  activity?: AdminCourseActivity;
  courseId: number;
  lessonId: number;
  position: number;
}) {
  const prefix = useId();
  const nextQuestion = useRef(2);
  const fieldToFocus = useRef<string | null>(null);
  const hasChanges = useRef(false);
  const [editingRevision, setEditingRevision] = useState(activity?.revision);
  const [kind, setKind] = useState<CourseActivityKind>(
    activity?.kind ?? "quiz",
  );
  const [title, setTitle] = useState(activity?.title ?? "");
  const [instructions, setInstructions] = useState(
    activity?.instructions ?? "",
  );
  const [order, setOrder] = useState(String(activity?.position ?? position));
  const [active, setActive] = useState(activity?.active ?? true);
  const [passPercent, setPassPercent] = useState(
    String(activity?.passPercent ?? 70),
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    activity?.questions.length
      ? activity.questions.map((question) => ({
          ...question,
          options: [...question.options],
        }))
      : [emptyQuestion("question_1")],
  );
  const [state, formAction, pending] = useActionState(
    async (previous: ActivityActionState, formData: FormData) => {
      const result = await saveCourseActivityAction(previous, formData);
      if (result.success) hasChanges.current = false;
      if (result.success && !activity) {
        setTitle("");
        setInstructions("");
        setOrder((value) => String(Math.min(10000, Number(value) + 1)));
        setActive(true);
        setQuestions([emptyQuestion("question_1")]);
        nextQuestion.current = 2;
      }
      return result;
    },
    {},
  );

  useEffect(() => {
    if (activity && !hasChanges.current) {
      setEditingRevision(activity.revision);
      setTitle(activity.title);
      setInstructions(activity.instructions);
      setOrder(String(activity.position));
      setActive(activity.active);
      setPassPercent(String(activity.passPercent ?? 70));
      setQuestions(
        activity.questions.length
          ? activity.questions.map((question) => ({
              ...question,
              options: [...question.options],
            }))
          : [emptyQuestion("question_1")],
      );
    }
  }, [activity, state]);

  useEffect(() => {
    if (fieldToFocus.current) {
      document.getElementById(fieldToFocus.current)?.focus();
      fieldToFocus.current = null;
    }
  }, [questions]);

  function updateQuestion(id: string, update: Partial<QuizQuestion>) {
    hasChanges.current = true;
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...update } : question,
      ),
    );
  }

  function addQuestion() {
    hasChanges.current = true;
    let id = `question_${nextQuestion.current++}`;
    while (questions.some((question) => question.id === id)) {
      id = `question_${nextQuestion.current++}`;
    }
    fieldToFocus.current = `${prefix}-${id}-prompt`;
    setQuestions((current) => [...current, emptyQuestion(id)]);
  }

  function removeQuestion(id: string) {
    hasChanges.current = true;
    const index = questions.findIndex((question) => question.id === id);
    const remaining = questions.filter((question) => question.id !== id);
    const adjacent = remaining[Math.min(index, remaining.length - 1)];
    if (adjacent) fieldToFocus.current = `${prefix}-${adjacent.id}-prompt`;
    setQuestions(remaining);
  }

  function addOption(question: QuizQuestion) {
    fieldToFocus.current = `${prefix}-${question.id}-option-${question.options.length}`;
    updateQuestion(question.id, { options: [...question.options, ""] });
  }

  function removeOption(question: QuizQuestion, index: number) {
    const options = question.options.filter(
      (_, optionIndex) => optionIndex !== index,
    );
    const correctOption =
      question.correctOption === index
        ? -1
        : question.correctOption > index
          ? question.correctOption - 1
          : question.correctOption;
    fieldToFocus.current = `${prefix}-${question.id}-option-${Math.min(index, options.length - 1)}`;
    updateQuestion(question.id, { options, correctOption });
  }

  return (
    <form action={formAction} className="stack course-activity-form">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      {activity && <input type="hidden" name="id" value={activity.id} />}
      {activity && (
        <input type="hidden" name="revision" value={editingRevision} />
      )}
      <input type="hidden" name="kind" value={kind} />
      <input
        type="hidden"
        name="questionsJson"
        value={kind === "quiz" ? JSON.stringify(questions) : ""}
      />

      {state.error && (
        <p className="notice notice-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice notice-success" role="status">
          {state.success}
        </p>
      )}

      {activity && activity.revision !== editingRevision && (
        <p className="notice" role="status">
          En ny version har sparats sedan du började redigera. Dina ändringar
          finns kvar i formuläret. Ladda om sidan för att hämta den senaste
          versionen innan du sparar.
        </p>
      )}

      <fieldset
        disabled={pending}
        className="course-activity-fields stack"
        onChangeCapture={() => {
          hasChanges.current = true;
        }}
      >
        <legend className="sr-only">
          {activity ? "Redigera aktivitet" : "Ny aktivitet"}
        </legend>
        <div className="form-grid">
          <Field label="Aktivitetens namn" name={`${prefix}-title`}>
            <input
              id={`${prefix}-title`}
              name="title"
              required
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                kind === "quiz"
                  ? "Till exempel: Repetition av lektionen"
                  : "Till exempel: Din reflektion"
              }
            />
          </Field>
          <Field
            label="Typ av aktivitet"
            name={`${prefix}-kind`}
            help={
              activity
                ? "Typen är låst för att bevara elevhistoriken."
                : undefined
            }
          >
            <select
              id={`${prefix}-kind`}
              value={kind}
              disabled={!!activity}
              onChange={(event) =>
                setKind(event.target.value as CourseActivityKind)
              }
            >
              <option value="quiz">Quiz med flervalsfrågor</option>
              <option value="assignment">Skrivuppgift</option>
            </select>
          </Field>
        </div>
        <Field
          label={
            kind === "quiz"
              ? "Instruktion till eleven"
              : "Uppgiftens instruktion"
          }
          name={`${prefix}-instructions`}
          help={
            kind === "quiz"
              ? "Frivilligt. Visas före quizfrågorna."
              : "Beskriv vad eleven ska skriva och vad du bedömer."
          }
        >
          <textarea
            id={`${prefix}-instructions`}
            name="instructions"
            rows={4}
            maxLength={12000}
            required={kind === "assignment"}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field
            label="Ordning i lektionen"
            name={`${prefix}-position`}
            help="Lägre tal visas först."
          >
            <input
              id={`${prefix}-position`}
              name="position"
              type="number"
              min={1}
              max={10000}
              required
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            />
          </Field>
          {kind === "quiz" && (
            <Field label="Gräns för godkänt (%)" name={`${prefix}-pass`}>
              <input
                id={`${prefix}-pass`}
                name="passPercent"
                type="number"
                min={1}
                max={100}
                required
                value={passPercent}
                onChange={(event) => setPassPercent(event.target.value)}
              />
            </Field>
          )}
        </div>

        {kind === "quiz" ? (
          <div className="stack">
            <div className="course-activity-heading">
              <div>
                <span className="course-activity-type">
                  <ListChecks size={17} aria-hidden="true" /> Quizfrågor
                </span>
                <p className="course-activity-help">
                  Varje fråga har ett rätt svar. Markera det med cirkeln bredvid
                  svarsalternativet.
                </p>
              </div>
              <span className="badge" aria-live="polite">
                {questions.length} av högst 30 frågor
              </span>
            </div>
            <div className="course-questions">
              {questions.map((question, questionIndex) => (
                <fieldset className="course-question" key={question.id}>
                  <legend className="sr-only">Fråga {questionIndex + 1}</legend>
                  <div className="course-question-heading">
                    <strong>Fråga {questionIndex + 1}</strong>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      disabled={questions.length === 1}
                      onClick={() => removeQuestion(question.id)}
                      aria-label={`Ta bort fråga ${questionIndex + 1}`}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Ta bort fråga
                    </button>
                  </div>
                  <Field
                    label="Frågetext"
                    name={`${prefix}-${question.id}-prompt`}
                  >
                    <textarea
                      id={`${prefix}-${question.id}-prompt`}
                      rows={2}
                      required
                      maxLength={2000}
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          prompt: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="course-question-options">
                    {question.options.map((option, optionIndex) => (
                      <div className="course-question-option" key={optionIndex}>
                        <input
                          type="radio"
                          name={`${prefix}-${question.id}-correct`}
                          value={optionIndex}
                          checked={question.correctOption === optionIndex}
                          required
                          aria-label={`Markera svarsalternativ ${optionIndex + 1} som rätt svar på fråga ${questionIndex + 1}`}
                          onChange={() =>
                            updateQuestion(question.id, {
                              correctOption: optionIndex,
                            })
                          }
                        />
                        <Field
                          label={`Svarsalternativ ${optionIndex + 1}`}
                          name={`${prefix}-${question.id}-option-${optionIndex}`}
                        >
                          <input
                            id={`${prefix}-${question.id}-option-${optionIndex}`}
                            required
                            maxLength={1000}
                            value={option}
                            onChange={(event) =>
                              updateQuestion(question.id, {
                                options: question.options.map((text, index) =>
                                  index === optionIndex
                                    ? event.target.value
                                    : text,
                                ),
                              })
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          className="course-activity-icon-button"
                          disabled={question.options.length <= 2}
                          onClick={() => removeOption(question, optionIndex)}
                          aria-label={`Ta bort svarsalternativ ${optionIndex + 1} från fråga ${questionIndex + 1}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="course-activity-actions">
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      disabled={question.options.length >= 6}
                      onClick={() => addOption(question)}
                    >
                      <Plus size={14} aria-hidden="true" /> Lägg till
                      svarsalternativ
                    </button>
                    <small className="muted">
                      2–6 svarsalternativ ·{" "}
                      {question.correctOption < 0
                        ? "Välj ett rätt svar"
                        : `Alternativ ${question.correctOption + 1} är rätt`}
                    </small>
                  </div>
                </fieldset>
              ))}
            </div>
            <div>
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={questions.length >= 30}
                onClick={addQuestion}
              >
                <Plus size={15} aria-hidden="true" /> Lägg till fråga
              </button>
            </div>
          </div>
        ) : (
          <div className="notice course-activity-help">
            <FilePenLine size={17} aria-hidden="true" /> Eleven skriver sitt
            svar i elevportalen och lämnar in det för granskning. Du ger
            återkoppling och godkänner eller ber om komplettering här i
            kursbyggaren.
          </div>
        )}

        <div>
          <label className="form-check">
            <input
              type="checkbox"
              name="active"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Aktiv i elevportalen
          </label>
          <p className="course-activity-help">
            Avmarkera för att inaktivera aktiviteten. Elevernas tidigare
            resultat och inlämningar bevaras. Ändringar i innehållet sparas som
            en ny version.
          </p>
        </div>
      </fieldset>
      <div className="course-activity-actions">
        <button
          type="submit"
          className="button button-primary"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle
                size={16}
                className="admin-submit-spinner"
                aria-hidden="true"
              />{" "}
              Sparar…
            </>
          ) : activity ? (
            "Spara aktivitet"
          ) : (
            "Lägg till aktivitet"
          )}
        </button>
      </div>
    </form>
  );
}
