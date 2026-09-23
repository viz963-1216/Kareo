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

// B-007 external link (J-003): must return the Kareocar URL and never embed it.
const transport = await (await fetch(new URL('/api/v1/external-services/transportation', base))).json();
assert.equal(transport.success, true, 'Transportation route failed');
assert.equal(transport.data.url, 'https://kareocar.netlify.app/');
assert.equal(transport.data.openMode, 'NEW_TAB');

// Assessment is opt-in (--with-assessment) because once B-010 is live it calls the paid AI provider.
let assessment = 'SKIPPED';
if (process.argv.includes('--with-assessment')) {
  const {response: ar, result: a} = await post('/api/v1/assessments', {
    sessionId: session.data.sessionId, ageRange: '75_84',
    location: {city: '新北市', district: '三重區', precision: 'DISTRICT', lat: null, lng: null},
    livingSituation: 'WITH_FAMILY', caregiverSituation: 'FAMILY_LIMITED', mobilityLevel: 'NEEDS_ASSISTANCE',
    dailyLivingLevel: 'PARTIAL_ASSISTANCE',
    needs: {homeCare: 'YES', medicalNursing: 'UNKNOWN', assistiveDevice: 'YES', transportation: 'YES'},
    freeText: 'deployment-smoke-test synthetic record',
  });
  if (a.success) {
    assert.ok(a.data.careNeedProfile.warnings.length > 0, 'Assessment warnings missing');
    assert.ok(!/^KB-(MOCK|TEST)/.test(a.data.knowledgeVersion), 'Assessment used a mock/test knowledge version');
    assessment = `PASS ${a.data.assessmentId} ${a.data.knowledgeVersion}`;
  } else {
    // Not a pass: the flow is blocked at this step. Report it explicitly.
    assert.ok(['KNOWLEDGE_UNAVAILABLE', 'AI_UNAVAILABLE'].includes(a.error.code), `Unexpected assessment error ${ar.status} ${a.error.code}`);
    assessment = `BLOCKED ${a.error.code}`;
  }
}
console.log(JSON.stringify({sessionId:session.data.sessionId,consentId:accepted.result.data.consentId,transportation:'PASS',assessment,result:assessment.startsWith('BLOCKED') ? 'PARTIAL' : 'PASS'},null,2));
