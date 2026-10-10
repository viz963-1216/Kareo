import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFoundation } from './e2e/foundation-checks.mjs';

const at = Date.parse('2026-10-09T08:00:00Z'), token = 't'.repeat(43), sessionId = 'SES-SYNTHETIC';
const good = { status: 200, json: { success: true, data: { sessionId, sessionToken: token,
  createdAt: new Date(at).toISOString(), expiresAt: new Date(at + 3600000).toISOString() } } };
const error = (status, code) => ({ status, json: { success: false, error: { code } } });
function transport({ failAssessment = false, invalidSession = false } = {}) {
  const observed = [];
  const call = async (method, path, options = {}) => {
    observed.push({ method, path, ...options });
    if (method === 'GET') return error(404, 'NOT_FOUND');
    if (method === 'POST' && path.endsWith('/session')) return invalidSession ? { ...good, json: { success: true, data: { sessionToken: token } } } : good;
    if (method === 'DELETE') {
      if (observed.filter(r => r.method === 'DELETE').length > 1) return error(401, 'SESSION_INVALID');
      return { status: 200, json: { success: true, data: { status: 'DELETION_REQUESTED', deletionScheduledBefore: new Date(at + 7 * 86400000).toISOString() } } };
    }
    if (failAssessment) throw Error('private-token-' + token);
    return options.token === token ? error(403, 'CONSENT_REQUIRED') : error(401, 'SESSION_INVALID');
  };
  return { call, observed };
}
test('only empty Sessions and ID-only consent-denial requests; no tokens/IDs in result; full cases remain pending', async () => {
  const { call, observed } = transport();
  const r = await verifyFoundation({ call, now: () => at });
  for (const request of observed.filter(r => r.body)) assert.deepEqual(request.body, { sessionId });
  assert.ok(observed.every(r => !/consent|leads|recommendations/.test(r.path)));
  assert.equal(observed.filter(r => r.method === 'DELETE').length, 2);
  assert.ok(!JSON.stringify(r).includes(token)); assert.ok(!JSON.stringify(r).includes(sessionId));
  assert.deepEqual(r.results.filter(r => r.status === 'PASS').map(r => r.caseId), ['E2E-21', 'E2E-01', 'E2E-03']);
  assert.equal(r.results.find(r => r.caseId === 'E2E-37').status, 'PENDING');
  assert.equal(r.results.find(r => r.caseId === 'E2E-17').status, 'PENDING');
});
test('always requests cleanup after a failed negative probe; no raw exception/token leaks', async () => {
  const { call, observed } = transport({ failAssessment: true });
  const r = await verifyFoundation({ call, now: () => at });
  assert.equal(observed.filter(r => r.method === 'DELETE').length, 2);
  assert.ok(r.results.some(r => r.status === 'FAIL'));
  assert.equal(new Set(r.results.map(r => r.caseId)).size, r.results.length);
  assert.ok(!JSON.stringify(r).includes(token));
});
test('invalid Session response never enters assessment path, but still cleans up any returned token', async () => {
  const { call, observed } = transport({ invalidSession: true });
  const r = await verifyFoundation({ call, now: () => at });
  assert.equal(observed.filter(r => r.path.endsWith('/assessments')).length, 0);
  assert.equal(observed.filter(r => r.method === 'DELETE').length, 2);
  assert.ok(r.results.some(r => r.caseId === 'E2E-01' && r.status === 'FAIL'));
});
