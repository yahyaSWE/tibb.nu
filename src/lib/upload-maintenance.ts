import { lstat, readdir, realpath, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { BlobNotFoundError, del, head, list } from "@vercel/blob";
import { getDb, transaction } from "./database";

export const DEFAULT_UPLOAD_GRACE_HOURS = 7 * 24;
export const MIN_UPLOAD_GRACE_HOURS = 24;
const PREFIX = "tibb/lesson-material/";
const COURSE_PATH = /^tibb\/lesson-material\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.(pdf|doc|docx)$/;
type Provider = "local" | "blob";

export type CleanupArtifact = {
  storagePath: string;
  size: number;
  modifiedAt: number;
  version: string;
};
export type CleanupStorage = {
  inventory(): Promise<CleanupArtifact[]>;
  inspect(storagePath: string): Promise<CleanupArtifact | undefined>;
  remove(artifact: CleanupArtifact): Promise<void>;
};
export type UploadCleanupOptions = {
  apply?: boolean;
  includeStorageOrphans?: boolean;
  graceHours?: number;
  provider?: Provider | "all";
  limit?: number;
  // Injectable storage boundaries let tests exercise Blob races without credentials.
  storage?: Partial<Record<Provider, CleanupStorage>>;
};
export type UploadCleanupEntry = {
  id: string;
  provider: Provider;
  storagePath: string;
  source: "unreferenced-upload" | "expired-request" | "storage-orphan";
  status: "would-remove" | "removed" | "skipped" | "failed";
  reason: string;
};
export type UploadCleanupReport = {
  mode: "dry-run" | "apply";
  graceHours: number;
  cutoff: string;
  verifiedStorageDatabasePair: Record<Provider, boolean>;
  metadata: UploadCleanupEntry[];
  storageOrphans: UploadCleanupEntry[];
  limitReached: boolean;
};
type UploadRow = {
  id: string;
  kind: string;
  storage_path: string;
  storage_provider: string;
  created_at: string;
  size: number;
  completing: number;
  source: "upload" | "request";
};

function validOptions(options: UploadCleanupOptions) {
  const graceHours = options.graceHours ?? DEFAULT_UPLOAD_GRACE_HOURS;
  const limit = options.limit ?? 200;
  const provider = options.provider ?? "all";
  if (!Number.isFinite(graceHours) || graceHours < MIN_UPLOAD_GRACE_HOURS)
    throw new Error("Städning kräver minst 24 timmars skyddsperiod.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000)
    throw new Error("Antalsgränsen ska vara ett heltal mellan 1 och 5000.");
  if (!["local", "blob", "all"].includes(provider))
    throw new Error("Välj lagring: local, blob eller all.");
  return { graceHours, limit, provider };
}

export function parseUploadCleanupArguments(args: readonly string[]) {
  const options: UploadCleanupOptions & { help?: boolean } = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help") options.help = true;
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--include-storage-orphans") options.includeStorageOrphans = true;
    else if (argument === "--grace-hours" || argument === "--limit") {
      const raw = args[++index];
      if (!raw || !/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Ange ett tal efter ${argument}.`);
      if (argument === "--grace-hours") options.graceHours = Number(raw);
      else options.limit = Number(raw);
    } else if (argument === "--provider") {
      options.provider = args[++index] as UploadCleanupOptions["provider"];
      if (!options.provider) throw new Error("Ange local, blob eller all efter --provider.");
    } else throw new Error(`Okänt argument: ${argument}`);
  }
  validOptions(options);
  return options;
}

function missing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function localStorage(): CleanupStorage {
  const root = resolve(process.env.TIBB_UPLOAD_DIR || resolve(process.cwd(), "data/uploads"));
  const directory = resolve(root, "tibb", "lesson-material");
  async function safeDirectory() {
    for (const path of [root, resolve(root, "tibb"), directory]) {
      let information;
      try { information = await lstat(path); }
      catch (error) { if (missing(error)) return false; throw error; }
      if (!information.isDirectory() || information.isSymbolicLink())
        throw new Error("Lokal kurslagring måste bestå av vanliga mappar utan symboliska länkar eller junctions.");
    }
    const actualRoot = await realpath(root);
    const actualDirectory = await realpath(directory);
    if (!actualDirectory.startsWith(actualRoot + sep))
      throw new Error("Kurslagringen ligger utanför den angivna lagringsmappen.");
    return true;
  }
  async function inspect(storagePath: string): Promise<CleanupArtifact | undefined> {
    if (!COURSE_PATH.test(storagePath)) throw new Error("Okänd sökväg för kursmaterial.");
    if (!(await safeDirectory())) return;
    const file = resolve(root, storagePath);
    if (!file.startsWith(root + sep)) throw new Error("Filsökvägen ligger utanför lagringsmappen.");
    let information;
    try { information = await lstat(file, { bigint: true }); }
    catch (error) { if (missing(error)) return; throw error; }
    if (!information.isFile() || information.isSymbolicLink())
      throw new Error("Kursmaterialet är inte en vanlig fil.");
    const actualRoot = await realpath(root);
    const actualFile = await realpath(file);
    if (!actualFile.startsWith(actualRoot + sep)) throw new Error("Kursfilen ligger utanför lagringsmappen.");
    return {
      storagePath, size: Number(information.size),
      modifiedAt: Math.max(Number(information.mtimeMs), Number(information.ctimeMs)),
      version: `${information.dev}:${information.ino}:${information.size}:${information.mtimeNs}:${information.ctimeNs}`,
    };
  }
  return {
    inspect,
    async inventory() {
      if (!(await safeDirectory())) return [];
      const names = await readdir(directory);
      if (names.length > 10000) throw new Error("För många lokala filer för en säker städgenomgång.");
      const artifacts: CleanupArtifact[] = [];
      for (const name of names) {
        const storagePath = PREFIX + name;
        if (!COURSE_PATH.test(storagePath)) continue;
        try {
          const artifact = await inspect(storagePath);
          if (artifact) artifacts.push(artifact);
        } catch {
          // Unknown files and symlinks are never traversed or deleted.
        }
      }
      return artifacts;
    },
    async remove(expected) {
      const current = await inspect(expected.storagePath);
      if (!current) return;
      if (current.version !== expected.version) throw new Error("Kursfilen har ändrats efter kontrollen.");
      await unlink(resolve(root, expected.storagePath));
    },
  };
}

function blobStorage(): CleanupStorage {
  const artifact = (value: { pathname: string; size: number; uploadedAt: Date; etag: string }): CleanupArtifact => ({
    storagePath: value.pathname, size: value.size, modifiedAt: value.uploadedAt.getTime(), version: value.etag,
  });
  return {
    async inventory() {
      const files: CleanupArtifact[] = [];
      let cursor: string | undefined;
      const cursors = new Set<string>();
      do {
        const page = await list({ prefix: PREFIX, limit: 1000, cursor, mode: "expanded", abortSignal: AbortSignal.timeout(15000) });
        for (const file of page.blobs)
          if (COURSE_PATH.test(file.pathname)) files.push(artifact(file));
        if (files.length > 10000) throw new Error("För många Blob-filer för en säker städgenomgång.");
        if (!page.hasMore) break;
        if (!page.cursor || cursors.has(page.cursor)) throw new Error("Blob-listningen saknar säker nästa sidmarkör.");
        cursor = page.cursor;
        cursors.add(cursor);
      } while (true);
      return files;
    },
    async inspect(storagePath) {
      if (!COURSE_PATH.test(storagePath)) throw new Error("Okänd sökväg för kursmaterial.");
      try {
        const value = await head(storagePath, { abortSignal: AbortSignal.timeout(15000) });
        if (value.pathname !== storagePath || !value.etag) throw new Error("Blob-metadata stämmer inte med kursfilen.");
        return artifact(value);
      } catch (error) {
        if (error instanceof BlobNotFoundError) return;
        throw error;
      }
    },
    async remove(value) {
      if (!COURSE_PATH.test(value.storagePath) || !value.version) throw new Error("Blob-filens identitet saknas.");
      await del(value.storagePath, { ifMatch: value.version, abortSignal: AbortSignal.timeout(15000) });
    },
  };
}

async function rowsFor(id: string, path: string): Promise<UploadRow[]> {
  return await getDb().prepare(
    "SELECT id,kind,storage_path,storage_provider,created_at,size,0 AS completing,'upload' AS source FROM uploads WHERE id=? OR storage_path=? UNION ALL SELECT id,kind,storage_path,storage_provider,created_at,size,completing,'request' AS source FROM upload_requests WHERE id=? OR storage_path=?",
  ).all(id, path, id, path) as unknown as UploadRow[];
}
async function eligibility(entry: UploadCleanupEntry, cutoff: number) {
  if (COURSE_PATH.exec(entry.storagePath)?.[1] !== entry.id) return "unknown-path";
  const reference = await getDb().prepare(
    "SELECT upload_id AS id FROM lesson_materials WHERE upload_id=? UNION ALL SELECT photo_upload_id AS id FROM practitioners WHERE photo_upload_id=? LIMIT 1",
  ).get(entry.id, entry.id);
  if (reference) return "referenced";
  for (const row of await rowsFor(entry.id, entry.storagePath)) {
    if (row.kind !== "lesson-material" || row.id !== entry.id || row.storage_path !== entry.storagePath || row.storage_provider !== entry.provider)
      return "identity-mismatch";
    if (row.completing) return "upload-completing";
    const created = Date.parse(row.created_at);
    if (!Number.isFinite(created) || created > cutoff) return "within-grace-period";
  }
  return undefined;
}
function artifactOld(value: CleanupArtifact | undefined, cutoff: number) {
  return !value || (Number.isFinite(value.modifiedAt) && value.modifiedAt <= cutoff);
}

export async function cleanupCourseUploads(options: UploadCleanupOptions = {}): Promise<UploadCleanupReport> {
  const { graceHours, limit, provider } = validOptions(options);
  const cutoff = Date.now() - graceHours * 3600000;
  const storage: Partial<Record<Provider, CleanupStorage>> = {};
  if (provider !== "blob") storage.local = options.storage?.local ?? localStorage();
  if (provider !== "local") {
    const configured = !!process.env.BLOB_READ_WRITE_TOKEN || !!(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN);
    if (options.storage?.blob || configured) storage.blob = options.storage?.blob ?? blobStorage();
  }
  const report: UploadCleanupReport = {
    mode: options.apply ? "apply" : "dry-run", graceHours, cutoff: new Date(cutoff).toISOString(),
    verifiedStorageDatabasePair: { local: false, blob: false }, metadata: [], storageOrphans: [], limitReached: false,
  };
  const records = await getDb().prepare(
    "SELECT id,kind,storage_path,storage_provider,created_at,size,0 AS completing,'upload' AS source FROM uploads WHERE kind='lesson-material' UNION ALL SELECT id,kind,storage_path,storage_provider,created_at,size,completing,'request' AS source FROM upload_requests WHERE kind='lesson-material'",
  ).all() as unknown as UploadRow[];
  const inventories = new Map<Provider, Map<string, CleanupArtifact>>();
  for (const [name, adapter] of Object.entries(storage) as [Provider, CleanupStorage][]) {
    const values = (await adapter.inventory()).filter(value => COURSE_PATH.test(value.storagePath));
    inventories.set(name, new Map(values.map(value => [value.storagePath, value])));
  }
  // A known, currently referenced UUID file with the same byte count proves
  // that this inventory belongs to this database. No manual bypass exists.
  for (const row of records.filter(row => row.source === "upload")) {
    const name = row.storage_provider as Provider;
    const file = inventories.get(name)?.get(row.storage_path);
    if (!file || file.size !== Number(row.size) || COURSE_PATH.exec(row.storage_path)?.[1] !== row.id) continue;
    if (await getDb().prepare("SELECT lesson_id FROM lesson_materials WHERE upload_id=? LIMIT 1").get(row.id))
      report.verifiedStorageDatabasePair[name] = true;
  }
  const seen = new Set<string>();
  const candidates: UploadCleanupEntry[] = [];
  for (const row of records) {
    const name = row.storage_provider as Provider;
    if (!["local", "blob"].includes(name) || (provider !== "all" && name !== provider)) continue;
    const key = `${name}:${row.storage_path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry: UploadCleanupEntry = { id: row.id, provider: name, storagePath: row.storage_path, source: row.source === "upload" ? "unreferenced-upload" : "expired-request", status: "skipped", reason: "not-evaluated" };
    report.metadata.push(entry);
    candidates.push(entry);
  }
  for (const [name, files] of inventories) for (const file of files.values()) {
    const key = `${name}:${file.storagePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry: UploadCleanupEntry = { id: COURSE_PATH.exec(file.storagePath)![1], provider: name, storagePath: file.storagePath, source: "storage-orphan", status: "skipped", reason: "not-evaluated" };
    report.storageOrphans.push(entry);
    candidates.push(entry);
  }
  let eligibleCount = 0;
  for (const entry of candidates) {
    const adapter = storage[entry.provider];
    if (!adapter) { entry.reason = "storage-not-configured"; continue; }
    try {
      const reason = await eligibility(entry, cutoff);
      if (reason) { entry.reason = reason; continue; }
      if (entry.source === "storage-orphan") {
        // Metadata appeared after inventory: never reinterpret it as an orphan.
        if ((await rowsFor(entry.id, entry.storagePath)).length) { entry.reason = "metadata-present"; continue; }
        if (!options.includeStorageOrphans) { entry.reason = "orphan-report-only"; continue; }
        if (!report.verifiedStorageDatabasePair[entry.provider]) { entry.reason = "storage-database-pair-unverified"; continue; }
      }
      const file = await adapter.inspect(entry.storagePath);
      if (!artifactOld(file, cutoff)) { entry.reason = "file-within-grace-period"; continue; }
      if (eligibleCount++ >= limit) { entry.reason = "limit-reached"; report.limitReached = true; continue; }
      if (!options.apply) { entry.status = "would-remove"; entry.reason = "unreferenced-and-expired"; continue; }
      // Claim metadata atomically. Any concurrent lesson save either attaches
      // first (and is protected), or finds the claimed upload no longer exists.
      const claim = await transaction(async () => {
        const freshReason = await eligibility(entry, cutoff);
        if (freshReason) return freshReason;
        if (entry.source === "storage-orphan" && (await rowsFor(entry.id, entry.storagePath)).length)
          return "metadata-present";
        await getDb().prepare("DELETE FROM uploads WHERE id=? AND kind='lesson-material' AND storage_path=? AND storage_provider=?").run(entry.id, entry.storagePath, entry.provider);
        await getDb().prepare("DELETE FROM upload_requests WHERE id=? AND kind='lesson-material' AND storage_path=? AND storage_provider=? AND completing=0").run(entry.id, entry.storagePath, entry.provider);
        return undefined;
      });
      if (claim) { entry.reason = claim; continue; }
      // Network operations never hold a database write lock. The application
      // creates immutable random UUID paths; completion requires its request.
      const current = await adapter.inspect(entry.storagePath);
      if (!artifactOld(current, cutoff) || (file && current && file.version !== current.version)) {
        entry.reason = "file-changed-after-claim";
        continue;
      }
      if ((await rowsFor(entry.id, entry.storagePath)).length || await eligibility(entry, cutoff)) {
        entry.reason = "metadata-changed-after-claim";
        continue;
      }
      if (current) await adapter.remove(current);
      entry.status = "removed";
      entry.reason = current ? "unreferenced-and-expired" : "expired-metadata-file-missing";
    } catch (error) {
      entry.status = "failed";
      // Reports contain no tokens, Blob URLs, filenames or raw provider errors.
      entry.reason = error instanceof Error ? `operation-failed:${error.name}` : "operation-failed";
    }
  }
  return report;
}
