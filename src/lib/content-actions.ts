"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { DomainError } from "./db";
import * as admin from "./admin";
import { field, idField } from "./validation";
import { revalidateMutation } from "./revalidation";
import {
  articleFields,
  courseFields,
  lessonFields,
  type ArticleFields,
  type ContentActionState,
  type CourseFields,
  type LessonFields,
} from "./content-action-state";

function errorMessage(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || "Kontrollera fälten och försök igen.";
  if (
    error instanceof Error &&
    /UNIQUE constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message)
  )
    return "Adressnamnet används redan. Välj ett annat adressnamn.";
  console.error(
    "Tibb content save failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return "Det gick inte att spara. Din inmatning finns kvar i formuläret. Försök igen.";
}

function successfulSave(
  form: FormData,
  area: string,
  kind: "article" | "course" | "lesson",
): never {
  const requested = field(form, "returnTo");
  const destination = new RegExp(`^${area}(?:/\\d+)?$`).test(requested)
    ? requested
    : area;
  revalidateMutation(area, destination);
  // A new token also resets a successfully created lesson when its parent
  // page remains mounted after the redirect. Failed saves never navigate.
  const formKey = `${kind}-${field(form, "id") || "new"}`;
  redirect(
    `${destination}?success=${encodeURIComponent("Ändringarna har sparats.")}&saved=${Date.now()}&savedForm=${encodeURIComponent(formKey)}`,
  );
}

export async function saveArticleContentAction(
  _previousState: ContentActionState<ArticleFields>,
  form: FormData,
): Promise<ContentActionState<ArticleFields>> {
  const user = await requireAdmin();
  const values = articleFields(form);
  try {
    await admin.saveArticle(user.id, {
      id: field(form, "id") ? idField(form) : undefined,
      ...values,
    });
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  successfulSave(form, "/admin/artiklar", "article");
}

export async function saveCourseContentAction(
  _previousState: ContentActionState<CourseFields>,
  form: FormData,
): Promise<ContentActionState<CourseFields>> {
  const user = await requireAdmin();
  const values = courseFields(form);
  try {
    await admin.saveCourse(user.id, {
      id: field(form, "id") ? idField(form) : undefined,
      ...values,
    });
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  successfulSave(form, "/admin/kurser", "course");
}

export async function saveLessonContentAction(
  _previousState: ContentActionState<LessonFields>,
  form: FormData,
): Promise<ContentActionState<LessonFields>> {
  const user = await requireAdmin();
  const values = lessonFields(form);
  try {
    await admin.saveLesson(user.id, {
      id: field(form, "id") ? idField(form) : undefined,
      courseId: idField(form, "courseId"),
      ...values,
      position: Number(values.position),
    });
  } catch (error) {
    return { error: errorMessage(error), values };
  }
  successfulSave(form, "/admin/kurser", "lesson");
}
