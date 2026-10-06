import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client/node";
import { LibsqlError, type Client, type InStatement, type ResultSet, type Transaction, type TransactionMode } from "@libsql/client";
import { DatabaseAdapter } from "../src/lib/database";
import { SCHEMA_VERSION, SCHEMA_VERSION_KEY } from "../src/lib/schema";

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;

type Call = { method: string; sql?: string };
type Statement = InStatement;
const statementSql = (statement: Statement) => typeof statement === "string" ? statement : statement.sql;

// Observe real SQLite executions while exercising the HTTP adapter's startup
// branch. This needs no network or deployment credentials and adds no public
// injection API to the production adapter.
function observedAdapter(client: Client, options: {
  execute?: (statement: Statement, execute: () => Promise<ResultSet>) => Promise<ResultSet>;
  transactionExecute?: (statement: Statement, execute: () => Promise<ResultSet>) => Promise<ResultSet>;
} = {}) {
  const calls: Call[] = [];
  const wrapTransaction = (transaction: Transaction) => new Proxy(transaction, {
    get(target, key) {
      if (key === "execute") return async (statement: Statement) => {
        calls.push({ method: "tx.execute", sql: statementSql(statement) });
        const execute = () => target.execute(statement);
        return options.transactionExecute ? await options.transactionExecute(statement, execute) : await execute();
      };
      if (key === "executeMultiple") return async (sql: string) => {
        calls.push({ method: "tx.executeMultiple", sql });
        await target.executeMultiple(sql);
      };
      if (key === "commit" || key === "rollback") return async () => {
        calls.push({ method: String(key) });
        await target[key]();
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const observedClient = new Proxy(client, {
    get(target, key) {
      if (key === "execute") return async (statement: Statement) => {
        calls.push({ method: "execute", sql: statementSql(statement) });
        const execute = () => target.execute(statement);
        return options.execute ? await options.execute(statement, execute) : await execute();
      };
      if (key === "transaction") return async (mode: TransactionMode) => {
        calls.push({ method: "transaction" });
        return wrapTransaction(await target.transaction(mode));
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const adapter = new DatabaseAdapter();
  Object.assign(adapter, { clientPromise: Promise.resolve(observedClient), remote: true });
  return { adapter, calls };
}

async function fixture(work: (client: Client) => Promise<void>) {
  // Each fixture has its own real SQLite database; disk migration/reopening is
  // also covered by availability-migration and uploads-migration test suites.
  const client = createClient({ url: "file::memory:",
    intMode: "number", concurrency: 1, timeout: 5000 });
  try { await work(client); }
  finally { client.close(); }
}
async function version(client: Client) {
  return (await client.execute({ sql: "SELECT value FROM app_meta WHERE key=?", args: [SCHEMA_VERSION_KEY] })).rows[0]?.value;
}

test("new databases commit the full schema, inactive starter content and version together only once", async () => {
  await fixture(async (client) => {
    const first = observedAdapter(client);
    await Promise.all([first.adapter.initialize(), first.adapter.initialize()]);
    assert.equal(first.calls.filter((call) => call.method === "transaction").length, 1);
    assert.equal(await version(client), String(SCHEMA_VERSION));
    assert.equal((await client.execute("SELECT value FROM app_meta WHERE key='seeded'")).rows[0]?.value, "1");
    assert.equal((await client.execute("SELECT COUNT(*) total FROM treatments WHERE active=0")).rows[0].total, 2);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM articles WHERE published=0")).rows[0].total, 1);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM courses WHERE published=0")).rows[0].total, 1);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM users")).rows[0].total, 0);
    assert.match(String((await client.execute("EXPLAIN QUERY PLAN SELECT id,position FROM lessons WHERE course_id=1 ORDER BY position,id")).rows[0].detail), /lessons_course_position/);
    const second = observedAdapter(client);
    await second.adapter.initialize();
    assert.equal(second.calls.length, 1);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM treatments")).rows[0].total, 2);
  });
});

test("an existing unversioned database upgrades missing columns without reseeding or changing account and booking history", async () => {
  await fixture(async (client) => {
    await client.executeMultiple(`
      CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT INTO app_meta VALUES('seeded','1');
      CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,created_at TEXT NOT NULL);
      INSERT INTO users VALUES(17,'old-init@example.test','Existing Admin','existing-password-hash','admin','2025-01-01T00:00:00.000Z');
      CREATE TABLE treatments(id INTEGER PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,duration_minutes INTEGER NOT NULL,price_ore INTEGER NOT NULL,active INTEGER NOT NULL);
      INSERT INTO treatments VALUES(23,'Existing treatment','Existing description',60,45000,1);
      CREATE TABLE slots(id INTEGER PRIMARY KEY,treatment_id INTEGER NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL);
      INSERT INTO slots VALUES(31,23,'2025-03-01T09:00:00.000Z','2025-03-01T10:00:00.000Z');
      CREATE TABLE bookings(id INTEGER PRIMARY KEY,reference TEXT NOT NULL UNIQUE,treatment_id INTEGER NOT NULL,slot_id INTEGER NOT NULL,treatment_name TEXT NOT NULL,duration_minutes INTEGER NOT NULL,price_ore INTEGER NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,status TEXT NOT NULL,payment_method TEXT NOT NULL,payment_status TEXT NOT NULL,checkout_session_id TEXT,expires_at TEXT,created_at TEXT NOT NULL);
      INSERT INTO bookings VALUES(41,'legacy-init-reference',23,31,'Existing treatment',60,45000,'2025-03-01T09:00:00.000Z','2025-03-01T10:00:00.000Z','Fixture customer','customer@example.test','','completed','onsite','paid',NULL,NULL,'2025-02-01T09:00:00.000Z');
    `);
    const usersBefore = (await client.execute("SELECT * FROM users")).rows;
    const bookingBefore = (await client.execute("SELECT * FROM bookings")).rows[0];
    const { adapter } = observedAdapter(client);
    await adapter.initialize();
    assert.equal(await version(client), String(SCHEMA_VERSION));
    assert.deepEqual((await client.execute("SELECT * FROM users")).rows, usersBefore);
    assert.deepEqual((await client.execute("SELECT * FROM bookings")).rows[0], { ...bookingBefore, practitioner_id: 1, practitioner_name: "Tibb.nu" });
    assert.deepEqual((await client.execute("SELECT * FROM slots")).rows[0], { id: 31, treatment_id: 23, start: "2025-03-01T09:00:00.000Z", end: "2025-03-01T10:00:00.000Z", archived: 0, schedule_id: null, practitioner_id: 1 });
    assert.equal((await client.execute("SELECT COUNT(*) total FROM treatments")).rows[0].total, 1);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM articles")).rows[0].total, 0);
    assert.ok((await client.execute("PRAGMA table_info(practitioners)")).rows.some((column) => column.name === "photo_upload_id"));
    assert.ok((await client.execute("PRAGMA table_info(upload_requests)")).rows.some((column) => column.name === "completing"));
    await assert.rejects(client.execute("DELETE FROM slots WHERE id=31"), /history/);
  });
});

test("a cold instance with the current schema uses one read, no write transaction or DDL, and caches no domain rows", async () => {
  await fixture(async (client) => {
    await observedAdapter(client).adapter.initialize();
    const sqliteVersionBefore = (await client.execute("PRAGMA schema_version")).rows;
    await client.execute("UPDATE settings SET site_name='Before fresh read' WHERE id=1");
    await client.execute("PRAGMA query_only=ON");
    const { adapter, calls } = observedAdapter(client);
    await Promise.all([adapter.initialize(), adapter.initialize()]);
    assert.deepEqual(calls, [{ method: "execute", sql: "PRAGMA user_version" }]);
    assert.deepEqual((await client.execute("PRAGMA schema_version")).rows, sqliteVersionBefore);
    await client.execute("PRAGMA query_only=OFF");
    assert.equal((await adapter.prepare("SELECT site_name FROM settings WHERE id=1").get())?.site_name, "Before fresh read");
    await client.execute("UPDATE settings SET site_name='After fresh read' WHERE id=1");
    assert.equal((await adapter.prepare("SELECT site_name FROM settings WHERE id=1").get())?.site_name, "After fresh read");
    assert.equal(calls.filter((call) => call.sql === "PRAGMA user_version").length, 1);
  });
});

test("an instance waiting for migration rechecks the committed version under the write lock and skips replaying DDL", async () => {
  await fixture(async (client) => {
    await observedAdapter(client).adapter.initialize();
    let initialRead = true;
    const { adapter, calls } = observedAdapter(client, {
      execute: async (_statement, execute) => {
        const result = await execute();
        if (initialRead) { initialRead = false; return { ...result, rows: [{ ...result.rows[0], user_version: 0 }] }; }
        return result;
      },
    });
    await adapter.initialize();
    assert.deepEqual(calls.map((call) => call.method), ["execute", "transaction", "tx.execute", "commit"]);
    assert.equal(await version(client), String(SCHEMA_VERSION));
    assert.equal((await client.execute("SELECT COUNT(*) total FROM treatments")).rows[0].total, 2);
  });
});

test("migration failure rolls back schema, seed and version and can be retried successfully", async () => {
  await fixture(async (client) => {
    let fail = true;
    const { adapter, calls } = observedAdapter(client, {
      transactionExecute: async (statement, execute) => {
        if (fail && statementSql(statement) === `PRAGMA user_version=${SCHEMA_VERSION}`) {
          await execute();
          fail = false;
          throw new LibsqlError("Temporary migration failure", "SERVER_ERROR");
        }
        return await execute();
      },
    });
    await assert.rejects(adapter.initialize(), /Temporary migration failure/);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM sqlite_master WHERE type='table'")).rows[0].total, 0);
    assert.equal((await client.execute("PRAGMA user_version")).rows[0].user_version, 0);
    assert.equal(calls.filter((call) => call.method === "rollback").length, 1);
    await adapter.initialize();
    assert.equal(await version(client), String(SCHEMA_VERSION));
    assert.equal((await client.execute("SELECT COUNT(*) total FROM treatments")).rows[0].total, 2);
    assert.equal(calls.filter((call) => call.method === "commit").length, 1);
  });
});

test("connection failures during version lookup are surfaced and retried instead of triggering migrations", async () => {
  await fixture(async (client) => {
    let fail = true;
    const { adapter, calls } = observedAdapter(client, {
      execute: async (_statement, execute) => {
        if (fail) { fail = false; throw new LibsqlError("Temporary connection failure", "SERVER_ERROR"); }
        return await execute();
      },
    });
    await assert.rejects(adapter.initialize(), /Temporary connection failure/);
    assert.equal(calls.filter((call) => call.method === "transaction").length, 0);
    await adapter.initialize();
    assert.equal(await version(client), String(SCHEMA_VERSION));
  });
});

test("an older application never rewrites a newer committed schema version", async () => {
  await fixture(async (client) => {
    await observedAdapter(client).adapter.initialize();
    await client.execute({ sql: "UPDATE app_meta SET value=? WHERE key=?", args: [String(SCHEMA_VERSION + 1), SCHEMA_VERSION_KEY] });
    await client.execute(`PRAGMA user_version=${SCHEMA_VERSION + 1}`);
    const { adapter, calls } = observedAdapter(client);
    await assert.rejects(adapter.initialize(), /nyare schemaversion/);
    assert.equal(calls.length, 1);
    assert.equal(await version(client), String(SCHEMA_VERSION + 1));
  });
});
