import { createHash } from 'node:crypto';

// Connector-only fixture coordination. No credential or plaintext token enters SQL.
// Each update locks and verifies the exact newly created, empty, ACTIVE Session.
export function fixtureExpirySql(fixture, action) {
  if (!/^SES-[A-Z0-9]+$/.test(fixture.sessionId ?? '')
    || !/^[A-Za-z0-9_-]{43}$/.test(fixture.sessionToken ?? '')
    || !Number.isFinite(Date.parse(fixture.createdAt)) || !['expire', 'restore'].includes(action)) {
    throw new Error('INVALID_EMPTY_FIXTURE');
  }
  const id = fixture.sessionId, hash = createHash('sha256').update(fixture.sessionToken).digest('hex');
  const created = new Date(fixture.createdAt).toISOString();
  return `do $fixture$
begin
  perform set_config('lock_timeout','3s',true);
  perform set_config('role','service_role',true);
  perform 1 from public.sessions where id='${id}' and token_hash='${hash}'
    and created_at='${created}'::timestamptz and created_at > now()-interval '30 minutes'
    and status='ACTIVE' for update;
  if not found then raise exception 'OWNED_RECENT_ACTIVE_FIXTURE_REQUIRED'; end if;
  if exists(select 1 from public.consents where session_id='${id}')
    or exists(select 1 from public.assessments where session_id='${id}')
    or exists(select 1 from public.leads where session_id='${id}') then
    raise exception 'FIXTURE_HAS_PERSONAL_DATA';
  end if;
  update public.sessions set expires_at=now()${action === 'expire' ? "-interval '1 minute'" : "+interval '5 minutes'"}
    where id='${id}';
end;
$fixture$;`;
}

export async function verifyTokenExpiry({ call, coordinate }) {
  const probes = [], cleanup = [];
  let fixture, expired = false;
  const probe = async (name, token, expectedStatus, expectedCode) => {
    const r = await call('POST', '/api/v1/assessments', {
      ...(token !== undefined ? { token } : {}), body: { sessionId: fixture.sessionId },
    });
    const passed = r.status === expectedStatus && r.json?.success === false && r.json?.error?.code === expectedCode;
    probes.push({ name, status: passed ? 'PASS' : 'FAIL', httpStatus: r.status,
      code: typeof r.json?.error?.code === 'string' ? r.json.error.code : null });
  };
  try {
    const created = await call('POST', '/api/v1/session');
    fixture = created.json?.data;
    if (created.status !== 200 || created.json?.success !== true
      || !Number.isFinite(Date.parse(fixture?.expiresAt)) || Date.parse(fixture?.expiresAt) <= Date.now()) throw Error('INVALID_SESSION');
    fixtureExpirySql(fixture, 'expire'); // Validate before any coordination.
    await probe('missing token', undefined, 401, 'SESSION_INVALID');
    await probe('malformed token', 'invalid', 401, 'SESSION_INVALID');
    await probe('forged token', 'x'.repeat(43), 401, 'SESSION_INVALID');
    await probe('valid unconsented token before expiry', fixture.sessionToken, 403, 'CONSENT_REQUIRED');
    // Restoration is required even if coordination throws after applying the SQL.
    expired = true;
    await coordinate('expire', fixtureExpirySql(fixture, 'expire'));
    await probe('actual expired fixture token', fixture.sessionToken, 401, 'SESSION_INVALID');
  } catch {
    probes.push({ name: 'execution', status: 'FAIL', evidence: 'Stopped safely; no raw exception or fixture token recorded.' });
  } finally {
    if (fixture?.sessionToken) {
      try {
        if (expired) await coordinate('restore', fixtureExpirySql(fixture, 'restore'));
        const r = await call('DELETE', '/api/v1/session', { token: fixture.sessionToken });
        const again = await call('DELETE', '/api/v1/session', { token: fixture.sessionToken });
        const passed = r.status === 200 && r.json?.success === true
          && r.json?.data?.status === 'DELETION_REQUESTED'
          && again.status === 401 && again.json?.error?.code === 'SESSION_INVALID';
        cleanup.push({ status: passed ? 'REQUEST_ACCEPTED' : 'FAILED', physicalDeletionVerified: false });
      } catch { cleanup.push({ status: 'FAILED', physicalDeletionVerified: false }); }
      fixture.sessionToken = '';
    }
  }
  const complete = probes.length === 5 && probes.every(p => p.status === 'PASS')
    && cleanup.length === 1 && cleanup[0].status === 'REQUEST_ACCEPTED';
  return { probes, cleanup, results: [{ caseId: 'E2E-17', status: complete ? 'PASS' : 'FAIL',
    evidence: 'Actual missing/malformed/forged/expired-token rejection, with a valid-token control. Expiry is controlled only on a recent owned empty acceptance fixture through guarded connector SQL; this does not measure elapsed 7/30-day lifetime. No consent or personal payload; deletion requested separately.' }] };
}
