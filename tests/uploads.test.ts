import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import sharp from "sharp";
import {
  createFirstAdmin,
  createUser,
  getCourses,
  getDb,
  getEnrollments,
  getLessons,
  getUpload,
  type User,
  type UploadRecord,
} from "../src/lib/db";
import {
  archivePractitioner,
  enrollStudent,
  removeEnrollment,
  saveCourse,
  saveLesson,
  savePractitioner,
} from "../src/lib/admin";
import { hashPassword } from "../src/lib/security";
import {
  completeUpload,
  getPendingUpload,
  getReadableUpload,
  openUpload,
  prepareUpload,
  readLimitedStream,
  UploadError,
} from "../src/lib/uploads";
import { UPLOAD_LIMITS } from "../src/lib/upload-rules";

// Each Node test-runner process uses an independent database and file directory.
// Never inherit remote storage credentials or a deployment's database.
for (const name of [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "VERCEL",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_STORE_ID",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "VERCEL_OIDC_TOKEN",
])
  delete process.env[name];
const directory = mkdtempSync(join(tmpdir(), "tibb-upload-storage-tests-"));
process.env.TIBB_DATABASE_PATH = join(directory, "tibb.sqlite");
process.env.TIBB_UPLOAD_DIR = join(directory, "uploads");
let admin: User, secondAdmin: User, student: User, stranger: User;
let courseNumber = 0;
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
);

