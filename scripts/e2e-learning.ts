import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import assert from "node:assert/strict";
import {
  getDb,
  getUserByEmail,
  getCourseProgress,
  getCourse,
  getLessons,
} from "../src/lib/db";
import { enrollStudent, removeEnrollment } from "../src/lib/admin";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
assert.ok(
  process.argv[2],
  "Pass the fresh database path printed by scripts/e2e-fixture.ts.",
);
const fixturePath = realpathSync(resolve(process.argv[2]));
assert.equal(
  dirname(dirname(fixturePath)),
  realpathSync(tmpdir()),
  "The fixture must be in an owned OS temporary directory.",
);
assert.ok(
  basename(dirname(fixturePath)).startsWith("tibb-e2e-") &&
    basename(fixturePath) === "tibb.sqlite",
  "Use a fresh isolated E2E fixture.",
);
process.env.TIBB_DATABASE_PATH = fixturePath;
const base = process.argv[3] || "http://127.0.0.1:3001";
assert.match(
  base,
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/,
  "Only a local test server is allowed.",
);
let cookie = "";
let checks = 0;
function check(value: unknown, label: string) {
  assert.ok(value, label);
  checks++;
  console.log(`PASS ${label}`);
}
async function page(path: string, withCookie = true) {
  const response = await fetch(base + path, {
    headers: withCookie && cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  return { response, html: await response.text() };
}
function actionName(html: string, field?: string) {
  const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(
    (match) => match[1],
  );
  const form = forms.find((form) => !field || form.includes(`name="${field}"`));
  const name = form?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(name, `Server action form ${field || "auth"} exists`);
  return name;
}
async function post(
  path: string,
  action: string,
  fields: Record<string, string>,
  withCookie = true,
) {
  const body = new FormData();
  body.set(action, "");
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      Origin: base,
      ...(withCookie && cookie ? { Cookie: cookie } : {}),
    },
    body,
    redirect: "manual",
  });
  const session = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("tibb_session="));
  if (session) cookie = session.split(";")[0];
  const html = await response.text();
  return { response, html, location: response.headers.get("location") || "" };
}
async function main() {
  const marker = await getDb()
    .prepare("SELECT value FROM app_meta WHERE key=?")
    .get("e2e-fixture");
  assert.equal(
    marker?.value,
    "learning",
    "This database was not created by the E2E fixture script.",
  );
  const course = (await getCourse("qa-public-course"))!;
  const draft = (await getCourse("qa-private-course"))!;
  const lessons = await getLessons(course.id);
  const draftLesson = (await getLessons(draft.id))[0];
  const coursePath = `/elevportal/kurser/${course.id}`;
  const firstLessonPath = `${coursePath}/lektioner/${lessons[0].id}`;
  const nextLessonPath = `${coursePath}/lektioner/${lessons[1].id}`;
  const courses = await page("/kurser");
  check(
    courses.response.status === 200 &&
      courses.html.includes("Introduktion till Tibb"),
    "Public course list reads database",
  );
  check(
    !courses.html.includes("QA Hemligt utkast"),
    "Draft course excluded from public list",
  );
  const publicCourse = await page("/kurser/qa-public-course");
  check(
    publicCourse.response.status === 200 &&
      publicCourse.html.includes("Reflektion och förståelse"),
    "Public course outline available",
  );
  check(
    !publicCourse.html.includes("QA_PROTECTED_LESSON_BODY"),
    "Public course omits lesson bodies",
  );
  const article = await page("/artiklar/qa-public-article");
  check(
    article.response.status === 200 &&
      article.html.includes("Artikelns första stycke"),
    "Published article available dynamically",
  );
  check(
    !article.html.includes("<script>alert('QA')</script>"),
    "Article paragraph text escaped",
  );
  const draftArticle = await page("/artiklar/qa-private-article");
  check(
    draftArticle.response.status === 404 ||
      draftArticle.html.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
    "Draft article detail protected",
  );
  const anonymous = await page(firstLessonPath, false);
  check(
    (anonymous.response.headers.get("location") || "").includes("/logga-in") ||
      anonymous.html.includes("NEXT_REDIRECT"),
    "Anonymous lesson access redirects to login",
  );
  check(
    !anonymous.html.includes("QA_PROTECTED_LESSON_BODY"),
    "Anonymous response contains no protected lesson body",
  );
  const login = await page(
    `/logga-in?returnTo=${encodeURIComponent(coursePath)}`,
  );
  const loginId = actionName(login.html);
  const failedLogin = await post(
    "/logga-in",
    loginId,
    {
      email: "qa-student@example.test",
      password: "incorrect",
      returnTo: coursePath,
    },
    false,
  );
  check(
    failedLogin.location.startsWith("/logga-in?") &&
      failedLogin.location.includes("error="),
    "Invalid login stays on login page with Swedish error",
  );
  const loginError = await page(failedLogin.location, false);
  check(
    loginError.html.includes("E-postadress eller lösenord är fel."),
    "Login error renders to user",
  );
  const signedIn = await post(
    "/logga-in",
    loginId,
    { email: "qa-student@example.test", password: "Learning-test-2026!" },
    false,
  );
  check(
    signedIn.location === "/elevportal" && cookie.startsWith("tibb_session="),
    "Student login creates session and opens portal",
  );
  const beforeEnrollment = await page(firstLessonPath);
  check(
    beforeEnrollment.response.status === 404 ||
      beforeEnrollment.html.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
    "Unenrolled signed-in student cannot read lesson",
  );
  check(
    !beforeEnrollment.html.includes("QA_PROTECTED_LESSON_BODY"),
    "Unenrolled response does not serialize lesson content",
  );
  const admin = (await getUserByEmail("qa-admin@example.test"))!;
  const student = (await getUserByEmail("qa-student@example.test"))!;
  await enrollStudent(admin.id, course.id, student.email);
  const portal = await page("/elevportal");
  check(
    portal.html.includes("Introduktion till Tibb") &&
      !portal.html.includes("QA Hemligt utkast"),
    "Assigned published course appears in student portal",
  );
  check(
    !portal.html.includes('class="site-header"'),
    "Portal uses its own navigation without duplicate public header",
  );
  const lesson = await page(firstLessonPath);
  check(
    lesson.response.status === 200 &&
      lesson.html.includes("QA_PROTECTED_LESSON_BODY_1"),
    "Enrolled student reads lesson content",
  );
  const lessonAction = actionName(lesson.html, "lessonId");
  const forged = await post(firstLessonPath, lessonAction, {
    lessonId: String(draftLesson.id),
    completed: "on",
    returnTo: "/elevportal",
  });
  check(
    forged.location.includes("error=") &&
      (await getCourseProgress(student.id, draft.id)).length === 0,
    "Progress action rechecks access for tampered lesson ID",
  );
  const complete = await post(firstLessonPath, lessonAction, {
    lessonId: String(lessons[0].id),
    completed: "on",
    returnTo: nextLessonPath,
  });
  check(
    complete.location.startsWith(nextLessonPath) &&
      (await getCourseProgress(student.id, course.id)).includes(lessons[0].id),
    "Completing lesson saves progress and continues to next lesson",
  );
  const overview = await page(coursePath);
  check(
    overview.html.includes("50%") &&
      overview.html
        .replace(/<!--[\s\S]*?-->/g, "")
        .includes("1 av 2 lektioner genomförda"),
    "Course overview shows persisted progress",
  );
  const enrollment = (await getDb()
    .prepare("SELECT id FROM enrollments WHERE user_id=? AND course_id=?")
    .get(student.id, course.id))!;
  await removeEnrollment(admin.id, Number(enrollment.id));
  const revoked = await page(firstLessonPath);
  check(
    !revoked.html.includes("QA_PROTECTED_LESSON_BODY_1") &&
      (await getCourseProgress(student.id, course.id)).includes(lessons[0].id),
    "Revoking enrollment removes access while preserving progress",
  );
  const register = await page("/registrera", false);
  const signup = await post(
    "/registrera",
    actionName(register.html),
    {
      name: "QA Ny elev",
      email: "qa-new-student@example.test",
      password: "Learning-test-2026!",
      role: "admin",
    },
    false,
  );
  check(
    signup.location.startsWith("/elevportal?success=") &&
      (await getUserByEmail("qa-new-student@example.test"))?.role === "student",
    "Registration creates student account and ignores submitted admin role",
  );
  const emptyPortal = await page(signup.location);
  check(
    emptyPortal.html.includes("Du har inte tillgång till någon kurs ännu") &&
      emptyPortal.html.includes("Ditt konto är skapat"),
    "New student sees empty portal and registration feedback",
  );
  const studentAdmin = await page("/admin");
  check(
    (studentAdmin.response.headers.get("location") || "").startsWith(
      "/elevportal",
    ) || studentAdmin.html.includes("NEXT_REDIRECT"),
    "Student is denied admin routes",
  );
  console.log(`${checks} learning integration checks passed.`);
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getDb().close();
  });
