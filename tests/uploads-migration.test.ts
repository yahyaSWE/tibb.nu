import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client/node";
import { getDb, getLesson, getPractitioner, getUpload } from "../src/lib/db";
import { saveLesson, savePractitioner } from "../src/lib/admin";

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;

// The previous published table definitions, kept independent of the new schema.
const LEGACY_UPLOAD_SCHEMA = `
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE practitioners (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', price_ore INTEGER NOT NULL DEFAULT 0, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE lessons (id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '', material_url TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 1);
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO app_meta(key,value) VALUES('seeded','1');
INSERT INTO users VALUES(17,'upload-migration@example.test','Migration Admin','isolated-test-hash','admin','2025-01-01T00:00:00.000Z');
INSERT INTO practitioners VALUES(1,'Existing default name','Original description',0);
INSERT INTO practitioners VALUES(3,'Existing practitioner','Original active description',1);
INSERT INTO courses VALUES(29,'Existing course','existing-course','Original course',12300,1,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z');
INSERT INTO lessons VALUES(41,29,'Existing linked material','','','https://example.test/existing.pdf',1);
`;

test("file upload migration preserves practitioner details and legacy material links while new attachments work after reopening", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tibb-upload-migration-"));
  process.env.TIBB_DATABASE_PATH = join(directory, "legacy.sqlite");
  const raw = createClient({
    url: pathToFileURL(process.env.TIBB_DATABASE_PATH).href,
    intMode: "number",
  });
  try {
    await raw.executeMultiple(LEGACY_UPLOAD_SCHEMA);
    const practitionersBefore = (
      await raw.execute("SELECT * FROM practitioners ORDER BY id")
    ).rows;
    const lessonsBefore = (
      await raw.execute("SELECT * FROM lessons ORDER BY id")
    ).rows;
    const coursesBefore = (
      await raw.execute("SELECT * FROM courses ORDER BY id")
    ).rows;
    raw.close();
    const db = getDb();
    await Promise.all([db.initialize(), db.initialize()]);
    assert.deepEqual(
      await db.prepare("SELECT * FROM practitioners ORDER BY id").all(),
      practitionersBefore.map((row) => ({ ...row, photo_upload_id: null })),
    );
    assert.deepEqual(
      await db.prepare("SELECT * FROM lessons ORDER BY id").all(),
      lessonsBefore,
    );
    assert.deepEqual(
      await db.prepare("SELECT * FROM courses ORDER BY id").all(),
      coursesBefore,
    );
    assert.equal((await getPractitioner(1))?.active, false);
    assert.equal((await getPractitioner(1))?.name, "Existing default name");
    assert.equal((await getPractitioner(3))?.photo, null);
    assert.equal((await getPractitioner(3))?.photoUrl, null);
    assert.equal(
      (await getLesson(41))?.materialUrl,
      "https://example.test/existing.pdf",
    );
    assert.deepEqual((await getLesson(41))?.materials, []);

    const photoId = randomUUID();
    const materialId = randomUUID();
    for (const [id, kind, filename, contentType, courseId] of [
      [photoId, "practitioner-photo", "portrait.png", "image/png", null],
      [materialId, "lesson-material", "new.pdf", "application/pdf", 29],
    ] as const) {
      await db
        .prepare(
          "INSERT INTO uploads(id,kind,filename,content_type,size,storage_path,storage_provider,uploader_id,course_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          kind,
          filename,
          contentType,
          100,
          `private/${id}`,
          "local",
          17,
          courseId,
          new Date().toISOString(),
        );
    }
    await savePractitioner(17, {
      id: 3,
      name: "Existing practitioner",
      description: "Original active description",
      active: true,
      photoUploadId: photoId,
    });
    await saveLesson(17, {
      id: 41,
      courseId: 29,
      title: "Existing linked material",
      body: "",
      videoUrl: "",
      materialUrl: "https://example.test/existing.pdf",
      position: 1,
      materialUploadIds: [materialId],
    });
    await db.close();
    await db.initialize();
    assert.equal(
      (await getPractitioner(3))?.photoUrl,
      `/api/uploads/${photoId}`,
    );
    assert.equal(
      (await getLesson(41))?.materialUrl,
      "https://example.test/existing.pdf",
    );
    assert.deepEqual(
      (await getLesson(41))?.materials.map((file) => file.id),
      [materialId],
    );
    assert.equal((await getUpload(materialId))?.courseId, 29);
    assert.equal(
      (await db.prepare("PRAGMA table_info(practitioners)").all()).filter(
        (column) => column.name === "photo_upload_id",
      ).length,
      1,
    );
    assert.equal(
      (await db.prepare("PRAGMA table_info(upload_requests)").all()).filter(
        (column) => column.name === "completing",
      ).length,
      1,
    );
    // Additive cleanup guards must coexist with previous lesson/course triggers.
    await db.exec("PRAGMA foreign_keys=OFF");
    await db.prepare("DELETE FROM uploads WHERE id=?").run(photoId);
    assert.equal((await getPractitioner(3))?.photo, null);
    await db.prepare("DELETE FROM courses WHERE id=29").run();
    assert.equal(await getUpload(materialId), undefined);
    assert.equal(
      (await db.prepare("SELECT * FROM lesson_materials").all()).length,
      0,
    );
  } finally {
    raw.close();
    await getDb().close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("tibb-upload-migration-"));
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
});
