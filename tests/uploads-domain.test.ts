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
  getCourses,
  getDb,
  getLessons,
  getPractitioners,
  type User,
} from "../src/lib/db";
import {
  deleteCourse,
  deleteLesson,
  saveCourse,
  saveLesson,
  savePractitioner,
} from "../src/lib/admin";
import { hashPassword } from "../src/lib/security";

// These tests only associate metadata in a fresh local SQLite fixture. They do
// not send files to Blob or inherit a deployed database connection.
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
delete process.env.BLOB_READ_WRITE_TOKEN;
const directory = mkdtempSync(join(tmpdir(), "tibb-upload-domain-tests-"));
process.env.TIBB_DATABASE_PATH = join(directory, "tibb.sqlite");
let admin: User;
let student: User;
let courseNumber = 0;
let assetNumber = 0;

before(async () => {
  admin = await createFirstAdmin({
    name: "Upload Domain Admin",
    email: "upload-domain-admin@example.test",
    passwordHash: hashPassword("upload domain admin test password"),
  });
  student = await createUser({
    name: "Upload Domain Student",
    email: "upload-domain-student@example.test",
    passwordHash: hashPassword("upload domain student test password"),
    role: "student",
  });
});

after(async () => {
  await getDb().close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("tibb-upload-domain-tests-"));
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

async function course() {
  const slug = `upload-domain-course-${++courseNumber}`;
  await saveCourse(admin.id, {
    title: `Upload domain course ${courseNumber}`,
    slug,
    description: "Isolated upload association test",
    price: "0",
    published: false,
  });
  return (await getCourses()).find((value) => value.slug === slug)!;
}

async function upload(
  kind: "practitioner-photo" | "lesson-material",
  courseId: number | null = null,
  extension: "pdf" | "doc" | "docx" | "png" = kind === "practitioner-photo"
    ? "png"
    : "pdf",
  pending = false,
) {
  const id = randomUUID();
  const name = `Upload domain asset ${++assetNumber}.${extension}`;
  const contentType = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png: "image/png",
  }[extension];
  const size = 2048 + assetNumber;
  const table = pending ? "upload_requests" : "uploads";
  await getDb()
    .prepare(
      `INSERT INTO ${table}(id,kind,filename,content_type,size,storage_path,storage_provider,uploader_id,course_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      kind,
      name,
      contentType,
      size,
      `test-assets/${id}.${extension}`,
      "local",
      admin.id,
      courseId,
      new Date().toISOString(),
    );
  return { id, name, contentType, size, url: `/api/uploads/${id}` };
}

function lessonInput(courseId: number) {
  return {
    courseId,
    title: "Upload domain lesson",
    body: "Lesson body",
    videoUrl: "",
    materialUrl: "",
    position: 1,
  };
}

test("practitioner photo metadata can be attached, preserved on ordinary edits and explicitly removed", async () => {
  const photo = await upload("practitioner-photo");
  const id = await savePractitioner(admin.id, {
    name: "Portrait practitioner",
    description: "Initial profile",
    active: true,
    photoUploadId: photo.id,
  });
  let profile = (await getPractitioners()).find((value) => value.id === id)!;
  assert.deepEqual(profile.photo, photo);
  assert.equal(profile.photoUrl, photo.url);
  await savePractitioner(admin.id, {
    id,
    name: "Renamed portrait practitioner",
    description: "Edited profile",
    active: true,
  });
  profile = (await getPractitioners()).find((value) => value.id === id)!;
  assert.equal(profile.photo?.id, photo.id);
  assert.equal(profile.photoUrl, photo.url);
  await savePractitioner(admin.id, {
    id,
    name: profile.name,
    description: profile.description,
    active: true,
    photoUploadId: null,
  });
  profile = (await getPractitioners()).find((value) => value.id === id)!;
  assert.equal(profile.photo, null);
  assert.ok(!profile.photoUrl);
});

test("invalid, pending or wrong-kind portrait IDs cannot change a practitioner and students cannot assign photos", async () => {
  const ownerCourse = await course();
  const valid = await upload("practitioner-photo");
  const wrongKind = await upload("lesson-material", ownerCourse.id);
  const pending = await upload("practitioner-photo", null, "png", true);
  const id = await savePractitioner(admin.id, {
    name: "Protected portrait profile",
    description: "Original",
    active: true,
    photoUploadId: valid.id,
  });
  for (const photoUploadId of [
    wrongKind.id,
    randomUUID(),
    "bad-upload-id",
    pending.id,
  ]) {
    await assert.rejects(
      savePractitioner(admin.id, {
        id,
        name: "Must not persist",
        description: "Must not persist",
        active: false,
        photoUploadId,
      }),
    );
    const saved = (await getPractitioners()).find((value) => value.id === id)!;
    assert.equal(saved.name, "Protected portrait profile");
    assert.equal(saved.active, true);
    assert.equal(saved.photo?.id, valid.id);
  }
  await assert.rejects(
    savePractitioner(student.id, {
      id,
      name: "Forbidden edit",
      description: "",
      active: true,
      photoUploadId: valid.id,
    }),
    /behörighet/,
  );
});

test("a lesson can consist only of uploaded PDF and Word files with safe complete download metadata", async () => {
  const ownerCourse = await course();
  const files = [
    await upload("lesson-material", ownerCourse.id, "pdf"),
    await upload("lesson-material", ownerCourse.id, "doc"),
    await upload("lesson-material", ownerCourse.id, "docx"),
  ];
  await saveLesson(admin.id, {
    ...lessonInput(ownerCourse.id),
    body: "",
    materialUploadIds: files.map((file) => file.id),
  });
  const saved = (await getLessons(ownerCourse.id))[0];
  assert.equal(saved.body, "");
  assert.equal(saved.videoUrl, "");
  assert.equal(saved.materialUrl, "");
  assert.deepEqual(
    saved.materials.toSorted((first, second) =>
      first.id.localeCompare(second.id),
    ),
    files.toSorted((first, second) => first.id.localeCompare(second.id)),
  );
  assert.ok(
    saved.materials.every((file) => file.url === `/api/uploads/${file.id}`),
  );
  assert.equal("storagePath" in saved.materials[0], false);
  assert.equal("storageProvider" in saved.materials[0], false);
});

test("editing a lesson preserves omitted files, supports replacing its files and clears them only when explicitly requested", async () => {
  const ownerCourse = await course();
  const first = await upload("lesson-material", ownerCourse.id);
  const replacement = await upload("lesson-material", ownerCourse.id, "docx");
  const input = lessonInput(ownerCourse.id);
  await saveLesson(admin.id, { ...input, materialUploadIds: [first.id] });
  const id = (await getLessons(ownerCourse.id))[0].id;
  await saveLesson(admin.id, { ...input, id, title: "Ordinary lesson edit" });
  assert.deepEqual(
    (await getLessons(ownerCourse.id))[0].materials.map((file) => file.id),
    [first.id],
  );
  await saveLesson(admin.id, {
    ...input,
    id,
    materialUploadIds: [replacement.id],
  });
  assert.deepEqual(
    (await getLessons(ownerCourse.id))[0].materials.map((file) => file.id),
    [replacement.id],
  );
  await saveLesson(admin.id, { ...input, id, materialUploadIds: [] });
  assert.deepEqual((await getLessons(ownerCourse.id))[0].materials, []);
  await saveLesson(admin.id, {
    ...input,
    id,
    body: "",
    materialUploadIds: [first.id],
  });
  await assert.rejects(
    saveLesson(admin.id, { ...input, id, body: "", materialUploadIds: [] }),
  );
  assert.deepEqual(
    (await getLessons(ownerCourse.id))[0].materials.map((file) => file.id),
    [first.id],
  );
});

test("lesson file assignments reject wrong-course, wrong-kind, unknown and pending uploads without partial edits", async () => {
  const ownerCourse = await course();
  const otherCourse = await course();
  const valid = await upload("lesson-material", ownerCourse.id);
  const foreign = await upload("lesson-material", otherCourse.id);
  const portrait = await upload("practitioner-photo");
  const pending = await upload("lesson-material", ownerCourse.id, "pdf", true);
  const input = lessonInput(ownerCourse.id);
  await saveLesson(admin.id, { ...input, materialUploadIds: [valid.id] });
  const id = (await getLessons(ownerCourse.id))[0].id;
  for (const invalidId of [
    foreign.id,
    portrait.id,
    randomUUID(),
    "bad-upload-id",
    pending.id,
  ]) {
    await assert.rejects(
      saveLesson(admin.id, {
        ...input,
        id,
        title: "Must not persist",
        body: "Must not persist",
        materialUploadIds: [valid.id, invalidId],
      }),
    );
    const saved = (await getLessons(ownerCourse.id))[0];
    assert.equal(saved.title, input.title);
    assert.equal(saved.body, input.body);
    assert.deepEqual(
      saved.materials.map((file) => file.id),
      [valid.id],
    );
  }
  await assert.rejects(
    saveLesson(admin.id, {
      ...lessonInput(otherCourse.id),
      id,
      materialUploadIds: [foreign.id],
    }),
  );
  assert.equal((await getLessons(otherCourse.id)).length, 0);
  await assert.rejects(
    saveLesson(student.id, { ...input, id, materialUploadIds: [valid.id] }),
    /behörighet/,
  );
  assert.deepEqual(
    (await getLessons(ownerCourse.id))[0].materials.map((file) => file.id),
    [valid.id],
  );
});

test("the twenty-file limit rejects oversized assignments atomically and accepts twenty material-only files", async () => {
  const ownerCourse = await course();
  const files = [];
  for (let index = 0; index < 21; index++)
    files.push(await upload("lesson-material", ownerCourse.id));
  const input = { ...lessonInput(ownerCourse.id), body: "" };
  await assert.rejects(
    saveLesson(admin.id, {
      ...input,
      materialUploadIds: files.map((file) => file.id),
    }),
  );
  assert.equal((await getLessons(ownerCourse.id)).length, 0);
  await saveLesson(admin.id, {
    ...input,
    materialUploadIds: files.slice(0, 20).map((file) => file.id),
  });
  assert.equal((await getLessons(ownerCourse.id))[0].materials.length, 20);
});

test("lesson deletion preserves shared upload metadata while course deletion removes its file associations even with foreign keys off", async () => {
  const ownerCourse = await course();
  const file = await upload("lesson-material", ownerCourse.id);
  const unrelated = await upload("practitioner-photo");
  const input = {
    ...lessonInput(ownerCourse.id),
    materialUploadIds: [file.id],
  };
  await saveLesson(admin.id, input);
  await saveLesson(admin.id, {
    ...input,
    title: "Second lesson sharing the file",
    position: 2,
  });
  const lessons = await getLessons(ownerCourse.id);
  await getDb().exec("PRAGMA foreign_keys=OFF");
  try {
    await deleteLesson(admin.id, lessons[0].id, ownerCourse.id);
    assert.ok(
      await getDb().prepare("SELECT id FROM uploads WHERE id=?").get(file.id),
    );
    assert.deepEqual(
      (await getLessons(ownerCourse.id))[0].materials.map((item) => item.id),
      [file.id],
    );
    await deleteCourse(admin.id, ownerCourse.id);
    assert.equal((await getLessons(ownerCourse.id)).length, 0);
    assert.equal(
      await getDb().prepare("SELECT id FROM uploads WHERE id=?").get(file.id),
      undefined,
    );
    assert.ok(
      await getDb()
        .prepare("SELECT id FROM uploads WHERE id=?")
        .get(unrelated.id),
    );
  } finally {
    await getDb().exec("PRAGMA foreign_keys=ON");
  }
});
