import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
test('official differential uses guarded provider calls and preserves the signed report through submission',{timeout:60000},async()=>{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  for(const key of Object.keys(env))if(/^(ANAMNES_|TURSO_|VERCEL|STRIPE_|RESEND_|APP_URL$|SITE_URL$)/.test(key))delete env[key];
  const root=await mkdtemp(join(tmpdir(),'tibb-differential-backend-'));env.TIBB_DATABASE_PATH=join(root,'owned.sqlite');env.NODE_ENV='test';
  try {
    const result=await promisify(execFile)(process.execPath,['--conditions=react-server','--import=tsx','--test',resolve('tests/anamnes-differential-backend.fixture.ts')],{env,timeout:50000,maxBuffer:60000});
    assert.match(result.stdout,/(?:# fail 0|ℹ fail 0)/);assert.equal(result.stderr,'');
  }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
