import { DomainError, getCourseById, getDb, getUser, transaction, type Course, type Booking } from "./db";
import { z } from "zod";
import {
  businessSettingsSchema, courseInformationSchema, DEFAULT_BUSINESS_SETTINGS,
  EMPTY_COURSE_INFORMATION, type BusinessSettings, type CourseInformation,
} from "./business-config";

const BUSINESS_KEY = "public_business_settings_v1";
function courseKey(course: Pick<Course, "id" | "createdAt">) {
  // Creation time prevents a newly created course from inheriting deleted
  // course information if SQLite reuses its numeric ID.
  return `public_course_information_v1:${course.id}:${course.createdAt}`;
}
async function readJson(key: string): Promise<unknown> {
  const row = await getDb().prepare("SELECT value FROM app_meta WHERE key=?").get(key);
  if (!row) return {};
  try { return JSON.parse(String(row.value)); } catch { return {}; }
}
async function writeJson(key: string, value: unknown) {
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(key, JSON.stringify(value));
}
async function assertAdministrator(actorId: number) {
  if ((await getUser(actorId))?.role !== "admin") throw new DomainError("Du har inte tillgång till administrationen.");
}
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const stored = await readJson(BUSINESS_KEY);
  const result = businessSettingsSchema.safeParse({ ...DEFAULT_BUSINESS_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) });
  return result.success ? result.data : { ...DEFAULT_BUSINESS_SETTINGS };
}
export async function saveBusinessSettings(actorId: number, input: unknown) {
  return transaction(async () => {
    await assertAdministrator(actorId);
    const value = businessSettingsSchema.parse(input);
    await writeJson(BUSINESS_KEY, value);
    return value;
  });
}
export async function getCourseInformation(course: Pick<Course, "id" | "createdAt">): Promise<CourseInformation> {
  const stored = await readJson(courseKey(course));
  const result = courseInformationSchema.safeParse({ ...EMPTY_COURSE_INFORMATION, ...(stored && typeof stored === "object" ? stored : {}) });
  return result.success ? result.data : { ...EMPTY_COURSE_INFORMATION };
}
export async function saveCourseInformation(actorId: number, courseId: number, input: unknown) {
  return transaction(async () => {
    await assertAdministrator(actorId);
    const course = await getCourseById(courseId);
    if (!course) throw new DomainError("Kursen finns inte längre.");
    const value = courseInformationSchema.parse(input);
    await writeJson(courseKey(course), value);
    return value;
  });
}

const bookingTermsSchema = businessSettingsSchema.pick({ cancellationHours: true, cancellationDetails: true, legalName: true, organizationNumber: true })
  .extend({ recordedAt: z.iso.datetime() });
export type BookingTermsSnapshot = z.infer<typeof bookingTermsSchema>;

// Called inside the booking reservation transaction. Later edits to general
// terms must not silently change the cancellation rule for an existing booking.
export async function recordBookingTermsSnapshot(booking: Pick<Booking, "reference" | "createdAt">) {
  const business = await getBusinessSettings();
  const value = bookingTermsSchema.parse({ ...business, recordedAt: booking.createdAt });
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING")
    .run(`booking_terms_v1:${booking.reference}`, JSON.stringify(value));
}
export async function getBookingTerms(reference: string): Promise<BookingTermsSnapshot | null> {
  if (!/^[a-f0-9]{32}$/.test(reference)) return null;
  const value = bookingTermsSchema.safeParse(await readJson(`booking_terms_v1:${reference}`));
  return value.success ? value.data : null;
}
