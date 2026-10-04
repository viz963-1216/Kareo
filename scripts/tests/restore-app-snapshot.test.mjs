import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { insertSnapshotRows, verifyRestoredTables } from '../restore-app-snapshot.mjs';
const require = createRequire(new URL('../../tests/db/package.json', import.meta.url));
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);

test('equal counts with changed content fail full-row verification', async () => {
  const db = new PGlite();
  try {
    await db.exec("create table records(id text primary key, value jsonb); insert into records values ('one','{\"amount\":99}')");
    const [result] = await verifyRestoredTables(db, { records: [{ id: 'one', value: { amount: 10 } }] });
    assert.equal(result.expected, result.restored);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.missing, 1);
    assert.equal(result.extra, 1);
  } finally { await db.close(); }
});

test('extra rows and absent rows are detected in both directions', async () => {
  const db = new PGlite();
  try {
    await db.exec("create table records(id text); insert into records values ('extra'), ('extra')");
    const [result] = await verifyRestoredTables(db, { records: [{ id: 'missing' }] });
    assert.equal(result.status, 'FAIL');
    assert.equal(result.missing, 1);
    assert.equal(result.extra, 2);
  } finally { await db.close(); }
});

test('timestamps compare by typed value rather than display timezone', async () => {
  const db = new PGlite();
  try {
    await db.exec("create table records(id text, occurred_at timestamptz); insert into records values ('one','2026-10-04T12:00:00+08:00')");
    const [result] = await verifyRestoredTables(db, { records: [{ id: 'one', occurred_at: '2026-10-04T04:00:00Z' }] });
    assert.equal(result.status, 'PASS');
  } finally { await db.close(); }
});

async function cycleDb() {
  const db = new PGlite();
  await db.exec(`create table runs(id text primary key, snapshot_id text);
    create table snapshots(id text primary key, run_id text references runs(id));
    alter table runs add constraint runs_snapshot_fk foreign key(snapshot_id) references snapshots(id)`);
  return db;
}

test('valid cyclic references restore and retain original immediate FK enforcement', async () => {
  const db = await cycleDb();
  try {
    const rows = { runs: [{ id: 'r', snapshot_id: 's' }], snapshots: [{ id: 's', run_id: 'r' }] };
    await insertSnapshotRows(db, rows);
    assert.ok((await verifyRestoredTables(db, rows)).every(r => r.status === 'PASS'));
    const { rows: constraints } = await db.query("select condeferrable, condeferred from pg_constraint where contype='f'");
    assert.ok(constraints.every(c => !c.condeferrable && !c.condeferred));
    await assert.rejects(db.exec("insert into runs values ('invalid','missing')"));
  } finally { await db.close(); }
});

test('broken references reject the full transaction and leave every table empty', async () => {
  const db = await cycleDb();
  try {
    await assert.rejects(insertSnapshotRows(db, {
      runs: [{ id: 'r', snapshot_id: 'missing' }], snapshots: [{ id: 's', run_id: 'r' }],
    }));
    for (const table of ['runs', 'snapshots']) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
    assert.ok((await db.query("select condeferrable from pg_constraint where contype='f'")).rows.every(c => !c.condeferrable));
  } finally { await db.close(); }
});

test('a table name cannot inject SQL into verification', async () => {
  const db = new PGlite();
  try {
    await db.exec('create table records(id text)');
    await assert.rejects(verifyRestoredTables(db, { 'records; drop table records': [] }), /Invalid application table/);
    assert.equal((await db.query("select count(*)::int n from pg_tables where tablename='records'")).rows[0].n, 1);
  } finally { await db.close(); }
});
