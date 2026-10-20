import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("anamnes server protections pass against owned SQLite and a mocked AI provider", { timeout: 120000 }, async () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const key of Object.keys(env)) if (/^(ANAMNES_|TURSO_|VERCEL|CRON_SECRET$|TRUST_PROXY$|APP_URL$)/.test(key)) delete env[key];
  const directory = await mkdtemp(join(tmpdir(), "tibb-anamnes-backend-"));
  env.TIBB_DATABASE_PATH = join(directory, "owned-fixture.sqlite");
  env.ANAMNES_TEST_FIXTURE = "1";
  env.NODE_ENV = "test";
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, ["--conditions=react-server", "--import=tsx", "--test", "--test-reporter=tap", resolve("tests/anamnes-backend.fixture.ts")], { env, timeout: 110000, maxBuffer: 200000 }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
      assert.fail(`${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
    });
    assert.match(stdout, /# fail 0/);
    assert.equal(stderr, "");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
