// Narrow diagnostic: creates empty disposable Sessions, sends only a sessionId
// to the consent-denial path, and requests deletion. Never sends consent,
// health/location/contact data, recommendations or Leads. Not full MVP acceptance.
export async function verifyFoundation({ call, now = () => Date.now() }) {
  const results = [], fixtures = [], cleanup = [];
  let currentCase = 'E2E-21';
  const record = (caseId, status, evidence) => results.push({ caseId, status, evidence });
  const code = r => r.json?.error?.code;
  try {
    const unknown = await call('GET', '/api/v1/j003-foundation-unknown');
    record('E2E-21', unknown.status === 404 && unknown.json?.success === false && code(unknown) === 'NOT_FOUND' ? 'PASS' : 'FAIL',
      'Unknown API must return JSON 404 / NOT_FOUND.');
    currentCase = 'E2E-01';
    const created = await call('POST', '/api/v1/session');
    const data = created.json?.data;
    if (typeof data?.sessionToken === 'string') fixtures.push(data.sessionToken);
    const valid = created.status === 200 && created.json?.success === true
      && /^SES-[A-Z0-9]+$/.test(data?.sessionId ?? '') && /^[A-Za-z0-9_-]{43}$/.test(data?.sessionToken ?? '')
      && Number.isFinite(Date.parse(data.createdAt)) && Date.parse(data.createdAt) <= now() + 5000
      && Number.isFinite(Date.parse(data.expiresAt)) && Date.parse(data.expiresAt) > now();
    record('E2E-01', valid ? 'PASS' : 'FAIL', valid
      ? 'Real empty Session returned a sessionId, 43-character possession token, createdAt and future expiresAt; no token is recorded.'
      : 'Empty Session response violates the session contract; no health or contact data was sent.');
    if (!valid) return { results, cleanup };
    currentCase = 'E2E-03';
    const denied = await call('POST', '/api/v1/assessments', { token: data.sessionToken, body: { sessionId: data.sessionId } });
    record('E2E-03', denied.status === 403 && denied.json?.success === false && code(denied) === 'CONSENT_REQUIRED' ? 'PASS' : 'FAIL',
      'An unconsented real Session submitted only its ID; the consent gate must reject before assessment-input parsing with 403 / CONSENT_REQUIRED.');
    currentCase = 'E2E-17';
    const forged = await call('POST', '/api/v1/assessments', { token: 'x'.repeat(43), body: { sessionId: data.sessionId } });
    record('E2E-17', forged.status === 401 && forged.json?.success === false && code(forged) === 'SESSION_INVALID' ? 'PENDING' : 'FAIL',
      'Forged-token rejection checked; genuine expiry and all other token cases remain unverified.');
    record('E2E-02', 'PENDING', 'No consent is submitted; D-05 ACTIVE and valid/DRAFT/refusal cases are outside this diagnostic.');
  } catch {
    record(currentCase, 'FAIL', 'Foundation request failed; raw exceptions, IDs and tokens are not recorded.');
  } finally {
    for (const token of fixtures) {
      try {
        const deleted = await call('DELETE', '/api/v1/session', { token });
        const repeat = await call('DELETE', '/api/v1/session', { token });
        const deadline = Date.parse(deleted.json?.data?.deletionScheduledBefore);
        const accepted = deleted.status === 200 && deleted.json?.success === true
          && deleted.json?.data?.status === 'DELETION_REQUESTED' && deadline > now() && deadline <= now() + 7 * 86400000 + 5000
          && repeat.status === 401 && repeat.json?.success === false && code(repeat) === 'SESSION_INVALID';
        cleanup.push({ emptySessionDeletionAcceptedAndTokenDisabled: accepted,
          physicalDeletionVerified: false, status: accepted ? 'REQUEST_ACCEPTED' : 'FAILED' });
      } catch { cleanup.push({ status: 'FAILED', physicalDeletionVerified: false }); }
    }
    fixtures.fill('');
    // This is only an empty-session deletion, not the full health/GPS/Lead case.
    record('E2E-37', cleanup.length && cleanup.every(c => c.status === 'REQUEST_ACCEPTED') ? 'PENDING' : 'FAIL',
      'Empty Session deletion and token invalidation checked separately; persisted assessment/coordinates/Lead cleanup still needs full E2E.');
  }
  return { results, cleanup };
}
