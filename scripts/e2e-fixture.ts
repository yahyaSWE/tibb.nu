import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFirstAdmin, createUser, getCourse, getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;

// Every invocation owns a fresh local database. Existing site data is never reset.
const directory = mkdtempSync(join(tmpdir(), "tibb-e2e-"));
process.env.TIBB_DATABASE_PATH = join(directory, "tibb.sqlite");

async function main() {
  const db = getDb();
  try {
    await createFirstAdmin({
      name: "QA Administratör",
      email: "qa-admin@example.test",
      passwordHash: hashPassword("Learning-test-2026!"),
    });
    await createUser({
      name: "QA Elev",
      email: "qa-student@example.test",
      passwordHash: hashPassword("Learning-test-2026!"),
      role: "student",
    });
    const now = new Date().toISOString();
    // This owns a fresh isolated QA database, never a live account.
    await db.prepare("UPDATE users SET email_verified_at=? WHERE role='student'").run(now);
    await db
      .prepare(
        "INSERT INTO courses(title,slug,description,price_ore,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "Introduktion till Tibb",
        "qa-public-course",
        "En introduktion till kursens sammanhang.\n\nFörståelse, reflektion och kunskap.",
        149500,
        1,
        now,
        now,
      );
    await db
      .prepare(
        "INSERT INTO courses(title,slug,description,price_ore,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "QA Hemligt utkast",
        "qa-private-course",
        "Utkastbeskrivning",
        50000,
        0,
        now,
        now,
      );
    const course = (await getCourse("qa-public-course"))!;
    const draftCourse = (await getCourse("qa-private-course"))!;
    await db
      .prepare(
        "INSERT INTO lessons(course_id,title,body,video_url,material_url,position) VALUES(?,?,?,?,?,?)",
      )
      .run(
        course.id,
        "Introduktion",
        "QA_PROTECTED_LESSON_BODY_1.\n\nHär börjar din fördjupning.",
        "",
        "https://example.com/material.pdf",
        1,
      );
    await db
      .prepare(
        "INSERT INTO lessons(course_id,title,body,video_url,material_url,position) VALUES(?,?,?,?,?,?)",
      )
      .run(
        course.id,
        "Reflektion och förståelse",
        "QA_PROTECTED_LESSON_BODY_2",
        "",
        "",
        2,
      );
    await db
      .prepare(
        "INSERT INTO lessons(course_id,title,body,video_url,material_url,position) VALUES(?,?,?,?,?,?)",
      )
      .run(
        draftCourse.id,
        "Hemlig lektion",
        "QA_PRIVATE_LESSON_BODY",
        "",
        "",
        1,
      );
    await db
      .prepare(
        "INSERT INTO articles(title,slug,excerpt,body,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "Kunskap med rötter",
        "qa-public-article",
        "En reflektion om kunskap, vardag och förståelse.",
        "Artikelns första stycke.\n\n<script>alert('QA')</script> ska visas som text.",
        1,
        now,
        now,
      );
    await db
      .prepare(
        "INSERT INTO articles(title,slug,excerpt,body,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        "QA Hemlig artikel",
        "qa-private-article",
        "",
        "PRIVATE ARTICLE",
        0,
        now,
        now,
      );
    await db
      .prepare("INSERT INTO app_meta(key,value) VALUES(?,?)")
      .run("e2e-fixture", "learning");
    console.log(
      `Local E2E fixture database: ${process.env.TIBB_DATABASE_PATH}`,
    );
    console.log(
      "Start a separate server with this TIBB_DATABASE_PATH, NEXT_DIST_DIR=.next-qa, no TURSO_DATABASE_URL/TURSO_AUTH_TOKEN/VERCEL, and --port 3001.",
    );
    console.log(
      `Then run: npm exec -- tsx scripts/e2e-learning.ts "${process.env.TIBB_DATABASE_PATH}"`,
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
