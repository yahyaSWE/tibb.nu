import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createFirstAdmin, getDb, type User } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import { cleanupCourseUploads, parseUploadCleanupArguments, type CleanupStorage, type CleanupArtifact } from "../src/lib/upload-maintenance";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "BLOB_WEBHOOK_PUBLIC_KEY", "VERCEL_OIDC_TOKEN"]) delete process.env[key];
const directory = mkdtempSync(join(tmpdir(), "tibb-upload-cleanup-tests-"));
process.env.TIBB_DATABASE_PATH = join(directory, "tibb.sqlite");
process.env.TIBB_UPLOAD_DIR = join(directory, "uploads");
const old = new Date(Date.now() - 30 * 86400000).toISOString();
let admin: User;
let courseId: number;
let lessonId: number;
before(async () => {
  admin = await createFirstAdmin({ name: "Cleanup Admin", email: "cleanup@example.test", passwordHash: hashPassword("cleanup fixture password") });
  const course = await getDb().prepare("INSERT INTO courses(title,slug,description,price_ore,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
    .run("Cleanup course", "cleanup-course", "Isolated fixture", 0, 0, old, old);
  courseId = Number(course.lastInsertRowid);
  const lesson = await getDb().prepare("INSERT INTO lessons(course_id,title,body,video_url,material_url,position) VALUES(?,?,?,?,?,?)")
    .run(courseId, "Cleanup lesson", "Isolated fixture", "", "", 1);
  lessonId = Number(lesson.lastInsertRowid);
});
beforeEach(async () => {
  await getDb().prepare("DELETE FROM lesson_materials").run();
  await getDb().prepare("DELETE FROM uploads").run();
  await getDb().prepare("DELETE FROM upload_requests").run();
});
after(async () => {
  await getDb().close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("tibb-upload-cleanup-tests-"));
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
function asset(id = randomUUID(), created = old): CleanupArtifact {
  return { storagePath: `tibb/lesson-material/${id}.pdf`, size: 4, modifiedAt: Date.parse(created), version: "etag-1" };
}
async function row(file: CleanupArtifact, options: { referenced?: boolean; request?: boolean; completing?: boolean; created?: string; provider?: "blob" | "local"; kind?: string } = {}) {
  const id = file.storagePath.split("/").pop()!.split(".")[0];
  const table = options.request ? "upload_requests" : "uploads";
  await getDb().prepare(`INSERT INTO ${table}(id,kind,filename,content_type,size,storage_path,storage_provider,uploader_id,course_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(id, options.kind || "lesson-material", "fixture.pdf", "application/pdf", file.size, file.storagePath, options.provider || "blob", admin.id, courseId, options.created || old);
  if (options.completing) await getDb().prepare("UPDATE upload_requests SET completing=1 WHERE id=?").run(id);
  if (options.referenced) await getDb().prepare("INSERT INTO lesson_materials(lesson_id,upload_id) VALUES(?,?)").run(lessonId, id);
  return id;
}
function storage(files: CleanupArtifact[], onInspect?: (file: CleanupArtifact) => Promise<void>) {
  const map = new Map(files.map((file) => [file.storagePath, file]));
  const removed: string[] = [];
  const adapter: CleanupStorage = {
    async inventory() { return [...map.values()]; },
    async inspect(path) { const file = map.get(path); if (file && onInspect) await onInspect(file); return file; },
    async remove(file) { assert.equal(map.get(file.storagePath)?.version, file.version); removed.push(file.storagePath); map.delete(file.storagePath); },
  };
  return { adapter, map, removed };
}

test("cleanup defaults to dry-run and validates explicit deletion bounds", async () => {
  assert.equal(parseUploadCleanupArguments([]).apply, undefined);
  for (const args of [["--grace-hours", "0"], ["--grace-hours", "23"], ["--limit", "0"], ["--limit", "2.5"], ["--provider", "other"], ["--force"]])
    assert.throws(() => parseUploadCleanupArguments(args));
  const file = asset(); const id = await row(file); const mock = storage([file]);
  const report = await cleanupCourseUploads({ provider: "blob", storage: { blob: mock.adapter } });
  assert.equal(report.mode, "dry-run"); assert.equal(report.metadata[0].status, "would-remove");
  assert.ok(await getDb().prepare("SELECT id FROM uploads WHERE id=?").get(id));
  assert.deepEqual(mock.removed, []);
});

test("apply only removes expired unreferenced records and protects active files and uploads", async () => {
  const expired = asset(), linked = asset(), recent = asset(), completing = asset(), request = asset();
  const expiredId = await row(expired); await row(linked, { referenced: true }); await row(recent, { created: new Date().toISOString() });
  await row(completing, { request: true, completing: true }); await row(request, { request: true });
  const mock = storage([expired, linked, recent, completing, request]);
  const report = await cleanupCourseUploads({ apply: true, provider: "blob", storage: { blob: mock.adapter } });
  assert.equal(report.metadata.filter((entry) => entry.status === "removed").length, 2);
  assert.deepEqual(new Set(mock.removed), new Set([expired.storagePath, request.storagePath]));
  assert.equal(await getDb().prepare("SELECT id FROM uploads WHERE id=?").get(expiredId), undefined);
  assert.ok(report.metadata.some((entry) => entry.reason === "referenced"));
  assert.ok(report.metadata.some((entry) => entry.reason === "upload-completing"));
  assert.ok(report.metadata.some((entry) => entry.reason === "within-grace-period"));
});

test("metadata-free artifacts are report-only until explicitly included and storage/database pair is verified", async () => {
  const linked = asset(), orphan = asset(); const mock = storage([linked, orphan]);
  let report = await cleanupCourseUploads({ apply: true, includeStorageOrphans: true, provider: "blob", storage: { blob: mock.adapter } });
  assert.equal(report.storageOrphans[0].reason, "storage-database-pair-unverified"); assert.deepEqual(mock.removed, []);
  await row(linked, { referenced: true });
  report = await cleanupCourseUploads({ apply: true, provider: "blob", storage: { blob: mock.adapter } });
  assert.equal(report.verifiedStorageDatabasePair.blob, true); assert.equal(report.storageOrphans[0].reason, "orphan-report-only");
  report = await cleanupCourseUploads({ apply: true, includeStorageOrphans: true, provider: "blob", storage: { blob: mock.adapter } });
  assert.equal(report.storageOrphans[0].status, "removed"); assert.deepEqual(mock.removed, [orphan.storagePath]);
});

test("a lesson attaching during inventory review is preserved by the fresh transaction check", async () => {
  const file = asset(); const id = await row(file); let attached = false;
  const mock = storage([file], async () => { if (!attached) { attached = true; await getDb().prepare("INSERT INTO lesson_materials(lesson_id,upload_id) VALUES(?,?)").run(lessonId, id); } });
  const report = await cleanupCourseUploads({ apply: true, provider: "blob", storage: { blob: mock.adapter } });
  assert.equal(report.metadata[0].reason, "referenced"); assert.deepEqual(mock.removed, []);
  assert.ok(await getDb().prepare("SELECT id FROM uploads WHERE id=?").get(id));
});

test("changed artifact versions, young files, photo prefixes and deletion limits fail safely", async () => {
  const changing = asset(), young = { ...asset(), modifiedAt: Date.now() }, first = asset(), second = asset();
  const portrait = { ...asset(), storagePath: `tibb/practitioner-photo/${randomUUID()}-portrait.webp` };
  await row(changing); await row(young); await row(first); await row(second);
  let seen = 0; const mock = storage([changing, young, first, second, portrait], async (file) => { if (file.storagePath === changing.storagePath && seen++ > 0) mock.map.set(file.storagePath, { ...file, version: "etag-2" }); });
  // Return a new inspection object so the expected version remains immutable.
  const inspect = mock.adapter.inspect;
  mock.adapter.inspect = async (path) => { await inspect(path); const file = mock.map.get(path); return file && { ...file }; };
  const report = await cleanupCourseUploads({ apply: true, provider: "blob", limit: 2, storage: { blob: mock.adapter } });
  assert.ok(report.metadata.some((entry) => entry.reason === "file-changed-after-claim"));
  assert.ok(report.metadata.some((entry) => entry.reason === "file-within-grace-period"));
  assert.equal(report.limitReached, true); assert.deepEqual(mock.removed, [first.storagePath]);
  assert.equal(report.storageOrphans.length, 0); assert.ok(mock.map.has(portrait.storagePath));
});

test("local deletion stays in its owned regular directory and refuses symlink directories", async (context) => {
  const file = asset(); const root = process.env.TIBB_UPLOAD_DIR!; const path = join(root, file.storagePath);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, "test"); await row(file, { provider: "local" });
  const originalNow = Date.now;
  Date.now = () => originalNow() + 40 * 86400000;
  try {
    const report = await cleanupCourseUploads({ apply: true, provider: "local" });
    assert.equal(report.metadata[0].status, "removed"); await assert.rejects(readFile(path), { code: "ENOENT" });
  } finally { Date.now = originalNow; }
  const outside = join(directory, "outside"); const linkedRoot = join(directory, "linked-uploads");
  await mkdir(outside); await writeFile(join(outside, "keep.txt"), "preserve");
  try { await symlink(outside, linkedRoot, "junction"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EPERM") { context.diagnostic("Junction check unavailable on this host"); return; } throw error; }
  process.env.TIBB_UPLOAD_DIR = linkedRoot;
  try { await assert.rejects(cleanupCourseUploads({ apply: true, provider: "local" }), /symboliska|junctions/); assert.equal(await readFile(join(outside, "keep.txt"), "utf8"), "preserve"); }
  finally { process.env.TIBB_UPLOAD_DIR = root; }
});
