import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  createFirstAdmin,
  createUser,
  getAccessibleCourse,
  getCourseSummaries,
  getCourses,
  getDb,
  getEnrollments,
  getLesson,
  getLessonOutline,
  getLessons,
  getPortalCourseSummaries,
  type Course,
  type User,
} from "../src/lib/db";
import {
  enrollStudent,
  markLesson,
  removeEnrollment,
  saveCourse,
  saveLesson,
} from "../src/lib/admin";
import { hashPassword } from "../src/lib/security";

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
const directory = mkdtempSync(join(tmpdir(), "tibb-course-query-tests-"));
process.env.TIBB_DATABASE_PATH = join(directory, "tibb.sqlite");
let admin: User;
let student: User;
let other: User;
let courseNumber = 0;

before(async () => {
  admin = await createFirstAdmin({
    name: "Course Query Admin",
    email: "query-admin@example.test",
    passwordHash: hashPassword("course query admin password"),
  });
  student = await createUser({
    name: "Course Query Student",
    email: "query-student@example.test",
    passwordHash: hashPassword("course query student password"),
    role: "student",
  });
  other = await createUser({
    name: "Other Query Student",
    email: "query-other@example.test",
    passwordHash: hashPassword("other course query password"),
    role: "student",
  });
  await getDb().prepare("UPDATE users SET email_verified_at=? WHERE id IN (?,?)")
    .run(new Date().toISOString(), student.id, other.id);
});

