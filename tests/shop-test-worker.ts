import { getDb } from "../src/lib/db";
import { reserveShopOrder } from "../src/lib/shop";
import { resolve, basename, sep } from "node:path";
import { tmpdir } from "node:os";
async function main() {
  const path = resolve(process.argv[2] || "");
  if (!path.startsWith(resolve(tmpdir()) + sep) || basename(path) !== "shop.sqlite") throw new Error("Worker requires the isolated temporary fixture");
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.VERCEL;
  process.env.TIBB_DATABASE_PATH = path;
  const db = getDb();
  try {
    if ((await db.prepare("SELECT value FROM app_meta WHERE key='shop-test-fixture'").get())?.value !== "isolated") throw new Error("Fixture marker missing");
    try {
      await reserveShopOrder({ items: [{ productId: Number(process.argv[3]), quantity: 1 }], name: "Concurrent fixture customer", email: "worker@example.test", phone: "", delivery: "pickup", consent: true });
      process.stdout.write("ok");
    } catch (error) {
      if (error instanceof Error && /lager/.test(error.message)) process.stdout.write("unavailable");
      else throw error;
    }
  } finally { await db.close(); }
}
main().catch(() => { process.stderr.write("Fixture worker failed"); process.exitCode = 1; });