before(async () => {
  admin = await createFirstAdmin({
    name: "Storage Admin",
    email: "storage-admin@example.test",
    passwordHash: hashPassword("isolated upload storage password"),
  });
  secondAdmin = await createUser({
    name: "Second Storage Admin",
    email: "storage-admin-two@example.test",
    passwordHash: hashPassword("isolated second admin password"),
    role: "admin",
  });
  student = await createUser({
    name: "Storage Student",
    email: "storage-student@example.test",
    passwordHash: hashPassword("isolated upload student password"),
    role: "student",
  });
  stranger = await createUser({
    name: "Unenrolled Student",
    email: "storage-stranger@example.test",
    passwordHash: hashPassword("isolated unenrolled password"),
    role: "student",
  });
});
after(async () => {
  await getDb().close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("tibb-upload-storage-tests-"));
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

async function course() {
  const slug = `storage-course-${++courseNumber}`;
  await saveCourse(admin.id, {
    title: `Storage course ${courseNumber}`,
    slug,
    description: "Isolated local upload fixture",
    price: "0",
    published: false,
  });
  return (await getCourses()).find((item) => item.slug === slug)!;
}
async function portraitBytes(width = 900, height = 700) {
  return await sharp({
    create: { width, height, channels: 3, background: "#7c8758" },
  })
    .withMetadata()
    .png()
    .toBuffer();
}
async function uploadedPhoto() {
  const bytes = await portraitBytes();
  const pending = await prepareUpload(admin.id, {
    kind: "practitioner-photo",
    filename: "Porträtt.png",
    size: bytes.length,
  });
  return await completeUpload(admin.id, pending.id, bytes);
}

test("prepare requires an administrator and rejects unsafe paths, unsupported types, invalid sizes and missing courses atomically", async () => {
  const baseline = Number(
    (await getDb().prepare("SELECT COUNT(*) total FROM upload_requests").get())!
      .total,
  );
  await assert.rejects(
    prepareUpload(student.id, {
      kind: "practitioner-photo",
      filename: "safe.png",
      size: 100,
    }),
    /behörighet/,
  );
  for (const filename of [
    "../portrait.png",
    "nested/portrait.png",
    "nested\\portrait.png",
    "bad\u0000.png",
    "bad\n.png",
    "",
    "x".repeat(201) + ".png",
    "portrait.svg",
  ])
    await assert.rejects(
      prepareUpload(admin.id, {
        kind: "practitioner-photo",
        filename,
        size: 100,
      }),
      UploadError,
    );
  for (const size of [0, -1, 1.5, NaN, UPLOAD_LIMITS["practitioner-photo"] + 1])
    await assert.rejects(
      prepareUpload(admin.id, {
        kind: "practitioner-photo",
        filename: "safe.png",
        size,
      }),
      UploadError,
    );
  await assert.rejects(
    prepareUpload(admin.id, {
      kind: "lesson-material",
      filename: "safe.pdf",
      size: pdf.length,
      courseId: 987654,
    }),
    /Kursen/,
  );
  const owner = await course();
  await assert.rejects(
    prepareUpload(admin.id, {
      kind: "lesson-material",
      filename: "safe.pdf",
      size: UPLOAD_LIMITS["lesson-material"] + 1,
      courseId: owner.id,
    }),
    /20 MB/,
  );
  assert.equal(
    Number(
      (await getDb()
        .prepare("SELECT COUNT(*) total FROM upload_requests")
        .get())!.total,
    ),
    baseline,
  );
});

test("a Vercel process without persistent services refuses local storage", async () => {
  process.env.VERCEL = "1";
  try {
    await assert.rejects(
      prepareUpload(admin.id, {
        kind: "practitioner-photo",
        filename: "safe.png",
        size: 100,
      }),
      (error: unknown) =>
        error instanceof Error &&
        /Databasen är inte konfigurerad|Fillagring saknas/.test(error.message),
    );
  } finally {
    delete process.env.VERCEL;
  }
});

test("a local PDF is persisted, converted from pending metadata, readable after reopening, and finalized idempotently", async () => {
  const owner = await course();
  const pending = await prepareUpload(admin.id, {
    kind: "lesson-material",
    filename: "Vägledning.PDF",
    size: pdf.length,
    courseId: owner.id,
  });
  assert.equal(pending.provider, "local");
  assert.equal(await getUpload(pending.id), undefined);
  const asset = await completeUpload(admin.id, pending.id, pdf);
  assert.deepEqual(asset, {
    id: pending.id,
    name: "Vägledning.PDF",
    size: pdf.length,
    contentType: "application/pdf",
    url: `/api/uploads/${pending.id}`,
  });
  assert.equal("storagePath" in asset, false);
  assert.equal("storageProvider" in asset, false);
  assert.equal(
    await getDb()
      .prepare("SELECT id FROM upload_requests WHERE id=?")
      .get(pending.id),
    undefined,
  );
  const record = (await getUpload(asset.id))!;
  assert.deepEqual(
    await readFile(join(process.env.TIBB_UPLOAD_DIR!, record.storagePath)),
    pdf,
  );
  await getDb().close();
  await getDb().initialize();
  const reopened = (await getUpload(asset.id))!;
  assert.deepEqual(
    Buffer.from(await (await openUpload(reopened)).arrayBuffer()),
    pdf,
  );
  assert.deepEqual(
    await completeUpload(
      admin.id,
      asset.id,
      Buffer.from("ignored retry bytes"),
    ),
    asset,
  );
  await assert.rejects(completeUpload(secondAdmin.id, asset.id, pdf), /saknas/);
  assert.deepEqual(
    Buffer.from(await (await openUpload(reopened)).arrayBuffer()),
    pdf,
  );
});

test("portrait pixels are decoded and normalized to bounded WebP while private storage metadata stays server-side", async () => {
  const bytes = await portraitBytes();
  const pending = await prepareUpload(admin.id, {
    kind: "practitioner-photo",
    filename: "Porträtt.png",
    size: bytes.length,
  });
  const asset = await completeUpload(admin.id, pending.id, bytes);
  assert.equal(asset.contentType, "image/webp");
  assert.equal(asset.name, "Porträtt.webp");
  const record = (await getUpload(asset.id))!;
  assert.match(record.storagePath, /-portrait\.webp$/);
  const stored = Buffer.from(await (await openUpload(record)).arrayBuffer());
  assert.equal(stored.length, asset.size);
  const metadata = await sharp(stored).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width! <= 600 && metadata.height! <= 600);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

test("MIME spoofing, invalid ZIP/Word files and byte-count mismatch cannot create finalized upload records", async () => {
  const owner = await course();
  const png = await portraitBytes(20, 20);
  const malformed = [
    {
      kind: "lesson-material" as const,
      filename: "spoof.pdf",
      bytes: Buffer.from("plain text, not a PDF"),
    },
    {
      kind: "lesson-material" as const,
      filename: "invalid.docx",
      bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]),
    },
    { kind: "lesson-material" as const, filename: "spoof.doc", bytes: pdf },
    { kind: "practitioner-photo" as const, filename: "spoof.jpg", bytes: png },
    {
      kind: "practitioner-photo" as const,
      filename: "invalid.png",
      bytes: Buffer.from("not image data"),
    },
  ];
  for (const input of malformed) {
    const pending = await prepareUpload(admin.id, {
      kind: input.kind,
      filename: input.filename,
      size: input.bytes.length,
      ...(input.kind === "lesson-material" ? { courseId: owner.id } : {}),
    });
    await assert.rejects(
      completeUpload(admin.id, pending.id, input.bytes),
      UploadError,
    );
    assert.equal(await getUpload(pending.id), undefined);
    assert.equal(
      await getDb()
        .prepare("SELECT id FROM upload_requests WHERE id=?")
        .get(pending.id),
      undefined,
    );
  }
  const mismatch = await prepareUpload(admin.id, {
    kind: "lesson-material",
    filename: "mismatch.pdf",
    size: pdf.length,
    courseId: owner.id,
  });
  await assert.rejects(
    completeUpload(
      admin.id,
      mismatch.id,
      Buffer.concat([pdf, Buffer.from("extra")]),
    ),
    /storlek/,
  );
  assert.equal(await getUpload(mismatch.id), undefined);
});

