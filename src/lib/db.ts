import { randomBytes } from "node:crypto";
import type {
  Article,
  Booking,
  Course,
  Enrollment,
  Lesson,
  Settings,
  Slot,
  Treatment,
  User,
} from "./types";
export type {
  Article,
  Booking,
  Course,
  Enrollment,
  Lesson,
  Settings,
  Slot,
  Treatment,
  User,
} from "./types";
export class DomainError extends Error {}
import { getDb, transaction } from "./database";
export {
  getDb,
  transaction,
  databaseConfigured,
  initializeDatabase,
} from "./database";
type Row = Record<string, unknown>;
const integer = (value: unknown) => Number(value);
const str = (value: unknown) => String(value ?? "");
function treatment(row: Row): Treatment {
  return {
    id: integer(row.id),
    name: str(row.name),
    description: str(row.description),
    durationMinutes: integer(row.duration_minutes),
    priceOre: integer(row.price_ore),
    active: !!row.active,
  };
}
function user(row: Row): User {
  return {
    id: integer(row.id),
    email: str(row.email),
    name: str(row.name),
    role: row.role as User["role"],
    createdAt: str(row.created_at),
  };
}
function article(row: Row): Article {
  return {
    id: integer(row.id),
    title: str(row.title),
    slug: str(row.slug),
    excerpt: str(row.excerpt),
    body: str(row.body),
    published: !!row.published,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}
function course(row: Row): Course {
  return {
    id: integer(row.id),
    title: str(row.title),
    slug: str(row.slug),
    description: str(row.description),
    priceOre: integer(row.price_ore),
    published: !!row.published,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}
function lesson(row: Row): Lesson {
  return {
    id: integer(row.id),
    courseId: integer(row.course_id),
    title: str(row.title),
    body: str(row.body),
    videoUrl: str(row.video_url),
    materialUrl: str(row.material_url),
    position: integer(row.position),
  };
}
function booking(row: Row): Booking {
  return {
    id: integer(row.id),
    reference: str(row.reference),
    treatmentId: integer(row.treatment_id),
    slotId: integer(row.slot_id),
    treatmentName: str(row.treatment_name),
    durationMinutes: integer(row.duration_minutes),
    priceOre: integer(row.price_ore),
    start: str(row.start),
    end: str(row.end),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    status: row.status as Booking["status"],
    paymentMethod: row.payment_method as Booking["paymentMethod"],
    paymentStatus: row.payment_status as Booking["paymentStatus"],
    checkoutSessionId: row.checkout_session_id
      ? str(row.checkout_session_id)
      : null,
    expiresAt: row.expires_at ? str(row.expires_at) : null,
    createdAt: str(row.created_at),
  };
}
export async function getTreatments(
  options: {
    activeOnly?: boolean;
  } = {},
) {
  return (
    await getDb()
      .prepare(
        `SELECT * FROM treatments ${options.activeOnly ? "WHERE active=1" : ""} ORDER BY id`,
      )
      .all()
  ).map((row) => treatment(row));
}
export async function getTreatment(id: number) {
  const row = await getDb()
    .prepare("SELECT * FROM treatments WHERE id=?")
    .get(id);
  return row ? treatment(row) : undefined;
}
export async function expireBookings() {
  await getDb()
    .prepare(
      "UPDATE bookings SET status='cancelled' WHERE status='pending' AND payment_method='stripe' AND expires_at<=?",
    )
    .run(new Date().toISOString());
}
export async function getSlots(
  options: {
    futureOnly?: boolean;
    treatmentId?: number;
  } = {},
) {
  await expireBookings();
  const conditions: string[] = ["s.archived=0"];
  const values: (string | number)[] = [];
  if (options.futureOnly) {
    conditions.push("s.start>?");
    values.push(new Date().toISOString());
  }
  if (options.treatmentId) {
    conditions.push("s.treatment_id=?");
    values.push(options.treatmentId);
  }
  return (
    await getDb()
      .prepare(
        `SELECT s.*,t.name AS treatment_name, EXISTS(SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed') AND b.start<s.end AND b.end>s.start) AS booked FROM slots s JOIN treatments t ON t.id=s.treatment_id WHERE ${conditions.join(" AND ")} ORDER BY s.start`,
      )
      .all(...values)
  ).map(
    (row) =>
      ({
        id: integer(row.id),
        treatmentId: integer(row.treatment_id),
        treatmentName: str(row.treatment_name),
        start: str(row.start),
        end: str(row.end),
        booked: !!row.booked,
      }) satisfies Slot,
  );
}
export async function getBookings() {
  await expireBookings();
  return (
    await getDb().prepare("SELECT * FROM bookings ORDER BY start DESC").all()
  ).map(booking);
}
export async function getBookingByReference(reference: string) {
  await expireBookings();
  const row = await getDb()
    .prepare("SELECT * FROM bookings WHERE reference=?")
    .get(reference);
  return row ? booking(row) : undefined;
}
export async function getSettings(): Promise<Settings> {
  const row = (await getDb()
    .prepare("SELECT * FROM settings WHERE id=1")
    .get())!;
  return {
    siteName: str(row.site_name),
    email: str(row.email),
    phone: str(row.phone),
    address: str(row.address),
    location: str(row.location),
    payOnSite: !!row.pay_on_site,
    stripeEnabled: !!row.stripe_enabled,
  };
}
export async function getArticles(
  options: {
    publishedOnly?: boolean;
  } = {},
) {
  return (
    await getDb()
      .prepare(
        `SELECT * FROM articles ${options.publishedOnly ? "WHERE published=1" : ""} ORDER BY updated_at DESC`,
      )
      .all()
  ).map(article);
}
export async function getArticle(
  slug: string,
  options: {
    publishedOnly?: boolean;
  } = {},
) {
  const row = await getDb()
    .prepare(
      `SELECT * FROM articles WHERE slug=? ${options.publishedOnly ? "AND published=1" : ""}`,
    )
    .get(slug);
  return row ? article(row) : undefined;
}
export async function getCourses(
  options: {
    publishedOnly?: boolean;
  } = {},
) {
  return (
    await getDb()
      .prepare(
        `SELECT * FROM courses ${options.publishedOnly ? "WHERE published=1" : ""} ORDER BY id DESC`,
      )
      .all()
  ).map(course);
}
export async function getCourse(
  slug: string,
  options: {
    publishedOnly?: boolean;
  } = {},
) {
  const row = await getDb()
    .prepare(
      `SELECT * FROM courses WHERE slug=? ${options.publishedOnly ? "AND published=1" : ""}`,
    )
    .get(slug);
  return row ? course(row) : undefined;
}
export async function getCourseById(id: number) {
  const row = await getDb().prepare("SELECT * FROM courses WHERE id=?").get(id);
  return row ? course(row) : undefined;
}
export async function getLessons(courseId: number) {
  return (
    await getDb()
      .prepare("SELECT * FROM lessons WHERE course_id=? ORDER BY position,id")
      .all(courseId)
  ).map(lesson);
}
export async function getLesson(id: number) {
  const row = await getDb().prepare("SELECT * FROM lessons WHERE id=?").get(id);
  return row ? lesson(row) : undefined;
}
export async function getUsers() {
  return (
    await getDb().prepare("SELECT * FROM users ORDER BY created_at DESC").all()
  ).map(user);
}
export async function getUser(id: number) {
  const row = await getDb().prepare("SELECT * FROM users WHERE id=?").get(id);
  return row ? user(row) : undefined;
}
export async function getSessionUser(hash: string) {
  const row = await getDb()
    .prepare("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?")
    .get(hash, new Date().toISOString());
  return row ? await getUser(Number(row.user_id)) : undefined;
}
export async function getUserByEmail(email: string) {
  const row = await getDb()
    .prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE")
    .get(email);
  return row
    ? { ...user(row), passwordHash: str(row.password_hash) }
    : undefined;
}
export async function getEnrollments(userId?: number): Promise<Enrollment[]> {
  return (
    await getDb()
      .prepare(
        `SELECT e.*,u.name,u.email,c.title AS course_title FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id ${userId ? "WHERE e.user_id=?" : ""} ORDER BY e.created_at DESC`,
      )
      .all(...(userId ? [userId] : []))
  ).map((row) => ({
    id: integer(row.id),
    userId: integer(row.user_id),
    courseId: integer(row.course_id),
    name: str(row.name),
    email: str(row.email),
    courseTitle: str(row.course_title),
    createdAt: str(row.created_at),
  }));
}
export async function getStudentCourses(userId: number): Promise<Course[]> {
  return (
    await getDb()
      .prepare(
        "SELECT c.* FROM courses c JOIN enrollments e ON c.id=e.course_id WHERE e.user_id=? AND c.published=1 ORDER BY e.created_at DESC",
      )
      .all(userId)
  ).map(course);
}
export async function hasCourseAccess(userId: number, courseId: number) {
  return !!(await getDb()
    .prepare(
      "SELECT c.id FROM courses c JOIN users u ON u.id=? WHERE c.id=? AND (u.role='admin' OR (c.published=1 AND EXISTS(SELECT 1 FROM enrollments e WHERE e.user_id=u.id AND e.course_id=c.id)))",
    )
    .get(userId, courseId));
}
export async function getCourseProgress(userId: number, courseId: number) {
  return (
    await getDb()
      .prepare(
        "SELECT p.lesson_id FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE p.user_id=? AND l.course_id=?",
      )
      .all(userId, courseId)
  ).map((row) => integer(row.lesson_id));
}
export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: User["role"];
}) {
  const result = await getDb()
    .prepare(
      "INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)",
    )
    .run(
      input.name,
      input.email.toLowerCase(),
      input.passwordHash,
      input.role,
      new Date().toISOString(),
    );
  return (await getUser(Number(result.lastInsertRowid)))!;
}
export async function createFirstAdmin(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  return await transaction(async () => {
    if (await getDb().prepare("SELECT id FROM users WHERE role='admin'").get())
      throw new DomainError("Ett administratörskonto finns redan.");
    return await createUser({ ...input, role: "admin" });
  });
}
export async function hasAdmin() {
  return !!(await getDb()
    .prepare("SELECT id FROM users WHERE role='admin'")
    .get());
}
export async function rateLimit(
  key: string,
  limit: number,
  windowMinutes: number,
): Promise<boolean> {
  return await transaction(async () => {
    const now = new Date().toISOString();
    await getDb()
      .prepare("DELETE FROM rate_limits WHERE expires_at<=?")
      .run(now);
    const row = await getDb()
      .prepare("SELECT count FROM rate_limits WHERE key=?")
      .get(key);
    if (row && integer(row.count) >= limit) return false;
    await getDb()
      .prepare(
        "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
      )
      .run(key, new Date(Date.now() + windowMinutes * 60000).toISOString());
    return true;
  });
}
export async function reserveBooking(input: {
  slotId: number;
  name: string;
  email: string;
  phone: string;
  paymentMethod: "onsite" | "stripe";
}): Promise<Booking> {
  return await transaction(async () => {
    await expireBookings();
    const row = await getDb()
      .prepare(
        "SELECT s.*,t.name,t.description,t.active,t.duration_minutes,t.price_ore FROM slots s JOIN treatments t ON t.id=s.treatment_id WHERE s.id=?",
      )
      .get(input.slotId);
    if (
      !row ||
      !row.active ||
      row.archived ||
      str(row.start) <= new Date().toISOString()
    )
      throw new DomainError("Den valda tiden är inte längre tillgänglig.");
    if (
      await getDb()
        .prepare(
          "SELECT id FROM bookings WHERE status IN ('pending','confirmed','completed') AND start<? AND end>?",
        )
        .get(str(row.end), str(row.start))
    )
      throw new DomainError(
        "Tiden hann bokas av någon annan. Välj en annan tid.",
      );
    const settings = await getSettings();
    if (input.paymentMethod === "onsite" && !settings.payOnSite)
      throw new DomainError("Betalning vid besöket är inte tillgänglig.");
    if (
      input.paymentMethod === "stripe" &&
      (!settings.stripeEnabled ||
        !process.env.STRIPE_SECRET_KEY ||
        !process.env.STRIPE_WEBHOOK_SECRET ||
        !process.env.APP_URL)
    )
      throw new DomainError("Kortbetalning är inte tillgänglig ännu.");
    const reference = randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    const expires =
      input.paymentMethod === "stripe"
        ? new Date(Date.now() + 35 * 60000).toISOString()
        : null;
    await getDb()
      .prepare(
        "INSERT INTO bookings(reference,treatment_id,slot_id,treatment_name,duration_minutes,price_ore,start,end,name,email,phone,status,payment_method,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        reference,
        integer(row.treatment_id),
        input.slotId,
        str(row.name),
        integer(row.duration_minutes),
        integer(row.price_ore),
        str(row.start),
        str(row.end),
        input.name,
        input.email.toLowerCase(),
        input.phone,
        input.paymentMethod === "onsite" ? "confirmed" : "pending",
        input.paymentMethod,
        expires,
        now,
      );
    return (await getBookingByReference(reference))!;
  });
}
export async function cancelPendingBooking(reference: string) {
  await getDb()
    .prepare(
      "UPDATE bookings SET status='cancelled' WHERE reference=? AND status='pending' AND payment_status='pending'",
    )
    .run(reference);
}
export async function attachCheckout(reference: string, sessionId: string) {
  await getDb()
    .prepare(
      "UPDATE bookings SET checkout_session_id=? WHERE reference=? AND status='pending'",
    )
    .run(sessionId, reference);
}
export async function completeStripeBooking(
  sessionId: string,
  amount: number,
  currency: string,
): Promise<"confirmed" | "already-paid" | "already-refunded" | "needs-refund"> {
  return await transaction(async () => {
    await expireBookings();
    const row = await getDb()
      .prepare("SELECT * FROM bookings WHERE checkout_session_id=?")
      .get(sessionId);
    if (
      !row ||
      row.payment_method !== "stripe" ||
      integer(row.price_ore) !== amount ||
      currency !== "sek"
    )
      throw new DomainError("Betalningen matchar inte bokningen.");
    if (row.payment_status === "paid") return "already-paid";
    if (row.payment_status === "refunded") return "already-refunded";
    if (row.status !== "pending") return "needs-refund";
    await getDb()
      .prepare(
        "UPDATE bookings SET status='confirmed',payment_status='paid',expires_at=NULL WHERE id=?",
      )
      .run(integer(row.id));
    return "confirmed";
  });
}
export async function expireStripeSession(sessionId: string) {
  await getDb()
    .prepare(
      "UPDATE bookings SET status='cancelled' WHERE checkout_session_id=? AND status='pending' AND payment_status='pending'",
    )
    .run(sessionId);
}
export async function refundStripeBooking(sessionId: string) {
  await getDb()
    .prepare(
      "UPDATE bookings SET status='cancelled',payment_status='refunded',expires_at=NULL WHERE checkout_session_id=? AND payment_method='stripe' AND payment_status IN ('paid','pending')",
    )
    .run(sessionId);
}
