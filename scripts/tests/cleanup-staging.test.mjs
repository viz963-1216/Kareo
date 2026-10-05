import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupStaging } from '../cleanup-staging.mjs';
const env = { SUPABASE_URL: 'https://ojawadobnaxduxybqolk.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key', KAREO_OPERATOR_ID: 'synthetic-operator', KAREO_OPERATOR_KEY: 'synthetic-personal-key',
  NETLIFY_AUTH_TOKEN:'synthetic-netlify-key', NETLIFY_SITE_ID:'synthetic-site' };

test('wrong project, missing credentials and invalid mode never load a database client', async () => {
  for (const options of [
    { mode: 'commit', env: { ...env, SUPABASE_URL: 'https://vcbhtlwkzavqvxthicis.supabase.co' } },
    { mode: 'commit', env: { ...env, SUPABASE_URL: 'https://ojawadobnaxduxybqolk.supabase.co.attacker.example' } },
    { mode: 'commit', env: { ...env, KAREO_OPERATOR_KEY: '' } },
    { mode: 'commit', env: { ...env, NETLIFY_AUTH_TOKEN: '' } },
    { mode: 'commit', env: { ...env, NETLIFY_SITE_ID: '' } },
    { mode: 'commit', env: { ...env, SUPABASE_URL: 'https://ojawadobnaxduxybqolk.supabase.co:444' } },
    { mode: 'unsupported', env },
  ]) {
    let loaded = false;
    assert.equal(await cleanupStaging({ ...options, error: () => {}, loadCli: async () => { loaded = true; } }), 1);
    assert.equal(loaded, false);
  }
});

test('dry-run and commit both use the existing CLI and its personal-operator validation', async () => {
  for (const mode of ['dry-run', 'commit']) {
    let call;
    const loadCli = async () => ({ sessionRepo: {}, operatorRepo: {}, journal:{}, replayRepo:{},
      runCleanupCli: async (...args) => { call = args; return 0; } });
    assert.equal(await cleanupStaging({ mode, env, loadCli, log: () => {}, error: () => {} }), 0);
    assert.deepEqual(call[0], [`--${mode}`, '--operator-id', 'synthetic-operator']);
    assert.equal(call[1].KAREO_OPERATOR_KEY, 'synthetic-personal-key');
    assert.ok(call[2].operatorRepo);
    assert.ok(call[2].journal);
    assert.ok(call[2].replayRepo);
  }
});

test('a missing independent journal cannot fall back to database-only cleanup',async()=>{
  let called=false;
  assert.equal(await cleanupStaging({mode:'commit',env,log:()=>{},error:()=>{},
    loadCli:async()=>({runCleanupCli:async()=>{called=true;return 0;},journal:{}})}),1);
  assert.equal(called,false);
});

test('an authentication failure remains failure and database details never reach shared logs', async () => {
  const output = [];
  const collect = m => output.push(m);
  assert.equal(await cleanupStaging({ mode: 'commit', env, log: collect, error: collect,
    loadCli: async () => ({ runCleanupCli: async () => 1 }) }), 1);
  assert.equal(await cleanupStaging({ mode: 'commit', env, log: collect, error: collect,
    loadCli: async () => { throw Error('phone=0912345678 token=private-value SQL sensitive'); } }), 1);
  assert.ok(!output.join('\n').includes('0912345678'));
  assert.ok(!output.join('\n').includes('private-value'));
});
