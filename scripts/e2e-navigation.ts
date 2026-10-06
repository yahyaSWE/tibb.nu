import assert from "node:assert/strict";
import { realpathSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

const fixturePath = realpathSync(resolve(process.argv[2] || ""));
assert.equal(dirname(dirname(fixturePath)), realpathSync(tmpdir()));
assert.ok(basename(dirname(fixturePath)).startsWith("tibb-e2e-"));
assert.equal(basename(fixturePath), "tibb.sqlite");
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
process.env.TIBB_DATABASE_PATH = fixturePath;
const base = process.argv[3] || "http://127.0.0.1:3001";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);

type Mode = "html" | "rsc" | "prefetch";
type Result = { response: Response; body: string; location: string };
const samples: { route: string; mode: Mode; milliseconds: number }[] = [];
const checks: string[] = [];
const stamp = Date.now();
const privateMarker = `NAV_PRIVATE_ARTICLE_${stamp}`;
const beforeName = `NAV_BEFORE_${stamp}`;
const afterName = `NAV_AFTER_${stamp}`;
const forgedName = `NAV_FORGED_${stamp}`;
let cookie = "";
const retainedAdminTree = encodeURIComponent(
  JSON.stringify([
    "",
    {
      children: [
        "admin",
        { children: ["bokningar", { children: ["__PAGE__", {}] }] },
      ],
    },
  ]),
);

function check(value: unknown, label: string) {
  assert.ok(value, label);
  checks.push(label);
  console.log(`PASS ${label}`);
}

async function page(
  route: string,
  mode: Mode = "html",
  session = cookie,
): Promise<Result> {
  const start = performance.now();
  const headers: Record<string, string> = session ? { Cookie: session } : {};
  if (mode !== "html") {
    headers.RSC = "1";
    headers["Next-Router-State-Tree"] = retainedAdminTree;
    headers["Next-Url"] = "/admin/bokningar";
  }
  if (mode === "prefetch") headers["Next-Router-Prefetch"] = "1";
  let response = await fetch(base + route, {
    headers,
    redirect: "manual",
    cache: "no-store",
  });
  // Next 16 canonicalizes RSC requests with a hash query before rendering.
  const transportRedirect = response.headers.get("location");
  if (mode !== "html" && response.status === 307 && transportRedirect) {
    const canonical = new URL(transportRedirect, base);
    if (
      canonical.origin === base &&
      canonical.pathname === route &&
      canonical.searchParams.has("_rsc")
    ) {
      await response.arrayBuffer();
      response = await fetch(canonical, {
        headers,
        redirect: "manual",
        cache: "no-store",
      });
    }
  }
  const body = await response.text();
  samples.push({
    route,
    mode,
    milliseconds: Math.round((performance.now() - start) * 10) / 10,
  });
  assert.ok(
    response.status < 500,
    `${mode} ${route} does not return an application error`,
  );
  return { response, body, location: response.headers.get("location") || "" };
}

function actionName(html: string, field?: string) {
  const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(
    (match) => match[1],
  );
  const form = forms.find((form) => !field || form.includes(`name="${field}"`));
  const action = form?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(action, `Real server action form exists (${field || "logout"})`);
  return action;
}

async function post(
  route: string,
  action: string,
  fields: Record<string, string> = {},
  session = cookie,
): Promise<Result> {
  const body = new FormData();
  body.set(action, "");
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  const response = await fetch(base + route, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { Origin: base, ...(session ? { Cookie: session } : {}) },
  });
  const setCookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("tibb_session="));
  if (setCookie)
    cookie =
      setCookie.split(";")[0] === "tibb_session="
        ? ""
        : setCookie.split(";")[0];
  return {
    response,
    body: await response.text(),
    location: response.headers.get("location") || "",
  };
}

function redirects(result: Result, destination: string) {
  return (
    result.location.startsWith(destination) ||
    (result.body.includes("NEXT_REDIRECT") && result.body.includes(destination))
  );
}

function portalTarget(html: string) {
  const tag = html.match(
    /<a\b[^>]*class="[^"]*\bportal-link\b[^"]*"[^>]*>/,
  )?.[0];
  return tag?.match(/href="([^"]+)"/)?.[1];
}

