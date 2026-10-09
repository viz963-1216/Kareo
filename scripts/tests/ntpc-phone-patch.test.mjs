import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tests/db/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
const changes = JSON.parse(readFileSync(new URL('../../data/providers/qa/ntpc-phone-corrections-2026-10-09.json', import.meta.url))).changes;
const patch = readFileSync(new URL('../../data/providers/qa/ntpc-phone-correction.sql', import.meta.url), 'utf8');
async function fixture() {
  const db = new PGlite();
  await db.exec('CREATE TABLE providers (id text primary key, phone text, address text);');
  for (const row of changes) await db.query('INSERT INTO providers VALUES ($1,$2,$3)', [row.id,row.before,'protected address']);
  await db.query('INSERT INTO providers VALUES ($1,$2,$3)', ['original-provider','02-1234-5678','original address']);
  return db;
}
test('reviewed 19-phone patch corrects phones, preserves unrelated fields and is repeatable',async()=>{
  const db=await fixture();
  try {
    await db.exec(patch);
    const first=(await db.query('SELECT * FROM providers ORDER BY id')).rows;
    for(const x of changes) assert.deepEqual(first.find(p=>p.id===x.id),{id:x.id,phone:x.after,address:'protected address'});
    assert.deepEqual(first.find(p=>p.id==='original-provider'),{id:'original-provider',phone:'02-1234-5678',address:'original address'});
    await db.exec(patch);
    assert.deepEqual((await db.query('SELECT * FROM providers ORDER BY id')).rows,first);
  } finally { await db.close(); }
});
test('missing or independently changed reviewed row rejects the entire patch',async()=>{
  for(const missing of [false,true]) {
    const db=await fixture();
    try {
      await db.query(missing?'DELETE FROM providers WHERE id=$1':'UPDATE providers SET phone=\'02-9999-9999\' WHERE id=$1',[changes.at(-1).id]);
      const before=(await db.query('SELECT * FROM providers ORDER BY id')).rows;
      await assert.rejects(db.exec(patch),/phone baseline differs/);
      assert.deepEqual((await db.query('SELECT * FROM providers ORDER BY id')).rows,before);
    } finally { await db.close(); }
  }
});
