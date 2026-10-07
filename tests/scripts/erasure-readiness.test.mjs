import test from 'node:test';
import assert from 'node:assert/strict';
import { checkErasureReadiness, createCountObserver, TARGET } from '../../scripts/check-erasure-readiness.mjs';
import { validateReceipt } from '../../apps/api/src/privacy/deletionJournal.ts';

const env = { SUPABASE_URL: `https://${TARGET.projectRef}.supabase.co`, NETLIFY_SITE_ID: TARGET.siteId,
  KAREO_OPERATOR_ID: TARGET.operatorId, SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC-SERVICE',
  NETLIFY_AUTH_TOKEN: 'SYNTHETIC-NETLIFY', KAREO_OPERATOR_KEY: 'SYNTHETIC-OPERATOR' };
const receipt = { schemaVersion: 1, projectRef: TARGET.projectRef, sessionId: 'SES-SYNTHETIC-ONLY',
  action: 'USER_DELETED', requestedAt: '2026-01-01T00:00:00Z' };
const clean = { assessments: 0, profiles: 0, recommendationRuns: 0, recommendationItems: 0,
  receiptSessions: 1, disabledReceiptSessions: 1, openReceiptLeads: 0, receiptContactFields: 0,
  retainedReceiptLeads: 0, retainedReceiptConsents: 0 };
function fixture({ rows = [receipt], values = clean, ...override } = {}) {
  const calls = [];
  return { calls, deps: {
    authorize: async () => { calls.push('authorize'); },
    verifySite: async () => { calls.push('site'); }, validateReceipt,
    journal: { projectRef: TARGET.projectRef, readAll: async () => { calls.push('journal'); return rows; } },
    observe: async ids => { calls.push('observe'); assert.deepEqual(ids, rows.length ? [receipt.sessionId] : []); return values; },
    ...override,
  } };
}
const run = (f, override = {}) => checkErasureReadiness({ env, load: async () => f.deps, ...override });

test('authentication precedes all journal I/O and repeats; observed erasure never authorizes retirement', async () => {
  const f = fixture(); const { exitCode, report } = await run(f);
  assert.equal(exitCode, 0);
  assert.deepEqual(f.calls, ['authorize', 'site', 'journal', 'observe', 'authorize', 'observe', 'journal', 'authorize']);
  assert.equal(report.currentErasure, 'OBSERVED_HEALTH_AND_OUTREACH_ERASURE');
  assert.equal(report.receiptPurgeAllowed, false); assert.equal(report.activationAllowed, false);
  assert.equal(report.physicalRestoreVerified, false);
  assert.equal(report.backupRequirements.length, 6);
  assert.ok(report.backupRequirements.every(r => r.status === 'PENDING'));
  const text = JSON.stringify(report);
  for (const forbidden of [receipt.sessionId, receipt.requestedAt, ...Object.values(env).filter(v => v.startsWith('SYNTHETIC-'))]) {
    assert.ok(!text.includes(forbidden));
  }
});

test('wrong project, site, operator or missing key stops before dependency loading', async () => {
  for (const change of [{ SUPABASE_URL: 'https://wrong.supabase.co' }, { NETLIFY_SITE_ID: 'wrong' },
    { KAREO_OPERATOR_ID: 'wrong' }, { KAREO_OPERATOR_KEY: '' }]) {
    let loaded = false;
    const result = await checkErasureReadiness({ env: { ...env, ...change }, load: async () => { loaded = true; } });
    assert.equal(result.exitCode, 1); assert.equal(loaded, false);
    assert.equal(result.report.stoppedAt, 'CONFIGURATION');
  }
});

test('invalid operator never touches the journal and provider exceptions are sanitized', async () => {
  const f = fixture({ authorize: async () => { throw Error('private-key-and-phone'); } });
  const result = await run(f);
  assert.equal(result.exitCode, 1); assert.equal(result.report.stoppedAt, 'AUTHORIZATION');
  assert.deepEqual(f.calls, []); assert.ok(!JSON.stringify(result).includes('private-key-and-phone'));
});

test('invalid/foreign/duplicate receipt or journal transport failure stops without database observation', async () => {
  for (const rows of [[{ ...receipt, projectRef: 'another' }], [{ ...receipt, phone: 'private-phone' }],
    [{ ...receipt, requestedAt: '2999-01-01' }], [receipt, receipt]]) {
    const f = fixture({ rows }); const result = await run(f);
    assert.equal(result.exitCode, 1); assert.ok(!f.calls.includes('observe'));
  }
  const f = fixture({ journal: { projectRef: TARGET.projectRef, readAll: async () => { throw Error('secret'); } } });
  assert.equal((await run(f)).report.stoppedAt, 'JOURNAL_READ');
});