async function login(email: string) {
  const form = await page("/logga-in", "html", "");
  const result = await post(
    "/logga-in",
    actionName(form.body, "password"),
    {
      email,
      password: "Learning-test-2026!",
    },
    "",
  );
  assert.ok(cookie.startsWith("tibb_session="), "Login sets a session cookie");
  return result;
}

async function main() {
  const { getDb, getCourse, getLessons, getTreatments, getArticleById } =
    await import("../src/lib/db");
  const db = getDb();
  try {
    const marker = await db
      .prepare("SELECT value FROM app_meta WHERE key=?")
      .get("e2e-fixture");
    assert.equal(
      marker?.value,
      "learning",
      "Only the fresh learning fixture is allowed",
    );
    check(
      portalTarget((await page("/om", "html", "")).body) === "/logga-in",
      "Anonymous public chrome links to login",
    );
    const adminLogin = await login("qa-admin@example.test");
    check(
      redirects(adminLogin, "/admin"),
      "Real admin login redirects to admin",
    );
    const adminCookie = cookie;
    check(
      portalTarget((await page("/om")).body) === "/admin",
      "Login cookie immediately refreshes public chrome to admin",
    );

    const treatments = await page("/admin/behandlingar");
    const createTreatmentAction = actionName(
      treatments.body,
      "durationMinutes",
    );
    const created = await post("/admin/behandlingar", createTreatmentAction, {
      name: beforeName,
      description: "Production navigation QA treatment",
      durationMinutes: "45",
      price: "812",
      active: "on",
      returnTo: "/admin/behandlingar",
    });
    check(
      created.location.includes("success="),
      "Real admin action creates a treatment",
    );
    const treatment = (await getTreatments()).find(
      (item) => item.name === beforeName,
    );
    assert.ok(treatment, "The HTTP server wrote the expected isolated fixture");
    check(
      (await page("/boka")).body.includes(beforeName),
      "Created treatment appears on booking page",
    );
    const edit = await page(`/admin/behandlingar/${treatment.id}`);
    const updated = await post(
      `/admin/behandlingar/${treatment.id}`,
      actionName(edit.body, "durationMinutes"),
      {
        id: String(treatment.id),
        name: afterName,
        description: "Updated production navigation QA treatment",
        durationMinutes: "45",
        price: "937",
        active: "on",
        returnTo: `/admin/behandlingar/${treatment.id}`,
      },
    );
    check(
      updated.location.includes("success="),
      "Real admin action updates treatment",
    );
    const [adminAfter, publicAfter] = await Promise.all([
      page("/admin/behandlingar", "rsc"),
      page("/boka", "rsc"),
    ]);
    check(
      adminAfter.body.includes(afterName) &&
        !adminAfter.body.includes(beforeName),
      "RSC admin navigation displays fresh treatment name",
    );
    check(
      publicAfter.body.includes(afterName) &&
        !publicAfter.body.includes(beforeName) &&
        publicAfter.body.includes("93700"),
      "RSC booking navigation displays fresh name and price",
    );

    const newArticle = await page("/admin/artiklar/ny");
    const createArticleAction = actionName(newArticle.body, "body");
    const createdArticle = await post(
      "/admin/artiklar/ny",
      createArticleAction,
      {
        title: privateMarker,
        slug: `nav-private-${stamp}`,
        excerpt: "Private QA canary",
        body: `${privateMarker}_BODY`,
        returnTo: "/admin/artiklar",
      },
    );
    check(
      createdArticle.location.includes("success="),
      "Admin creates unpublished private canary through server action",
    );
    const articleRow = await db
      .prepare("SELECT id FROM articles WHERE slug=?")
      .get(`nav-private-${stamp}`);
    assert.ok(articleRow);
    const privateCourse = (await getCourse("qa-private-course"))!;
    const privateLesson = (await getLessons(privateCourse.id))[0];
    const routes = [
      "/admin",
      "/admin/bokningar",
      "/admin/behandlingar",
      "/admin/behandlare",
      "/admin/tider",
      "/admin/artiklar",
      "/admin/artiklar/ny",
      "/admin/kurser",
      "/admin/kurser/ny",
      "/admin/elever",
      "/admin/installningar",
      `/admin/behandlingar/${treatment.id}`,
      `/admin/artiklar/${articleRow.id}`,
      `/admin/kurser/${privateCourse.id}`,
      "/admin/bokningar/2147480000",
    ];
    const forbidden = [
      privateMarker,
      "QA_PRIVATE_LESSON_BODY",
      "QA Hemligt utkast",
      "QA Hemlig artikel",
      "QA Administratör",
      "qa-admin@example.test",
    ];
    const positive = await page(
      `/admin/artiklar/${articleRow.id}`,
      "rsc",
      adminCookie,
    );
    check(
      positive.response.headers
        .get("content-type")
        ?.includes("text/x-component") && positive.body.includes(privateMarker),
      "Authenticated RSC positive control includes protected article canary",
    );
    for (const role of ["anonymous", "student"] as const) {
      if (role === "student") {
        const signedIn = await login("qa-student@example.test");
        check(
          redirects(signedIn, "/elevportal"),
          "Real student login redirects to portal",
        );
        check(
          portalTarget((await page("/om")).body) === "/elevportal",
          "Replacing admin cookie immediately changes public chrome to student",
        );
      }
      const session = role === "student" ? cookie : "";
      for (const route of routes) {
        const results = await Promise.all(
          (["html", "rsc", "prefetch"] as const).map((mode) =>
            page(route, mode, session),
          ),
        );
        for (let index = 0; index < results.length; index++) {
          const result = results[index];
          assert.ok(
            forbidden.every((canary) => !result.body.includes(canary)),
            `${role} ${route} response omits private canaries (${index})`,
          );
          // A request whose router tree already matches this exact route may
          // return an empty diff; it must still never include private content.
          if (index === 0 || (index === 1 && route !== "/admin/bokningar"))
            assert.ok(
              redirects(
                result,
                role === "student" ? "/elevportal" : "/logga-in",
              ),
              `${role} actual page/RSC navigation redirects (${route})`,
            );
        }
        check(
          true,
          `${role} denied for HTML, retained-layout RSC and partial prefetch: ${route}`,
        );
      }
      const lessonPath = `/elevportal/kurser/${privateCourse.id}/lektioner/${privateLesson.id}`;
      const lesson = await page(lessonPath, "rsc", session);
      check(
        !lesson.body.includes("QA_PRIVATE_LESSON_BODY") &&
          (role === "student"
            ? lesson.body.includes("NEXT_HTTP_ERROR_FALLBACK;404")
            : redirects(lesson, "/logga-in")),
        `${role} cannot obtain draft lesson content in RSC`,
      );
    }
    const studentCookie = cookie;
    const forged = await post(
      "/admin/behandlingar",
      createTreatmentAction,
      {
        name: forgedName,
        description: "Forbidden",
        durationMinutes: "45",
        price: "1",
        active: "on",
        returnTo: "/admin/behandlingar",
      },
      studentCookie,
    );
    check(
      redirects(forged, "/elevportal") &&
        !(await getTreatments()).some((item) => item.name === forgedName),
      "Student cannot execute a known admin action ID",
    );
    cookie = adminCookie;
    const adminPage = await page("/admin");
    const logout = await post(
      "/admin",
      actionName(adminPage.body),
      {},
      adminCookie,
    );
    check(
      redirects(logout, "/") && cookie === "",
      "Logout clears session cookie and redirects home",
    );
    check(
      portalTarget((await page("/om")).body) === "/logga-in",
      "Logout immediately removes authenticated public navigation",
    );
    const revokedSession = await page(
      `/admin/artiklar/${articleRow.id}`,
      "rsc",
      adminCookie,
    );
    check(
      redirects(revokedSession, "/logga-in") &&
        !revokedSession.body.includes(privateMarker),
      "Retained old admin cookie and layout cannot bypass server session revocation",
    );
    const allWarmup = [];
    for (const route of ["/om", "/boka", "/kurser", "/artiklar"]) {
      await page(route, "prefetch", "");
      allWarmup.push(await page(route, "rsc", ""));
    }
    check(
      allWarmup.every((result) =>
        result.response.headers
          .get("content-type")
          ?.includes("text/x-component"),
      ),
      "Production public routes respond to RSC navigation after partial prefetch",
    );
    mkdirSync(resolve(".test-data/performance"), { recursive: true });
    writeFileSync(
      resolve(".test-data/performance/navigation-report.json"),
      JSON.stringify({ checks, samples }, null, 2),
    );
    console.log(
      `${checks.length} production HTTP navigation/auth checks passed. Timings saved without cookies or response bodies.`,
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unknown verification error",
  );
  process.exitCode = 1;
});