after(async () => {
  await getDb().close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("tibb-course-query-tests-"));
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

async function course(lessonCount = 0, published = false) {
  const slug = `course-query-${++courseNumber}`;
  await saveCourse(admin.id, {
    title: `Course query ${courseNumber}`,
    slug,
    description: "Course query fixture",
    price: "0",
    published: false,
  });
  const value = (await getCourses()).find((item) => item.slug === slug)!;
  for (let index = 1; index <= lessonCount; index++)
    await saveLesson(admin.id, {
      courseId: value.id,
      title: `Lesson ${index}`,
      body: `PRIVATE_BODY_${value.id}_${index}`,
      videoUrl: "",
      materialUrl: "",
      position: index,
    });
  if (published) await publish(value, true);
  return value;
}

async function publish(value: Course, published: boolean) {
  await saveCourse(admin.id, {
    id: value.id,
    title: value.title,
    slug: value.slug,
    description: value.description,
    price: "0",
    published,
  });
}

async function revoke(value: Course, user: User) {
  const enrollment = (await getEnrollments()).find(
    (item) => item.courseId === value.id && item.userId === user.id,
  )!;
  await removeEnrollment(admin.id, enrollment.id);
}

test("admin course summaries count lessons and enrollments without multiplying joined rows or dropping empty courses", async () => {
  const populated = await course(3, true);
  const empty = await course();
  await enrollStudent(admin.id, populated.id, student.email);
  await enrollStudent(admin.id, populated.id, other.email);
  const summaries = await getCourseSummaries();
  const populatedSummary = summaries.find((item) => item.id === populated.id)!;
  assert.equal(populatedSummary.lessonCount, 3);
  assert.equal(populatedSummary.enrollmentCount, 2);
  const emptySummary = summaries.find((item) => item.id === empty.id)!;
  assert.equal(emptySummary.lessonCount, 0);
  assert.equal(emptySummary.enrollmentCount, 0);
  assert.equal(emptySummary.published, false);
});

test("portal summaries include only current permitted courses and count each student's own progress", async () => {
  const accessible = await course(3, true);
  const draft = await course(1);
  const notEnrolled = await course(1, true);
  await enrollStudent(admin.id, accessible.id, student.email);
  await enrollStudent(admin.id, accessible.id, other.email);
  await enrollStudent(admin.id, draft.id, student.email);
  const lessons = await getLessons(accessible.id);
  await markLesson(student.id, lessons[0].id, true);
  await markLesson(other.id, lessons[0].id, true);
  await markLesson(other.id, lessons[1].id, true);
  const studentSummary = (await getPortalCourseSummaries(student.id)).find(
    (item) => item.id === accessible.id,
  )!;
  assert.equal(studentSummary.lessonCount, 3);
  assert.equal(studentSummary.completedLessonCount, 1);
  assert.equal(studentSummary.progress, 33);
  const otherSummary = (await getPortalCourseSummaries(other.id)).find(
    (item) => item.id === accessible.id,
  )!;
  assert.equal(otherSummary.completedLessonCount, 2);
  assert.equal(otherSummary.progress, 67);
  const studentCourses = await getPortalCourseSummaries(student.id);
  assert.equal(
    studentCourses.some((item) => item.id === draft.id),
    false,
  );
  assert.equal(
    studentCourses.some((item) => item.id === notEnrolled.id),
    false,
  );
  assert.equal(
    (await getPortalCourseSummaries(admin.id)).some(
      (item) => item.id === draft.id,
    ),
    true,
  );
  assert.deepEqual(await getPortalCourseSummaries(999_999), []);
});

test("portal summaries reflect revoked enrollment and unpublishing immediately while re-enrollment preserves progress", async () => {
  const value = await course(2, true);
  await enrollStudent(admin.id, value.id, student.email);
  await markLesson(student.id, (await getLessons(value.id))[0].id, true);
  assert.equal(
    (await getPortalCourseSummaries(student.id)).find(
      (item) => item.id === value.id,
    )?.progress,
    50,
  );
  await revoke(value, student);
  assert.equal(
    (await getPortalCourseSummaries(student.id)).some(
      (item) => item.id === value.id,
    ),
    false,
  );
  await enrollStudent(admin.id, value.id, student.email);
  assert.equal(
    (await getPortalCourseSummaries(student.id)).find(
      (item) => item.id === value.id,
    )?.progress,
    50,
  );
  await publish(value, false);
  assert.equal(
    (await getPortalCourseSummaries(student.id)).some(
      (item) => item.id === value.id,
    ),
    false,
  );
  await publish(value, true);
  assert.equal(
    (await getPortalCourseSummaries(student.id)).find(
      (item) => item.id === value.id,
    )?.progress,
    50,
  );
});

test("accessible course lookup checks fresh role, publication and enrollment before private lesson reads", async () => {
  const value = await course(1);
  assert.equal(await getAccessibleCourse(student.id, value.id), undefined);
  assert.equal((await getAccessibleCourse(admin.id, value.id))?.id, value.id);
  await publish(value, true);
  assert.equal(await getAccessibleCourse(student.id, value.id), undefined);
  await enrollStudent(admin.id, value.id, student.email);
  assert.equal((await getAccessibleCourse(student.id, value.id))?.id, value.id);
  await revoke(value, student);
  assert.equal(await getAccessibleCourse(student.id, value.id), undefined);
  await enrollStudent(admin.id, value.id, student.email);
  await publish(value, false);
  assert.equal(await getAccessibleCourse(student.id, value.id), undefined);
  assert.equal(await getAccessibleCourse(999_999, value.id), undefined);
  assert.equal(await getAccessibleCourse(admin.id, 999_999), undefined);
});

test("lesson outlines retain navigation and content flags without including lesson bodies, media URLs or upload metadata", async () => {
  const value = await course();
  await saveLesson(admin.id, {
    courseId: value.id,
    title: "Video and text",
    body: "PRIVATE_TEXT",
    videoUrl: "https://example.test/private-video.mp4",
    materialUrl: "",
    position: 2,
  });
  await saveLesson(admin.id, {
    courseId: value.id,
    title: "External material",
    body: "",
    videoUrl: "",
    materialUrl: "https://example.test/private-file.pdf",
    position: 1,
  });
  const uploadId = randomUUID();
  await getDb()
    .prepare(
      "INSERT INTO uploads(id,kind,filename,content_type,size,storage_path,storage_provider,uploader_id,course_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      uploadId,
      "lesson-material",
      "Private file.pdf",
      "application/pdf",
      100,
      `fixture/${uploadId}.pdf`,
      "local",
      admin.id,
      value.id,
      new Date().toISOString(),
    );
  await saveLesson(admin.id, {
    courseId: value.id,
    title: "Uploaded material",
    body: "",
    videoUrl: "",
    materialUrl: "",
    materialUploadIds: [uploadId],
    position: 3,
  });
  const outline = await getLessonOutline(value.id);
  assert.deepEqual(
    outline.map((item) => item.title),
    ["External material", "Video and text", "Uploaded material"],
  );
  assert.equal(outline[0].hasMaterial, true);
  assert.equal(outline[0].hasText, false);
  assert.equal(outline[1].hasVideo, true);
  assert.equal(outline[1].hasText, true);
  assert.equal(outline[2].hasMaterial, true);
  for (const item of outline)
    for (const key of ["body", "videoUrl", "materialUrl", "materials"])
      assert.equal(key in item, false);
  const selected = await getLesson(outline[2].id, value.id);
  assert.equal(selected?.materials[0].id, uploadId);
  assert.equal(selected?.materials[0].name, "Private file.pdf");
});

test("loading one lesson is constrained to its course while legacy callers retain full lesson access", async () => {
  const first = await course(1);
  const second = await course(1);
  const firstLesson = (await getLessons(first.id))[0];
  const secondLesson = (await getLessons(second.id))[0];
  assert.equal(
    (await getLesson(firstLesson.id, first.id))?.body,
    firstLesson.body,
  );
  assert.equal(await getLesson(secondLesson.id, first.id), undefined);
  assert.equal((await getLesson(secondLesson.id))?.body, secondLesson.body);
  assert.equal(await getLesson(999_999, first.id), undefined);
});

test("course and portal summary query counts stay constant as the course catalog grows", async () => {
  for (let index = 0; index < 6; index++) {
    const value = await course(2, true);
    await enrollStudent(admin.id, value.id, student.email);
  }
  const database = getDb();
  const originalPrepare = database.prepare.bind(database);
  const queries: string[] = [];
  database.prepare = (sql: string) => {
    queries.push(sql);
    return originalPrepare(sql);
  };
  try {
    await getCourseSummaries();
    assert.equal(queries.length, 1);
    queries.length = 0;
    await getPortalCourseSummaries(student.id);
    assert.equal(queries.length, 1);
  } finally {
    database.prepare = originalPrepare;
  }
});