test('restored active session, health leftovers, open outreach and retained contacts never pass erasure', async () => {
  for (const change of [{ disabledReceiptSessions: 0 }, { assessments: 1 }, { profiles: 1 },
    { recommendationRuns: 1 }, { recommendationItems: 1 },
    { openReceiptLeads: 1, retainedReceiptLeads: 1 }, { receiptContactFields: 1, retainedReceiptLeads: 1 }]) {
    const result = await run(fixture({ values: { ...clean, ...change } }));
    assert.equal(result.exitCode, 0); // A successful read is not an erasure/release PASS.
    assert.equal(result.report.currentErasure, 'NOT_ESTABLISHED');
    assert.equal(result.report.receiptPurgeAllowed, false);
  }
});

test('terminal cases and consent evidence remain explicitly counted rather than claimed fully erased', async () => {
  const result = await run(fixture({ values: { ...clean, retainedReceiptLeads: 2, retainedReceiptConsents: 3 } }));
  assert.equal(result.report.observedCounts.retainedReceiptLeads, 2);
  assert.equal(result.report.observedCounts.retainedReceiptConsents, 3);
  assert.ok(result.report.limitations.includes('RETAINED_CASE_AND_CONSENT_RECORDS_ARE_NOT_FULL_ERASURE'));
  assert.equal(result.report.receiptPurgeAllowed, false);
});

test('an empty journal supplies no per-receipt erasure proof', async () => {
  const result = await run(fixture({ rows: [], values: { ...clean, receiptSessions: 0, disabledReceiptSessions: 0 } }));
  assert.equal(result.report.currentErasure, 'NO_RECEIPTS_TO_CHECK');
});

test('null/negative/missing/extra/inconsistent counts are rejected, never coerced to zero', async () => {
  for (const values of [{ ...clean, assessments: null }, { ...clean, profiles: -1 },
    { ...clean, receiptSessions: 2 }, { ...clean, disabledReceiptSessions: 2 },
    { ...clean, privatePhone: 'secret' }, { ...clean, retainedReceiptLeads: undefined }]) {
    const result = await run(fixture({ values }));
    assert.equal(result.exitCode, 1); assert.equal(result.report.currentErasure, 'NOT_ESTABLISHED');
    assert.ok(!('observedCounts' in result.report));
  }
});

test('changed counts/journal and revoked operator during recheck stop the report', async () => {
  let reads = 0;
  const changedCounts = fixture({ observe: async () => ++reads === 1 ? clean : { ...clean, assessments: 1 } });
  assert.equal((await run(changedCounts)).report.stoppedAt, 'OBSERVATIONS_CHANGED');
  reads = 0;
  const changedJournal = fixture({ journal: { projectRef: TARGET.projectRef,
    readAll: async () => ++reads === 1 ? [receipt] : [{ ...receipt, action: 'CONSENT_WITHDRAWN' }] } });
  assert.equal((await run(changedJournal)).exitCode, 1);
  let authorizations = 0;
  const revoked = fixture({ authorize: async () => { if (++authorizations > 1) throw Error('revoked'); } });
  assert.equal((await run(revoked)).exitCode, 1);
});

test('the observer uses exact HEAD counts only, bounds ID batches and never fetches data or performs mutations', async () => {
  const queries = [];
  const client = { from(table) {
    const q = { table, filters: [] };
    queries.push(q);
    const builder = {
      select: (columns, options) => { q.columns = columns; q.options = options; return builder; },
      in: (key, ids) => { q.filters.push(['in', key, ids]); return builder; },
      eq: (...args) => { q.filters.push(['eq', ...args]); return builder; },
      not: (...args) => { q.filters.push(['not', ...args]); return builder; },
      or: (...args) => { q.filters.push(['or', ...args]); return builder; },
      abortSignal: async signal => { assert.ok(signal instanceof AbortSignal); return { error: null, count: 0 }; },
    };
    return builder;
  } };
  const ids = Array.from({ length: 101 }, (_, i) => `SES-SYNTHETIC-${i}`);
  const value = await createCountObserver(client)(ids);
  assert.equal(queries.length, 16);
  assert.ok(Object.values(value).every(n => n === 0));
  for (const q of queries) {
    assert.equal(q.columns, 'id'); assert.deepEqual(q.options, { head: true, count: 'exact' });
    for (const filter of q.filters.filter(f => f[0] === 'in')) assert.ok(filter[2].length <= 100);
  }
  assert.ok(queries.some(q => q.filters.some(f => f[0] === 'not' && f[3] === '(CLOSED,CANCELLED)')));
  assert.ok(queries.some(q => q.filters.some(f => f[0] === 'or' && f[1].includes('contact_phone.not.is.null'))));
});

test('a successful HTTP response without an exact count stops the real observer', async () => {
  for (const result of [{ error: null, count: null }, { error: { message: 'SQL-private' }, count: 0 }]) {
    const client = { from: () => ({ select: () => ({ abortSignal: async () => result }) }) };
    await assert.rejects(createCountObserver(client)([]), /COUNT_QUERY_FAILED/);
  }
});
