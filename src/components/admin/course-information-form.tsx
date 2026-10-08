"use client";
import { useActionState, useState } from "react";
import { saveCourseInformationForm } from "@/lib/business-actions";
import { withBusinessFormErrors } from "@/lib/business-form-errors";
import {
  INITIAL_BUSINESS_FORM_STATE,
  type BusinessFormState,
} from "@/lib/business-form-state";
import type { CourseInformation } from "@/lib/business-config";
import { Field, SectionHeading } from "./common";

const fields = [
  ["audience", "Vem passar kursen för?"],
  ["prerequisites", "Förkunskaper"],
  ["learningOutcomes", "Lärandemål"],
  ["completionRequirements", "När räknas kursen som genomförd?"],
] as const;
export function CourseInformationForm({
  courseId,
  information,
}: {
  courseId: number;
  information: CourseInformation;
}) {
  const [values, setValues] = useState(information);
  const [state, action, pending] = useActionState(
    withBusinessFormErrors(saveCourseInformationForm),
    INITIAL_BUSINESS_FORM_STATE,
  );
  const [dismissedResult, setDismissedResult] =
    useState<BusinessFormState | null>(null);
  return (
    <form
      action={action}
      className="panel form-panel stack"
      aria-busy={pending}
      onChange={() => setDismissedResult(state)}
      onSubmit={() => setDismissedResult(state)}
    >
      <input type="hidden" name="courseId" value={courseId} />
      <fieldset
        disabled={pending}
        className="stack content-form-fields"
        aria-label="Målgrupp och lärandemål"
      >
        <SectionHeading
          title="Målgrupp och lärandemål"
          description="Fyllda fält visas på kursens offentliga sida. Ett tomt fält döljs. Texten är information till eleven och skapar ingen automatisk spärr för lektioner."
        />
        {fields.map(([key, label]) => (
          <Field key={key} name={`course-info-${key}`} label={label}>
            <textarea
              id={`course-info-${key}`}
              name={key}
              rows={4}
              maxLength={key === "learningOutcomes" ? 4000 : 2000}
              value={values[key]}
              onChange={(e) =>
                setValues((current) => ({ ...current, [key]: e.target.value }))
              }
            />
          </Field>
        ))}
      </fieldset>
      {pending && (
        <p className="notice" role="status">
          Sparar kursinformationen. Vänta tills sparningen är klar innan du
          ändrar den.
        </p>
      )}
      {!pending && state.error && (
        <p className="notice notice-error" role="alert">
          {state.error}
        </p>
      )}
      {!pending && state.success && dismissedResult !== state && (
        <p className="notice notice-success" role="status">
          {state.success}
        </p>
      )}
      <div>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Sparar…" : "Spara målgrupp och lärandemål"}
        </button>
      </div>
    </form>
  );
}
