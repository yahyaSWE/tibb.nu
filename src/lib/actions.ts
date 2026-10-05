"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSession,
  destroySession,
  requireAdmin,
  requireUser,
} from "./auth";
import {
  DomainError,
  cancelPendingBooking,
  createFirstAdmin,
  getBookings,
  getUserByEmail,
  hasAdmin,
  rateLimit,
  reserveBooking,
} from "./db";
import { registerStudent } from "./accounts";
import * as admin from "./admin";
import * as availability from "./availability";
import {
  equalSecret,
  hashPassword,
  tokenHash,
  verifyPassword,
} from "./security";
import {
  bookingSchema,
  emailSchema,
  field,
  idField,
  signupSchema,
} from "./validation";
import { createCheckout, getStripe } from "./stripe";
function path(value: string, fallback: string) {
  return /^\/(?!\/)/.test(value) &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
    ? value
    : fallback;
}
function message(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || "Kontrollera fälten och försök igen.";
  if (error instanceof Error && error.message.includes("UNIQUE constraint"))
    return "E-postadressen eller webbadressen används redan.";
  console.error(
    "Tibb action failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return "Åtgärden kunde inte slutföras. Försök igen.";
}
async function formAction(
  form: FormData,
  fallback: string,
  work: () => void | string | Promise<void | string>,
  authForm = false,
) {
  let destination = authForm
    ? fallback +
      (field(form, "returnTo")
        ? "?returnTo=" +
          encodeURIComponent(path(field(form, "returnTo"), "/elevportal"))
        : "")
    : path(field(form, "returnTo"), fallback);
  try {
    const result = await work();
    revalidatePath("/", "layout");
    destination =
      result ||
      destination +
        (destination.includes("?") ? "&" : "?") +
        "success=" +
        encodeURIComponent("Ändringarna har sparats.");
  } catch (error) {
    destination =
      destination +
      (destination.includes("?") ? "&" : "?") +
      "error=" +
      encodeURIComponent(message(error));
  }
  redirect(destination);
}
async function requestLimit(action: string, subject: string, count: number) {
  const header = await headers();
  const ip =
    process.env.TRUST_PROXY === "1"
      ? header.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
      : "global";
  if (
    !(await rateLimit(`${action}:${tokenHash(subject)}`, count, 15)) ||
    !(await rateLimit(`${action}:ip:${tokenHash(ip)}`, 100, 15))
  )
    throw new DomainError(
      "För många försök. Vänta 15 minuter och försök igen.",
    );
}
export async function loginAction(form: FormData): Promise<void> {
  await formAction(
    form,
    "/logga-in",
    async () => {
      const email = emailSchema.parse(field(form, "email"));
      const password = z
        .string()
        .min(1)
        .max(128)
        .parse(field(form, "password"));
      await requestLimit("login", email, 10);
      const user = await getUserByEmail(email);
      const valid = verifyPassword(
        password,
        user?.passwordHash || "missing:" + "0".repeat(128),
      );
      if (!user || !valid)
        throw new DomainError("E-postadress eller lösenord är fel.");
      await createSession(user.id);
      return path(
        field(form, "returnTo"),
        user.role === "admin" ? "/admin" : "/elevportal",
      );
    },
    true,
  );
}
export async function signupAction(form: FormData): Promise<void> {
  await formAction(
    form,
    "/registrera",
    async () => {
      const input = signupSchema.parse({
        name: field(form, "name"),
        email: field(form, "email"),
        password: field(form, "password"),
      });
      await requestLimit("signup", input.email, 5);
      const user = await registerStudent(input);
      await createSession(user.id);
      return (
        "/elevportal?success=" +
        encodeURIComponent(
          "Ditt konto är skapat. Kursåtkomst tilldelas av administratören.",
        )
      );
    },
    true,
  );
}
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
export async function createBookingAction(form: FormData): Promise<void> {
  await formAction(form, "/bokning", async () => {
    const input = bookingSchema.parse({
      slotId: field(form, "slotId"),
      name: field(form, "name"),
      email: field(form, "email"),
      phone: field(form, "phone"),
      paymentMethod: field(form, "paymentMethod"),
      consent: field(form, "consent"),
    });
    await requestLimit("booking", input.email, 10);
    const booking = await reserveBooking(input);
    if (input.paymentMethod === "stripe") {
      try {
        return await createCheckout(booking);
      } catch (error) {
        await cancelPendingBooking(booking.reference);
        throw error;
      }
    }
    return `/bokning/bekraftelse?ref=${booking.reference}`;
  });
}
export async function saveTreatmentAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/behandlingar",
    async () =>
      await admin.saveTreatment(user.id, {
        id: field(form, "id") ? idField(form) : undefined,
        name: field(form, "name"),
        description: field(form, "description"),
        durationMinutes: Number(field(form, "durationMinutes")),
        price: field(form, "price"),
        active: field(form, "active") === "on",
      }),
  );
}
export async function deleteTreatmentAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/behandlingar",
    async () => await admin.archiveTreatment(user.id, idField(form)),
  );
}
export async function savePractitionerAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/behandlare", async () => {
    await admin.savePractitioner(user.id, {
      id: field(form, "id") ? idField(form) : undefined,
      name: field(form, "name"),
      description: field(form, "description"),
      active: field(form, "active") === "on",
    });
  });
}
export async function archivePractitionerAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/behandlare", async () => {
    await admin.archivePractitioner(user.id, idField(form));
  });
}
export async function saveSlotAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/tider", async () => {
    await admin.saveSlot(
      user.id,
      idField(form, "treatmentId"),
      field(form, "start"),
      idField(form, "practitionerId"),
    );
  });
}
export async function deleteSlotAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/tider",
    async () => await admin.deleteSlot(user.id, idField(form)),
  );
}
export async function saveAvailabilityScheduleAction(
  form: FormData,
): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/tider", async () => {
    const starts = form.getAll("breakStart").map(String);
    const ends = form.getAll("breakEnd").map(String);
    if (starts.length !== ends.length)
      throw new DomainError("Ange både start och slut för varje rast.");
    const result = await availability.saveAvailabilitySchedule(user.id, {
      treatmentId: idField(form, "treatmentId"),
      practitionerId: idField(form, "practitionerId"),
      startDate: field(form, "startDate"),
      endDate: field(form, "endDate"),
      weekdays: form.getAll("weekdays").map(Number),
      startTime: field(form, "startTime"),
      endTime: field(form, "endTime"),
      breaks: starts.map((startTime, index) => ({
        startTime,
        endTime: ends[index],
      })),
    });
    return (
      "/admin/tider?success=" +
      encodeURIComponent(
        `${result.created} tider skapades.` +
          (result.blocked
            ? ` ${result.blocked} av dem är spärrade och visas inte för kunder.`
            : "") +
          (result.skipped
            ? ` ${result.skipped} tider hoppades över eftersom de redan finns, är bokade eller har passerat.`
            : ""),
      )
    );
  });
}
export async function deleteAvailabilityScheduleAction(
  form: FormData,
): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/tider", async () => {
    await availability.deleteAvailabilitySchedule(user.id, idField(form));
    return (
      "/admin/tider?success=" +
      encodeURIComponent(
        "Perioden och dess framtida lediga tider har tagits bort. Befintliga bokningar har behållits.",
      )
    );
  });
}
export async function saveAvailabilityBlockAction(
  form: FormData,
): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/tider", async () => {
    await availability.saveAvailabilityBlock(user.id, {
      practitionerId: field(form, "practitionerId")
        ? idField(form, "practitionerId")
        : undefined,
      startDate: field(form, "startDate"),
      endDate: field(form, "endDate"),
      allDay: field(form, "allDay") === "on",
      startTime: field(form, "startTime"),
      endTime: field(form, "endTime"),
      reason: field(form, "reason"),
    });
    return (
      "/admin/tider?success=" +
      encodeURIComponent(
        "Spärren har sparats. Tider som överlappar kan inte bokas.",
      )
    );
  });
}
export async function deleteAvailabilityBlockAction(
  form: FormData,
): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/tider", async () => {
    await availability.deleteAvailabilityBlock(user.id, idField(form));
    return (
      "/admin/tider?success=" +
      encodeURIComponent(
        "Spärren har tagits bort. Publicerade lediga tider kan bokas igen.",
      )
    );
  });
}
export async function updateBookingAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(form, "/admin/bokningar", async () => {
    const id = idField(form);
    const booking = (await getBookings()).find((item) => item.id === id);
    if (
      booking?.paymentMethod === "stripe" &&
      booking.status === "pending" &&
      field(form, "status") === "cancelled" &&
      booking.checkoutSessionId
    ) {
      try {
        await getStripe().checkout.sessions.expire(booking.checkoutSessionId);
      } catch {
        throw new DomainError(
          "Kortbetalningen kunde inte avslutas. Kontrollera betalningen i Stripe innan du avbokar.",
        );
      }
    }
    await admin.updateBooking(
      user.id,
      id,
      field(form, "status"),
      field(form, "paymentStatus"),
    );
  });
}
export async function saveSettingsAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/installningar",
    async () =>
      await admin.saveSettings(user.id, {
        siteName: field(form, "siteName"),
        email: field(form, "email"),
        phone: field(form, "phone"),
        address: field(form, "address"),
        location: field(form, "location"),
        payOnSite: field(form, "payOnSite") === "on",
        stripeEnabled: field(form, "stripeEnabled") === "on",
      }),
  );
}
export async function saveArticleAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/artiklar",
    async () =>
      await admin.saveArticle(user.id, {
        id: field(form, "id") ? idField(form) : undefined,
        title: field(form, "title"),
        slug: field(form, "slug"),
        excerpt: field(form, "excerpt"),
        body: field(form, "body"),
        published: field(form, "published") === "on",
      }),
  );
}
export async function deleteArticleAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/artiklar",
    async () => await admin.deleteArticle(user.id, idField(form)),
  );
}
export async function saveCourseAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/kurser",
    async () =>
      await admin.saveCourse(user.id, {
        id: field(form, "id") ? idField(form) : undefined,
        title: field(form, "title"),
        slug: field(form, "slug"),
        description: field(form, "description"),
        price: field(form, "price"),
        published: field(form, "published") === "on",
      }),
  );
}
export async function deleteCourseAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/kurser",
    async () => await admin.deleteCourse(user.id, idField(form)),
  );
}
export async function saveLessonAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/kurser",
    async () =>
      await admin.saveLesson(user.id, {
        id: field(form, "id") ? idField(form) : undefined,
        courseId: idField(form, "courseId"),
        title: field(form, "title"),
        body: field(form, "body"),
        videoUrl: field(form, "videoUrl"),
        materialUrl: field(form, "materialUrl"),
        position: Number(field(form, "position")),
      }),
  );
}
export async function deleteLessonAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/kurser",
    async () =>
      await admin.deleteLesson(
        user.id,
        idField(form),
        idField(form, "courseId"),
      ),
  );
}
export async function enrollStudentAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/elever",
    async () =>
      await admin.enrollStudent(
        user.id,
        idField(form, "courseId"),
        field(form, "email"),
      ),
  );
}
export async function removeEnrollmentAction(form: FormData): Promise<void> {
  const user = await requireAdmin();
  await formAction(
    form,
    "/admin/elever",
    async () => await admin.removeEnrollment(user.id, idField(form)),
  );
}
export async function markLessonAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await formAction(
    form,
    "/elevportal",
    async () =>
      await admin.markLesson(
        user.id,
        idField(form, "lessonId"),
        field(form, "completed") === "on",
      ),
  );
}
export async function setupAction(form: FormData): Promise<void> {
  await formAction(form, "/setup", async () => {
    await requestLimit("setup", "first-admin", 5);
    if (await hasAdmin())
      throw new DomainError("Administrationen är redan konfigurerad.");
    const token = process.env.SETUP_TOKEN;
    if (
      !token ||
      token.length < 32 ||
      !equalSecret(field(form, "token"), token)
    )
      throw new DomainError("Konfigurationstoken är fel eller saknas.");
    const input = signupSchema.parse({
      name: field(form, "name"),
      email: field(form, "email"),
      password: field(form, "password"),
    });
    const user = await createFirstAdmin({
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),
    });
    await createSession(user.id);
    return (
      "/admin?success=" + encodeURIComponent("Administratörskontot är skapat.")
    );
  });
}
