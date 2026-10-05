import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDatabaseUrl } from '../local/stack.mjs';

test('local integration rejects cloud URLs, credential overrides and non-disposable databases before connecting', () => {
  const local = 'postgresql://kareo_test:synthetic@127.0.0.1:5432/kareo_local_integration_test';
  assert.equal(localDatabaseUrl(local,'1').hostname,'127.0.0.1');
  for (const url of [local.replace('127.0.0.1','db.example.com'),local.replace('127.0.0.1','localhost'),
    local.replace('kareo_local_integration_test','postgres'),local.replace('kareo_test:','postgres:'),
    local+'?host=db.example.com',local+'#override',local.replace('postgresql:','https:')]) {
    assert.throws(()=>localDatabaseUrl(url,'1'));
  }
  assert.throws(()=>localDatabaseUrl(local,undefined));
});
