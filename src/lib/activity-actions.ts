"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "./auth";
import { DomainError } from "./db";
import { field, idField } from "./validation";
import {
  reviewAssignment,
  saveAssignment,
  saveCourseActivity,
  submitQuiz,
} from "./course-activities";
import type { ActivityActionState } from "./activity-action-state";

function actionError(error: unknown): ActivityActionState {
  if (error instanceof DomainError) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message || "Kontrollera fälten och försök igen." };
  console.error("Tibb course activity failed", error instanceof Error ? error.name : "UnknownError");
  return { error: "Det gick inte att spara. Dina svar finns kvar i formuläret. Försök igen." };
}

function refreshActivity(courseId: number, lessonId: number) {
  revalidatePath(`/admin/kurser/${courseId}`);
  revalidatePath(`/elevportal/kurser/${courseId}`);
  revalidatePath(`/elevportal/kurser/${courseId}/lektioner/${lessonId}`);
}

function parseQuestions(form: FormData) {
  const json = field(form, "questionsJson");
  if (json.length > 250000)
    throw new DomainError("Quizet är för stort. Använd högst 30 frågor.");
  try {
    // The domain validates the complete structure and every answer key.
    return JSON.parse(json);
  } catch {
    throw new DomainError("Kontrollera quizfrågorna och försök igen.");
  }
}

export async function saveCourseActivityAction(
  _previousState: ActivityActionState,
  form: FormData,
): Promise<ActivityActionState> {
  const user = await requireAdmin();
  try {
    const courseId = idField(form, "courseId");
    const lessonId = idField(form, "lessonId");
    const kind = z.enum(["quiz", "assignment"]).parse(field(form, "kind"));
    await saveCourseActivity(user.id, {
      id: field(form, "id") ? idField(form, "id") : undefined,
      revision: field(form, "revision") ? idField(form, "revision") : undefined,
      courseId,
      lessonId,
      kind,
      title: field(form, "title"),
      instructions: field(form, "instructions"),
      position: Number(field(form, "position")),
      active: field(form, "active") === "on",
      ...(kind === "quiz" ? {
        questions: parseQuestions(form),
        passPercent: Number(field(form, "passPercent")),
      } : {}),
    });
    refreshActivity(courseId, lessonId);
    return { success: "Aktiviteten har sparats." };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitQuizAction(
  _previousState: ActivityActionState,
  form: FormData,
): Promise<ActivityActionState> {
  const user = await requireUser();
  try {
    const courseId = idField(form, "courseId");
    const lessonId = idField(form, "lessonId");
    const answers = Array.from(form.entries())
      .filter(([name]) => name.startsWith("answer:"))
      .map(([name, value]) => ({
        questionId: name.slice("answer:".length),
        optionIndex: typeof value === "string" && value.trim() !== "" ? Number(value) : NaN,
      }));
    const attempt = await submitQuiz(user.id, {
      activityId: idField(form, "activityId"),
      courseId,
      lessonId,
      revision: idField(form, "revision"),
      answers,
    });
    refreshActivity(courseId, lessonId);
    return { success: `Quizet är rättat: ${attempt.correctCount} av ${attempt.questionCount} rätt (${attempt.scorePercent} %). ${attempt.passed ? "Godkänt!" : "Du kan försöka igen."}` };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveAssignmentAction(
  _previousState: ActivityActionState,
  form: FormData,
): Promise<ActivityActionState> {
  const user = await requireUser();
  try {
    const courseId = idField(form, "courseId");
    const lessonId = idField(form, "lessonId");
    const intent = z.enum(["draft", "submit"]).parse(field(form, "intent"));
    await saveAssignment(user.id, {
      activityId: idField(form, "activityId"),
      courseId,
      lessonId,
      revision: idField(form, "revision"),
      text: field(form, "text"),
      submit: intent === "submit",
    });
    refreshActivity(courseId, lessonId);
    return { success: intent === "submit" ? "Uppgiften är inlämnad. Du ser lärarens återkoppling här när den har granskats." : "Ditt utkast har sparats." };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewAssignmentAction(
  _previousState: ActivityActionState,
  form: FormData,
): Promise<ActivityActionState> {
  const user = await requireAdmin();
  try {
    const courseId = idField(form, "courseId");
    const lessonId = idField(form, "lessonId");
    await reviewAssignment(user.id, {
      submissionId: idField(form, "submissionId"),
      courseId,
      lessonId,
      feedback: field(form, "feedback"),
      status: z.enum(["approved", "needs_revision"]).parse(field(form, "status")),
    });
    refreshActivity(courseId, lessonId);
    return { success: "Bedömningen och återkopplingen har sparats." };
  } catch (error) {
    return actionError(error);
  }
}
