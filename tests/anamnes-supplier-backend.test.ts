import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

test('supplier catalog migrations, product gates and therapist reviews use owned SQLite without network', {timeout:120000}, async () => {
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  for (const key of Object.keys(env)) {
    if (/^(ANAMNES_|TURSO_|VERCEL|STRIPE_|RESEND_|SMTP_|MAIL_|CRON_SECRET$|TRUST_PROXY$|APP_URL$|SETUP_TOKEN$)/.test(key)) delete env[key];
  }
  const directory = resolve(await mkdtemp(join(tmpdir(),'tibb-anamnes-supplier-')));
  // The sole recursive cleanup target is this newly created owned temp folder.
  assert.equal(dirname(directory).toLowerCase(),resolve(tmpdir()).toLowerCase());
  assert.match(basename(directory),/^tibb-anamnes-supplier-[a-zA-Z0-9]+$/);
  env.TIBB_DATABASE_PATH = join(directory,'owned-fixture.sqlite');
  env.ANAMNES_SUPPLIER_TEST_FIXTURE = '1';
  env.NODE_ENV = 'test';
  try {
    const {stdout,stderr} = await promisify(execFile)(process.execPath,[
      '--conditions=react-server','--import=tsx','--test','--test-reporter=tap',resolve('tests/anamnes-supplier-backend.fixture.ts'),
    ],{env,timeout:110000,maxBuffer:200000});
    assert.match(stdout,/# fail 0/);
    assert.equal(stderr,'');
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});
