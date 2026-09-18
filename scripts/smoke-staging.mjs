import assert from 'node:assert/strict';
const base = new URL(process.argv[2] ?? '');
assert.equal(base.protocol, 'https:', 'Use the HTTPS staging URL');
async function post(path, body) {
  const response = await fetch(new URL(path, base), {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  return {response, result};
}
const {response: sr, result: session} = await post('/api/v1/session');
assert.ok(sr.ok && session.success, 'Session creation failed');
assert.equal(typeof session.data.sessionId, 'string');
const body = {sessionId:session.data.sessionId,disclaimerVersion:'deployment-smoke-test',privacyVersion:'deployment-smoke-test',termsVersion:'deployment-smoke-test',accepted:false};
const rejected = await post('/api/v1/consent', body);
assert.equal(rejected.result.success, false);
assert.equal(rejected.result.error.code, 'VALIDATION_ERROR');
const accepted = await post('/api/v1/consent', {...body,accepted:true});
assert.ok(accepted.response.ok && accepted.result.success, 'Consent creation failed');
assert.equal(typeof accepted.result.data.consentId, 'string');
const missing = await fetch(new URL('/api/v1/not-implemented', base));
assert.equal(missing.status, 404);
assert.equal((await missing.json()).error.code, 'NOT_FOUND');
console.log(JSON.stringify({sessionId:session.data.sessionId,consentId:accepted.result.data.consentId,result:'PASS'},null,2));
