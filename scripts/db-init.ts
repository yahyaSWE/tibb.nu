import { existsSync } from "node:fs";
import { initializeDatabase, getDb } from "../src/lib/database";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
async function main() {
  await initializeDatabase();
  console.log("Databasens schema är klart.");
  await getDb().close();
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Databasen kunde inte initieras.",
  );
  process.exitCode = 1;
});