test("bounded stream reads cancel oversize requests and preserve exact accepted bytes", async () => {
  let cancelled = false;
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.enqueue(new Uint8Array([4, 5]));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readLimitedStream(oversized, 4),
    (error: unknown) => error instanceof UploadError && error.status === 413,
  );
  assert.equal(cancelled, true);
  const exact = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(pdf);
      controller.close();
    },
  });
  assert.deepEqual(await readLimitedStream(exact, pdf.length), pdf);
});

test("local read paths are confined to the upload directory and expected UUID filenames", async () => {
  const asset = await uploadedPhoto();
  const record = (await getUpload(asset.id))!;
  for (const storagePath of [
    "../outside.pdf",
    resolve(directory, "outside.pdf"),
    "tibb/lesson-material/not-a-uuid.pdf",
    "tibb/lesson-material/../../outside.pdf",
  ])
    await assert.rejects(openUpload({ ...record, storagePath }), /filsökväg/);
});

test("portraits become public only through an active practitioner and disappear when detached or archived", async () => {
  const asset = await uploadedPhoto();
  assert.equal(await getReadableUpload(asset.id, null), null);
  assert.equal(await getReadableUpload(asset.id, student), null);
  assert.ok(await getReadableUpload(asset.id, admin));
  const practitionerId = await savePractitioner(admin.id, {
    name: "Public portrait fixture",
    description: "",
    active: true,
    photoUploadId: asset.id,
  });
  assert.ok(await getReadableUpload(asset.id, null));
  assert.ok(await getReadableUpload(asset.id, student));
  await archivePractitioner(admin.id, practitionerId);
  assert.equal(await getReadableUpload(asset.id, null), null);
  assert.ok(await getReadableUpload(asset.id, admin));
  await savePractitioner(admin.id, {
    id: practitionerId,
    name: "Public portrait fixture",
    description: "",
    active: true,
    photoUploadId: null,
  });
  assert.equal(await getReadableUpload(asset.id, null), null);
  assert.equal(await getReadableUpload("invalid-id", admin), null);
});

