import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client/node";
import { DatabaseAdapter } from "../src/lib/database";
import { SCHEMA_VERSION } from "../src/lib/schema";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL"]) delete process.env[key];

test("version 13 gains persistent MCP tokens atomically without changing existing bookings", async () => {
  const client = createClient({ url: "file::memory:", intMode: "number", concurrency: 1 });
  const first = new DatabaseAdapter(); Object.assign(first, { clientPromise: Promise.resolve(client) });
  try {
    await first.initialize();
    await client.executeMultiple(`
      DROP TABLE mcp_booking_requests;
      DROP TRIGGER mcp_booking_requests_delete;
      PRAGMA user_version=13;
      UPDATE app_meta SET value='13' WHERE key='schema_version';
      INSERT INTO slots(id,treatment_id,start,end) VALUES(1,1,'2090-01-01T10:00:00.000Z','2090-01-01T10:30:00.000Z');
      INSERT INTO bookings(id,reference,treatment_id,slot_id,treatment_name,duration_minutes,price_ore,start,end,name,email,status,payment_method,created_at)
      VALUES(1,'legacy-reference',1,1,'Original treatment',30,39900,'2090-01-01T10:00:00.000Z','2090-01-01T10:30:00.000Z','Synthetic Customer','legacy@example.test','confirmed','onsite','2025-01-01T00:00:00.000Z');
    `);
    const original = { ...(await client.execute("SELECT * FROM bookings WHERE id=1")).rows[0] };
    const upgrade = new DatabaseAdapter(); Object.assign(upgrade, { clientPromise: Promise.resolve(client) });
    await Promise.all([upgrade.initialize(), upgrade.initialize()]);
    assert.deepEqual((await client.execute("SELECT * FROM bookings WHERE id=1")).rows[0], original);
    assert.equal(Number((await client.execute("PRAGMA user_version")).rows[0].user_version), SCHEMA_VERSION);
    await client.execute({ sql: "INSERT INTO mcp_booking_requests(token_hash,request_hash,booking_reference,access_expires_at,created_at) VALUES(?,?,?,?,?)", args: ["synthetic-token-hash", "synthetic-request-hash", "legacy-reference", "2090-01-08T00:00:00.000Z", "2026-01-01T00:00:00.000Z"] });
    const cold = new DatabaseAdapter(); Object.assign(cold, { clientPromise: Promise.resolve(client) });
    await cold.initialize();
    assert.equal((await client.execute("SELECT request_hash FROM mcp_booking_requests WHERE booking_reference='legacy-reference'")).rows[0].request_hash, "synthetic-request-hash");
    await assert.rejects(client.execute("INSERT INTO mcp_booking_requests(token_hash,request_hash,booking_reference,access_expires_at,created_at) VALUES('another','hash','legacy-reference','2090-01-08','2026-01-01')"));
    await client.execute("PRAGMA foreign_keys=OFF");
    await client.execute("DELETE FROM bookings WHERE id=1");
    assert.equal((await client.execute("SELECT COUNT(*) total FROM mcp_booking_requests")).rows[0].total, 0);
  } finally { await first.close(); }
});
