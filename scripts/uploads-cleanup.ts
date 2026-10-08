import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanupCourseUploads, parseUploadCleanupArguments } from "../src/lib/upload-maintenance";
import { getDb } from "../src/lib/database";

async function main() {
  const options = parseUploadCleanupArguments(process.argv.slice(2));
  if (options.help) {
    console.log(`Användning: npx tsx scripts/uploads-cleanup.ts [alternativ]

Standard: dry-run, skyddsperiod 168 timmar, högst 200 borttagningar.
  --apply                    Utför borttagning efter färska kontroller.
  --include-storage-orphans  Inkludera metadatalösa kursfiler endast när
                             lagring/databas har verifierats genom en
                             befintlig refererad kursfil i båda systemen.
  --grace-hours N            Minst 24 timmar. Standard 168.
  --provider local|blob|all  Standard all, Blob kräver konfigurerad lagring.
  --limit N                  Högst N kandidater, 1–5000. Standard 200.
  --help                     Visa hjälp utan databas-/lagringsåtkomst.

Rapporten skiljer metadata från lagringsorphans. Behandlarbilder och okända
sökvägar hanteras aldrig. Säkerhetskopiera och verifiera rätt databas/lagring
innan --apply. Utan --include-storage-orphans är metadatalösa filer report-only.`);
    return;
  }
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (!process.env.TURSO_DATABASE_URL) {
    const path = process.env.TIBB_DATABASE_PATH || resolve(process.cwd(), "data/tibb.sqlite");
    if (path === ":memory:" || !existsSync(path))
      throw new Error("En befintlig databas krävs. Städning får inte skapa en ny tom databas.");
  }
  try {
    const report = await cleanupCourseUploads(options);
    console.log(JSON.stringify(report, null, 2));
    if ([...report.metadata, ...report.storageOrphans].some(entry => entry.status === "failed")) process.exitCode = 1;
  } finally {
    await getDb().close();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Städningen kunde inte slutföras.");
  process.exitCode = 1;
});