test("lesson files require publication, current enrollment and an attached lesson; revocation and relation removal take effect immediately", async () => {
  const owner = await course();
  const pending = await prepareUpload(admin.id, {
    kind: "lesson-material",
    filename: "lesson.pdf",
    size: pdf.length,
    courseId: owner.id,
  });
  assert.equal(await getReadableUpload(pending.id, admin), null);
  const asset = await completeUpload(admin.id, pending.id, pdf);
  assert.equal(await getReadableUpload(asset.id, null), null);
  await enrollStudent(admin.id, owner.id, student.email);
  assert.equal(await getReadableUpload(asset.id, student), null);
  const lesson = {
    courseId: owner.id,
    title: "File access lesson",
    body: "Text",
    videoUrl: "",
    materialUrl: "",
    position: 1,
  };
  await saveLesson(admin.id, { ...lesson, materialUploadIds: [asset.id] });
  const lessonId = (await getLessons(owner.id))[0].id;
  assert.equal(await getReadableUpload(asset.id, student), null); // draft
  const courseInput = {
    id: owner.id,
    title: owner.title,
    slug: owner.slug,
    description: owner.description,
    price: "0",
  };
  await saveCourse(admin.id, { ...courseInput, published: true });
  assert.ok(await getReadableUpload(asset.id, student));
  assert.equal(await getReadableUpload(asset.id, stranger), null);
  const enrollment = (await getEnrollments(student.id)).find(
    (item) => item.courseId === owner.id,
  )!;
  await removeEnrollment(admin.id, enrollment.id);
  assert.equal(await getReadableUpload(asset.id, student), null);
  await enrollStudent(admin.id, owner.id, student.email);
  assert.ok(await getReadableUpload(asset.id, student));
  await saveCourse(admin.id, { ...courseInput, published: false });
  assert.equal(await getReadableUpload(asset.id, student), null);
  assert.ok(await getReadableUpload(asset.id, admin));
  await saveCourse(admin.id, { ...courseInput, published: true });
  await saveLesson(admin.id, {
    ...lesson,
    id: lessonId,
    materialUploadIds: [],
  });
  assert.equal(await getReadableUpload(asset.id, student), null);
  assert.ok(await getReadableUpload(asset.id, admin));
});

test("finalization belongs to the pending administrator, resets failed claims, and concurrent callers preserve one verified asset", async () => {
  const bytes = await portraitBytes(3000, 2000);
  const pending = await prepareUpload(admin.id, {
    kind: "practitioner-photo",
    filename: "concurrent.png",
    size: bytes.length,
  });
  await assert.rejects(getPendingUpload(secondAdmin.id, pending.id), /saknas/);
  await assert.rejects(
    completeUpload(secondAdmin.id, pending.id, bytes),
    /saknas/,
  );
  await assert.rejects(
    completeUpload(student.id, pending.id, bytes),
    /behörighet/,
  );
  await assert.rejects(completeUpload(admin.id, pending.id), /Välj en fil/);
  assert.equal(
    Number(
      (await getDb()
        .prepare("SELECT completing FROM upload_requests WHERE id=?")
        .get(pending.id))!.completing,
    ),
    0,
  );
  const results = await Promise.allSettled([
    completeUpload(admin.id, pending.id, bytes),
    completeUpload(admin.id, pending.id, bytes),
  ]);
  const successes = results.filter((result) => result.status === "fulfilled");
  assert.ok(successes.length >= 1);
  for (const result of results) {
    if (result.status === "rejected")
      assert.ok(
        result.reason instanceof UploadError && result.reason.status === 409,
      );
    else assert.equal(result.value.id, pending.id);
  }
  assert.equal(
    Number(
      (await getDb()
        .prepare("SELECT COUNT(*) total FROM uploads WHERE id=?")
        .get(pending.id))!.total,
    ),
    1,
  );
  assert.equal(
    await getDb()
      .prepare("SELECT id FROM upload_requests WHERE id=?")
      .get(pending.id),
    undefined,
  );
  const record = (await getUpload(pending.id)) as UploadRecord;
  assert.equal(
    (
      await sharp(
        Buffer.from(await (await openUpload(record)).arrayBuffer()),
      ).metadata()
    ).format,
    "webp",
  );
  assert.deepEqual(
    await completeUpload(admin.id, pending.id),
    successes[0].value,
  );
});
