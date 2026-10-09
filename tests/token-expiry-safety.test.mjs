import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureExpirySql, verifyTokenExpiry } from './e2e/token-expiry-checks.mjs';

const fixture = { sessionId: 'SES-SYNTHETIC', sessionToken: 't'.repeat(43), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+3600000).toISOString() };
test('SQL accepts only exact safe fixture identities, keeps token out, locks and requires no personal data', () => {
  const sql = fixtureExpirySql(fixture, 'expire');
  assert.ok(!sql.includes(fixture.sessionToken));
  for (const part of ['for update', 'token_hash=', "status='ACTIVE'", 'public.consents', 'public.assessments', 'public.leads']) assert.ok(sql.includes(part));
  assert.throws(() => fixtureExpirySql({ ...fixture, sessionId: "SES-X';delete from sessions;--" }, 'expire'));
  assert.throws(() => fixtureExpirySql(fixture, 'delete'));
});
for (const broken of [false, true]) test(`expiry ${broken ? 'incorrectly accepted counterexample fails' : 'rejected'}; always restore and request cleanup`, async () => {
  let expired = false, deletes = 0; const actions = [];
  const checked = await verifyTokenExpiry({
    coordinate: async action => { actions.push(action); expired = action === 'expire'; },
    call: async (method, path, options={}) => {
      if (path.endsWith('/session') && method === 'POST') return { status: 200, json: { success: true, data: { ...fixture } } };
      if (method === 'DELETE') return ++deletes === 1
        ? { status: 200, json: { success: true, data: { status: 'DELETION_REQUESTED' } } }
        : { status: 401, json: { success: false, error: { code: 'SESSION_INVALID' } } };
      assert.deepEqual(options.body, { sessionId: fixture.sessionId });
      const invalid = options.token !== fixture.sessionToken || (expired && !broken);
      return { status: invalid ? 401 : 403, json: { success: false, error: { code: invalid ? 'SESSION_INVALID' : 'CONSENT_REQUIRED' } } };
    },
  });
  assert.deepEqual(actions, ['expire', 'restore']); assert.equal(deletes, 2);
  assert.equal(checked.results[0].status, broken ? 'FAIL' : 'PASS');
  assert.ok(!JSON.stringify(checked).includes(fixture.sessionToken));
  assert.ok(!JSON.stringify(checked).includes(fixture.sessionId));
});

test('coordination failure after expiry still attempts restoration and cleanup without claiming PASS', async () => {
  const actions = []; let deletes = 0;
  const checked = await verifyTokenExpiry({
    coordinate: async action => { actions.push(action); if (action === 'expire') throw Error('applied SQL then transport failed'); },
    call: async (method, path, options={}) => {
      if (method === 'POST' && path.endsWith('/session')) return { status:200, json:{success:true,data:{...fixture}} };
      if (method === 'DELETE') return ++deletes === 1
        ? {status:200,json:{success:true,data:{status:'DELETION_REQUESTED'}}}
        : {status:401,json:{success:false,error:{code:'SESSION_INVALID'}}};
      const valid = options.token === fixture.sessionToken;
      return {status:valid?403:401,json:{success:false,error:{code:valid?'CONSENT_REQUIRED':'SESSION_INVALID'}}};
    },
  });
  assert.deepEqual(actions,['expire','restore']); assert.equal(deletes,2);
  assert.equal(checked.results[0].status,'FAIL'); assert.equal(checked.cleanup[0].status,'REQUEST_ACCEPTED');
});
