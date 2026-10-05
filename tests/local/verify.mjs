// Local HTTP integration evidence; never a deployed E2E result or release gate input.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { TEST_CONSENT, LOCAL_OPERATOR } from './stack.mjs';
import { captureSyntheticSnapshot, restoreAndReplaySyntheticDeletion } from './restore-delete.mjs';

const district = { city: '新北市', district: '三重區', precision: 'DISTRICT', lat: null, lng: null };
const none = { city: null, district: null, precision: 'NONE', lat: null, lng: null };
export const assessmentBody = (sessionId, location = district) => ({ sessionId, location, ageRange: '75_84',
  livingSituation: 'WITH_FAMILY', caregiverSituation: 'FAMILY_LIMITED', mobilityLevel: 'NEEDS_ASSISTANCE', dailyLivingLevel: 'PARTIAL_ASSISTANCE',
  needs: { homeCare: 'YES', medicalNursing: 'UNKNOWN', assistiveDevice: 'YES', transportation: 'YES' }, disabilityCertificate: 'YES', incomeCategory: 'LOW_INCOME', freeText: '本機虛構情境，非真人資料。' });

export async function verifyLocalStack(stack) {
  const { baseUrl, db, cli } = stack;
  const startedAt = new Date().toISOString();
  const results = [];
  const restoreRehearsals = [];
  let withdrawalSnapshot, withdrawalReceipt, deletionSnapshot, deletionReceipt;
  async function test(id, detail, operation) {
    try { await operation(); results.push({ id, status: 'PASS', detail }); console.log(`PASS ${id} ${detail}`); }
    catch (e) { results.push({ id, status: 'FAIL', detail, error: e.message }); console.log(`FAIL ${id} ${detail}: ${e.message}`); throw e; }
  }
  const call = async (method, path, { body, token, admin, headers = {} } = {}) => {
    const response = await fetch(baseUrl + path, { method, headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'X-Kareo-Session-Token': token } : {}), ...(admin ? { 'X-Kareo-Admin-Token': admin } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    return { status: response.status, headers: response.headers, json: await response.json() };
  };
  const success = response => { assert.equal(response.status, 200, `HTTP ${response.status} ${response.json?.error?.code}`); assert.equal(response.json.success, true); return response.json.data; };
  const error = (response, status, code) => { assert.equal(response.status, status); assert.equal(response.json.success, false); assert.equal(response.json.error.code, code); };
  const session = async (consent = true) => {
    const s = success(await call('POST', '/api/v1/session'));
    if (consent) success(await call('POST', '/api/v1/consent', { token: s.sessionToken, body: { sessionId: s.sessionId, ...TEST_CONSENT, accepted: true } }));
    return s;
  };
  const assess = async (s, location = district, overrides = {}) => success(await call('POST', '/api/v1/assessments', { token: s.sessionToken, body: { ...assessmentBody(s.sessionId, location), ...overrides } }));
  const recommend = async (s, assessment, serviceType = 'HOME_CARE') => success(await call('POST', '/api/v1/recommendations', { token: s.sessionToken, body: { assessmentId: assessment.assessmentId, serviceType } }));
  let main, mainAssessment, mainRecommendation, lead, adminToken, stalePreview, adminRecords, deletionTargets, deletionAssessments, deletionRuns, healthBefore;
  const legalBefore = createHash('sha256').update(readFileSync('contracts/legal/consent-versions.json')).digest('hex');
  try {
    await test('LOCAL-01', '28 migrations, imported 35 resources / 30 services / 98 areas / 19 contract regions; 5 approved packs / 21 published records', async () => {
      assert.equal(stack.migrations.length, 28);
      const counts = (await db.query(`select (select count(*)::int from providers) providers, (select count(*)::int from provider_services) services,
        (select count(*)::int from provider_service_areas where active) areas, (select count(*)::int from provider_contract_regions) contracts,
        (select count(*)::int from content_packs) packs, (select count(*)::int from knowledge_version_records) records`)).rows[0];
      assert.deepEqual(counts, { providers: 35, services: 30, areas: 98, contracts: 19, packs: 5, records: 21 });
      assert.equal(success(await call('GET', '/api/v1/knowledge/status')).version, 'KB-2026-09-24-001');
    });
    await test('LOCAL-02', 'Official PostgREST JWT role switch denies anon/authenticated table reads and internal RPC', async () => {
      for (const role of ['anon', 'authenticated']) {
        const headers = { Authorization: `Bearer ${stack.jwt(role)}` };
        const read = await fetch(baseUrl + '/rest/v1/sessions?select=id', { headers }); assert.ok([401,403].includes(read.status)); assert.equal((await read.json()).code,'42501');
        const rpc = await fetch(baseUrl + '/rest/v1/rpc/require_writable_session', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: {} }) }); assert.ok([401,403].includes(rpc.status)); assert.equal((await rpc.json()).code,'42501');
      }
    });
    await test('LOCAL-03', 'Unknown API returns JSON NOT_FOUND, not SPA HTML', async () => error(await call('GET', '/api/v1/unknown'), 404, 'NOT_FOUND'));
    await test('LOCAL-38', 'Real frontend build serves homepage and SPA path with an explicit local-test banner', async () => {
      assert.equal(stack.frontendBuilt, true);
      for (const path of ['/', '/assessment']) {
        const response = await fetch(baseUrl + path);
        assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^text\/html/);
        const html = await response.text();
        assert.ok(html.includes('本機隔離測試・合成資料・測試同意版本，非正式上線'));
        assert.match(html, /<script[^>]*src="\/assets\//);
      }
    });
    await test('LOCAL-41', 'Frontend proposal archive is retrievable byte-for-byte, explicitly non-active, with no private approval metadata', async () => {
      const response = await fetch(baseUrl+'/privacy/versions/2026-10-05-r1-proposed.txt');
      assert.equal(response.status,200);
      const bytes = Buffer.from(await response.arrayBuffer());
      const review = JSON.parse(readFileSync('contracts/legal/proposals/2026-10-05-r1.review.json','utf8'));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),review.fullTextSha256);
      assert.deepEqual(bytes,readFileSync(review.fullTextPath));
      const index = await (await fetch(baseUrl+'/privacy/versions/index.json')).json();
      const entry = index.proposals.find(p=>p.version==='2026-10-05-r1');
      assert.equal(entry.status,'PROPOSED_NOT_ACTIVE'); assert.equal(entry.fullTextSha256,review.fullTextSha256);
      assert.ok(!JSON.stringify(index).includes('approvedBy') && !JSON.stringify(index).includes('approvalEvidence'));
    });
    await test('LOCAL-04', 'Public resources are queryable without Session; five centers are not service providers', async () => {
      const list = success(await call('GET', '/api/v1/providers?pageSize=50')); assert.equal(list.totalCount, 35);
      const centers = success(await call('GET', '/api/v1/providers?resourceCategory=ASSISTIVE_DEVICE_CENTER'));
      assert.equal(centers.totalCount, 5); assert.ok(centers.items.every(p => p.resourceCategory === 'ASSISTIVE_DEVICE_CENTER'));
      const bad = await call('GET', '/api/v1/providers?city=' + encodeURIComponent('臺中市')); error(bad, 400, 'VALIDATION_ERROR');
    });
    await test('LOCAL-05', 'Public knowledge lists only current effective records; local jurisdictions stay separate; no internal fields', async () => {
      for (const jurisdiction of ['TAIPEI','NEW_TAIPEI']) {
        const data = success(await call('GET', '/api/v1/knowledge/records?jurisdiction=' + jurisdiction));
        assert.ok(data.items.length > 0); assert.ok(data.items.every(r => r.jurisdiction === jurisdiction));
        assert.ok(data.items.every(r => !('ruleData' in r) && !('contentFingerprint' in r) && r.source?.publisher && 'url' in r.source));
      }
    });
    main = await session(false);
    await test('LOCAL-06', 'Session issues a token, stores only its hash; assessment before consent is rejected', async () => {
      assert.ok(main.sessionToken.length >= 32);
      const stored = (await db.query('select token_hash from sessions where id=$1', [main.sessionId])).rows[0];
      assert.equal(stored.token_hash, createHash('sha256').update(main.sessionToken).digest('hex'));
      error(await call('POST', '/api/v1/assessments', { token: main.sessionToken, body: assessmentBody(main.sessionId) }), 403, 'CONSENT_REQUIRED');
    });
    await test('LOCAL-07', 'Refused, DRAFT and unknown consent are rejected; isolated test combo succeeds', async () => {
      const drafts = JSON.parse(readFileSync('contracts/legal/consent-versions.json')).versions.filter(v => v.status === 'DRAFT');
      assert.ok(drafts.length > 0);
      for (const patch of [{ accepted: false }, ...drafts.map(({disclaimerVersion, privacyVersion, termsVersion}) => ({disclaimerVersion, privacyVersion, termsVersion})), { termsVersion: 'unknown' }]) {
        error(await call('POST', '/api/v1/consent', { token: main.sessionToken, body: { sessionId: main.sessionId, ...TEST_CONSENT, accepted: true, ...patch } }), 400, 'VALIDATION_ERROR');
      }
      success(await call('POST', '/api/v1/consent', { token: main.sessionToken, body: { sessionId: main.sessionId, ...TEST_CONSENT, accepted: true } }));
    });
    await test('LOCAL-08', 'Forged token rejected; another Session cannot impersonate sessionId or read assessment', async () => {
      error(await call('POST', '/api/v1/assessments', { token: 'forged-synthetic-token', body: assessmentBody(main.sessionId) }), 401, 'SESSION_INVALID');
      const other = await session();
      error(await call('POST', '/api/v1/assessments', { token: other.sessionToken, body: assessmentBody(main.sessionId) }), 403, 'FORBIDDEN');
    });
    await test('LOCAL-09', 'Actual rule-based assessment persists Assessment + Profile, published version, warnings and deterministic result', async () => {
      mainAssessment = await assess(main);
      const again = await assess(main);
      assert.equal(mainAssessment.knowledgeVersion, 'KB-2026-09-24-001');
      assert.deepEqual(mainAssessment.careNeedProfile.careNeeds, again.careNeedProfile.careNeeds);
      assert.deepEqual(mainAssessment.careNeedProfile.summary, again.careNeedProfile.summary);
      assert.ok(mainAssessment.careNeedProfile.warnings.length > 0);
      assert.equal((await db.query('select count(*)::int n from care_need_profiles where assessment_id=$1', [mainAssessment.assessmentId])).rows[0].n, 1);
    });
    await test('LOCAL-10', 'District recommendation has explainable Top 3, no distances, same-day order stable', async () => {
      mainRecommendation = await recommend(main, mainAssessment);
      const again = await recommend(main, mainAssessment);
      assert.equal(mainRecommendation.rankingType, 'DISTRICT_ROTATION'); assert.equal(mainRecommendation.providers.length, 3);
      assert.deepEqual(mainRecommendation.providers.map(p => p.id), again.providers.map(p => p.id));
      assert.ok(mainRecommendation.providers.every(p => p.distanceKm === null && p.reasons.length > 0));
    });
    await test('LOCAL-11', 'Provider card/detail identity and Maps match; absent provider returns NOT_FOUND', async () => {
      const card = mainRecommendation.providers[0]; const detail = success(await call('GET', '/api/v1/providers/' + card.id));
      assert.equal(detail.id, card.id); assert.equal(detail.name, card.name); assert.equal(detail.googleMapsUrl, card.googleMapsUrl);
      error(await call('GET', '/api/v1/providers/LOCAL-NOT-FOUND'), 404, 'NOT_FOUND');
    });
    const contact = { name: '本機合成測試', phone: '0912340000' };
    const leadBody = () => ({ sessionId: main.sessionId, assessmentId: mainAssessment.assessmentId, recommendationId: mainRecommendation.recommendationId,
      providerId: mainRecommendation.providers[0].id, serviceType: 'HOME_CARE', contact, contactConsent: true });
    await test('LOCAL-12', 'Lead and idempotency ledger persist together; same-key replay returns same Lead, changed content conflicts', async () => {
      const key = randomUUID(); const opts = { token: main.sessionToken, headers: { 'Idempotency-Key': key }, body: leadBody() };
      lead = success(await call('POST', '/api/v1/leads', opts));
      const repeat = success(await call('POST', '/api/v1/leads', opts)); assert.deepEqual(repeat, lead);
      error(await call('POST', '/api/v1/leads', { ...opts, body: { ...leadBody(), contact: { ...contact, name: '合成不同稱呼' } } }), 409, 'IDEMPOTENCY_CONFLICT');
      const rows = (await db.query('select session_id,assessment_id,recommendation_id,provider_id from leads where id=$1', [lead.leadId])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].session_id, main.sessionId); assert.equal(rows[0].assessment_id, mainAssessment.assessmentId);
      assert.equal((await db.query('select count(*)::int n from lead_idempotency_records where lead_id=$1', [lead.leadId])).rows[0].n, 1);
      assert.ok(!JSON.stringify(lead).includes(contact.phone));
    });
    await test('LOCAL-13', 'Actual operator CLI rejects wrong key, claims contact, updates NEW→CONTACTED→ACCEPTED→CLOSED with audit', async () => {
      await assert.rejects(cli('lead', ['show', lead.leadId], { KAREO_OPERATOR_KEY: 'wrong-synthetic-key' }));
      const shown = JSON.parse(await cli('lead', ['show', lead.leadId])); assert.ok(!('contactPhone' in shown));
      const revealed = JSON.parse(await cli('lead', ['reveal-contact', lead.leadId])); assert.equal(revealed.phone, contact.phone);
      await cli('lead', ['update', lead.leadId, '--to', 'CONTACTED']);
      await cli('lead', ['update', lead.leadId, '--to', 'ACCEPTED']);
      await cli('lead', ['update', lead.leadId, '--to', 'CLOSED', '--reason', 'CONNECTED']);
      await assert.rejects(cli('lead', ['update', lead.leadId, '--to', 'NEW']));
      assert.equal((await db.query('select status from leads where id=$1', [lead.leadId])).rows[0].status, 'CLOSED');
      assert.equal((await db.query('select count(*)::int n from lead_status_events where lead_id=$1', [lead.leadId])).rows[0].n, 3);
    });
    await test('LOCAL-14', 'No-location assessment succeeds with null fields and recommendation returns NO_LOCATION / zero candidates', async () => {
      const s = await session(); const a = await assess(s, none); const r = await recommend(s, a);
      assert.equal(r.rankingType, 'NO_LOCATION'); assert.equal(r.providers.length, 0);
      const row = (await db.query('select city,district,lat,lng from assessments where id=$1', [a.assessmentId])).rows[0];
      assert.deepEqual(row, { city: null, district: null, lat: null, lng: null });
    });
    await test('LOCAL-15', 'City-only and GPS assessments choose CITY_ROTATION and DISTANCE respectively', async () => {
      const s = await session(); const a = await assess(s, { ...district, district: null, precision: 'CITY' }); const r = await recommend(s, a);
      assert.equal(r.rankingType, 'CITY_ROTATION'); assert.ok(r.providers.every(p => p.distanceKm === null));
      const gps = await assess(s, { ...district, precision: 'GPS', lat: 25.061, lng: 121.488 }); const ranked = await recommend(s, gps);
      assert.equal(ranked.rankingType, 'DISTANCE');
      assert.ok(ranked.providers.every(p => typeof p.distanceKm === 'number'));
      assert.deepEqual(ranked.providers.map(p => p.distanceKm), ranked.providers.map(p => p.distanceKm).sort((a,b) => a-b));
    });
    await test('LOCAL-16', 'Taipei/New Taipei assessments use only their own local summary', async () => {
      const s = await session(); const taipei = await assess(s, { ...district, city: '臺北市', district: '中山區' }); const newTaipei = await assess(s);
      const texts = a => JSON.stringify(a.careNeedProfile.summary);
      assert.ok(texts(taipei).includes('臺北市')); assert.ok(texts(newTaipei).includes('新北市'));
      assert.ok(!texts(taipei).includes('新北市：')); assert.ok(!texts(newTaipei).includes('臺北市：'));
    });
    await test('LOCAL-17', 'Unknown service area remains queryable but absent from location-matched recommendation; centers never recommended', async () => {
      const list = success(await call('GET', '/api/v1/providers?serviceType=ASSISTIVE_DEVICE&pageSize=50'));
      const ids = new Set(mainRecommendation.providers.map(p => p.id));
      assert.ok(list.items.some(p => p.serviceAreaStatus === 'UNCONFIRMED'));
      assert.ok(list.items.filter(p => p.serviceAreaStatus === 'UNCONFIRMED').every(p => !ids.has(p.id)));
      const s = await session(); const r = await recommend(s, await assess(s), 'ASSISTIVE_DEVICE');
      assert.ok(r.providers.every(p => !list.items.some(item => item.id === p.id && item.serviceAreaStatus === 'UNCONFIRMED')));
      const centers = success(await call('GET', '/api/v1/providers?resourceCategory=ASSISTIVE_DEVICE_CENTER')).items;
      const centerIds = new Set(centers.map(p => p.id));
      assert.ok(r.providers.every(p => !centerIds.has(p.id)));
    });
    let privacySession, privacyAssessment, privacyLead;
    const privacyRequest = (suffix, action, extra={}) => ({requestId:'PRQ-LOCAL-'+suffix,action,sessionId:privacySession.sessionId,
      receivedAt:new Date(Date.now()-10000).toISOString(),verifiedAt:new Date().toISOString(),verificationMethod:'ORIGINAL_CONTACT_CONFIRMED',verificationRef:'CASE-LOCAL-PRIVACY',...extra});
    const privacyCli = async (name,q,overrides={},output=false) => {
      const request = stack.privateFile(name+'.json',q);
      const path = stack.privateFile(name+'-export.json');
      const log = await cli('privacyRights',['--request='+request,...(output?['--output='+path]:[])],overrides);
      return {log,path};
    };
    await test('LOCAL-42','Protected lost-token privacy CLI rejects wrong key, missing verification and cross-target request without mutation',async()=>{
      privacySession=await session();privacyAssessment=await assess(privacySession);const r=await recommend(privacySession,privacyAssessment);
      privacyLead=success(await call('POST','/api/v1/leads',{token:privacySession.sessionToken,headers:{'Idempotency-Key':randomUUID()},body:{sessionId:privacySession.sessionId,assessmentId:privacyAssessment.assessmentId,recommendationId:r.recommendationId,providerId:r.providers[0].id,serviceType:'HOME_CARE',contact:{name:'合成權利測試',phone:'0900000000'},contactConsent:true}}));
      await assert.rejects(()=>privacyCli('privacy-denied',privacyRequest('DENIED','DELETE'),{KAREO_OPERATOR_KEY:'wrong'}),/Privacy operation failed/);
      await assert.rejects(()=>privacyCli('privacy-proof',privacyRequest('PROOF','DELETE',{verificationMethod:'KNOWS_ID'})),/Privacy operation failed/);
      await assert.rejects(()=>privacyCli('privacy-cross',privacyRequest('CROSS','DELETE',{leadId:lead.leadId})),/Privacy operation failed/);
      assert.equal((await db.query('select status from sessions where id=$1',[privacySession.sessionId])).rows[0].status,'ACTIVE');
      assert.equal((await db.query('select count(*)::int n from privacy_operations')).rows[0].n,0);
    });
    await test('LOCAL-43','Actual privacy export CLI writes only the verified case to a private file, excluding tokens/key hashes and other users',async()=>{
      const {log,path}=await privacyCli('privacy-export',privacyRequest('EXPORT','EXPORT'),{},true);
      const raw=readFileSync(path,'utf8');const exported=JSON.parse(raw);
      assert.equal(statSync(path).mode&0o777,0o600);assert.equal(exported.session.id,privacySession.sessionId);
      assert.ok(!raw.includes(main.sessionId)&&!raw.includes(privacySession.sessionToken)&&!raw.includes('token_hash')&&!raw.includes(stack.operatorKey));
      assert.equal(exported.assessments[0].id,privacyAssessment.assessmentId);assert.ok(!log.includes('0900000000')&&!log.includes('本機虛構'));
      await assert.rejects(()=>privacyCli('privacy-reuse',privacyRequest('EXPORT','DELETE')),/Privacy operation failed/);
    });
    await test('LOCAL-44','Actual correction CLI uses published rule engine, atomically replaces profile and removes stale recommendations/outreach',async()=>{
      await privacyCli('privacy-contact',privacyRequest('CONTACT','CORRECT_CONTACT',{leadId:privacyLead.leadId,correction:{name:'合成更正稱呼',phone:'0900000001'}}));
      assert.equal((await db.query('select contact_phone from leads where id=$1',[privacyLead.leadId])).rows[0].contact_phone,'0900000001');
      const correction={...assessmentBody(privacySession.sessionId),mobilityLevel:'INDEPENDENT',dailyLivingLevel:'INDEPENDENT',freeText:'本機合成更正，無居服需求。',needs:{homeCare:'NO',medicalNursing:'NO',assistiveDevice:'YES',transportation:'NO'}};
      await privacyCli('privacy-assessment',privacyRequest('ASSESSMENT','CORRECT_ASSESSMENT',{assessmentId:privacyAssessment.assessmentId,correction}));
      const profile=(await db.query('select care_needs,summary from care_need_profiles where assessment_id=$1',[privacyAssessment.assessmentId])).rows[0];
      assert.ok(!profile.care_needs.includes('HOME_CARE')&&profile.care_needs.includes('ASSISTIVE_DEVICE'));
      assert.equal((await db.query('select count(*)::int n from recommendation_runs where assessment_id=$1',[privacyAssessment.assessmentId])).rows[0].n,0);
      const l=(await db.query('select status,status_reason,contact_phone from leads where id=$1',[privacyLead.leadId])).rows[0];
      assert.deepEqual(l,{status:'CANCELLED',status_reason:'DATA_CORRECTED',contact_phone:null});
      assert.ok(!(await db.query('select result_counts::text result from privacy_operations')).rows.some(r=>r.result.includes('0900000001')));
    });
    await test('LOCAL-45','Verified data steward stops a lost-token case; old visitor token cannot create more health data',async()=>{
      await privacyCli('privacy-stop',privacyRequest('STOP','STOP'));
      error(await call('POST','/api/v1/assessments',{token:privacySession.sessionToken,body:assessmentBody(privacySession.sessionId)}),401,'SESSION_INVALID');
      assert.equal((await db.query('select status from sessions where id=$1',[main.sessionId])).rows[0].status,'ACTIVE');
    });
    await test('LOCAL-46','Verified data steward deletes another lost-token case and records the exact target without impersonating the user',async()=>{
      const s=await session();await assess(s);
      await privacyCli('privacy-delete',privacyRequest('DELETE','DELETE',{sessionId:s.sessionId}));
      assert.equal((await db.query('select status from sessions where id=$1',[s.sessionId])).rows[0].status,'DELETION_REQUESTED');
      assert.equal((await db.query("select count(*)::int n from privacy_operations where request_id='PRQ-LOCAL-DELETE' and session_id=$1",[s.sessionId])).rows[0].n,1);
      error(await call('POST','/api/v1/assessments',{token:s.sessionToken,body:assessmentBody(s.sessionId)}),401,'SESSION_INVALID');
    });
    await test('LOCAL-18', 'Withdrawal schedules deletion, clears contacts, cancels an open Lead; all subsequent writes rejected', async () => {
      const s = await session(); const a = await assess(s); const r = await recommend(s,a);
      const body = { ...leadBody(), sessionId: s.sessionId, assessmentId: a.assessmentId, recommendationId: r.recommendationId, providerId: r.providers[0].id, contact: { ...contact, phone: '0912340001' } };
      const l = success(await call('POST', '/api/v1/leads', { token: s.sessionToken, headers: { 'Idempotency-Key': randomUUID() }, body }));
      withdrawalSnapshot = await captureSyntheticSnapshot(db);
      success(await call('POST', '/api/v1/consent/withdraw', { token: s.sessionToken }));
      withdrawalReceipt = {sessionId:s.sessionId,action:'CONSENT_WITHDRAWN',requestedAt:(await db.query('select withdrawn_at from consents where session_id=$1',[s.sessionId])).rows[0].withdrawn_at};
      for (const [path, payload] of [['/api/v1/assessments',assessmentBody(s.sessionId)],['/api/v1/recommendations',{assessmentId:a.assessmentId,serviceType:'HOME_CARE'}],['/api/v1/leads',body]])
        error(await call('POST',path,{token:s.sessionToken,body:payload,headers:{'Idempotency-Key':randomUUID()}}),401,'SESSION_INVALID');
      const row = (await db.query('select status,contact_name,contact_phone from leads where id=$1',[l.leadId])).rows[0];
      assert.deepEqual(row,{status:'CANCELLED',contact_name:null,contact_phone:null});
    });
    await test('LOCAL-19', 'Session DELETE invalidates token; assessment and recommendation remain blocked', async () => {
      const s=await session(); const a=await assess(s);
      deletionSnapshot = await captureSyntheticSnapshot(db);
      success(await call('DELETE','/api/v1/session',{token:s.sessionToken}));
      deletionReceipt = {sessionId:s.sessionId,action:'USER_DELETED',requestedAt:(await db.query('select updated_at from sessions where id=$1',[s.sessionId])).rows[0].updated_at};
      error(await call('POST','/api/v1/assessments',{token:s.sessionToken,body:assessmentBody(s.sessionId)}),401,'SESSION_INVALID');
      error(await call('POST','/api/v1/recommendations',{token:s.sessionToken,body:{assessmentId:a.assessmentId,serviceType:'HOME_CARE'}}),401,'SESSION_INVALID');
    });
    await test('LOCAL-47','Actual official SDK journal has minimal immutable receipts; unauthenticated visitor cannot write an intent',async()=>{
      const before=await stack.journal.readAll(); assert.equal(before.length,4);
      assert.ok(before.some(r=>r.sessionId===withdrawalReceipt.sessionId && r.action==='CONSENT_WITHDRAWN'));
      assert.ok(before.every(r=>Object.keys(r).sort().join(',')==='action,projectRef,requestedAt,schemaVersion,sessionId'));
      error(await call('DELETE','/api/v1/session',{token:'forged-invalid-token'}),401,'SESSION_INVALID');
      await stack.journal.record(deletionReceipt.sessionId,'USER_DELETED',new Date().toISOString());
      assert.deepEqual(await stack.journal.readAll(),before);
    });
    await test('LOCAL-48','Unavailable independent journal prevents successful DELETE and database mutation; repair and retry succeed',async()=>{
      const s=await session(); await assess(s);
      const count=(await stack.journal.readAll()).length;
      await stack.withJournalUnavailable(async()=>error(await call('DELETE','/api/v1/session',{token:s.sessionToken}),500,'INTERNAL_ERROR'));
      assert.equal((await db.query('select status from sessions where id=$1',[s.sessionId])).rows[0].status,'ACTIVE');
      assert.equal((await stack.journal.readAll()).length,count);
      success(await call('DELETE','/api/v1/session',{token:s.sessionToken}));
      assert.equal((await stack.journal.readAll()).length,count+1);
    });
    await test('LOCAL-20', 'Body above contract limit rejected; real persistent assessment rate limit returns 429 and Retry-After', async () => {
      error(await call('POST','/api/v1/assessments',{token:main.sessionToken,body:{...assessmentBody(main.sessionId),freeText:'x'.repeat(20000)}}),413,'PAYLOAD_TOO_LARGE');
      const s=await session(); await assess(s); await assess(s); await assess(s);
      const limited=await call('POST','/api/v1/assessments',{token:s.sessionToken,body:assessmentBody(s.sessionId)});
      error(limited,429,'RATE_LIMITED'); assert.ok(Number(limited.headers.get('retry-after'))>0);
    });
    await test('LOCAL-21', 'Kareocar endpoint returns the approved external URL and NEW_TAB', async () => {
      const data=success(await call('GET','/api/v1/external-services/transportation'));
      assert.equal(data.url,'https://kareocar.netlify.app/'); assert.equal(data.openMode,'NEW_TAB');
    });
    await test('LOCAL-26', 'Cross-session recommendation and Lead source ownership reject other users resources', async () => {
      const s=await session();
      error(await call('POST','/api/v1/recommendations',{token:s.sessionToken,body:{assessmentId:mainAssessment.assessmentId,serviceType:'HOME_CARE'}}),404,'NOT_FOUND');
      error(await call('POST','/api/v1/leads',{token:s.sessionToken,headers:{'Idempotency-Key':randomUUID()},body:{...leadBody(),sessionId:s.sessionId,contact:{...contact,phone:'0912340002'}}}),404,'NOT_FOUND');
    });
    await test('LOCAL-27', 'Controlled local candidate fixtures return 2 / 1 / 0 without padding; zero is successful empty state', async () => {
      const s=await session(); const a=await assess(s);
      const original=(await db.query("select id,provider_id,active from provider_services where service_type='HOME_CARE'")).rows;
      const selected=mainRecommendation.providers.map(p=>p.id);
      try {
        for(const n of [2,1,0]) {
          await db.query("update provider_services set active=(provider_id=any($1::text[])) where service_type='HOME_CARE'",[selected.slice(0,n)]);
          const r=await recommend(s,a); assert.equal(r.providers.length,n);
          assert.ok(r.providers.every(p=>selected.slice(0,n).includes(p.id)));
          if(n===0) assert.ok(r.notice.includes('1966'));
        }
      } finally { for(const row of original) await db.query('update provider_services set active=$2 where id=$1',[row.id,row.active]); }
    });
    await test('LOCAL-28', 'One eligible provider missing coordinates downgrades the entire GPS result and explains it', async () => {
      const s=await session(); const a=await assess(s,{...district,precision:'GPS',lat:25.061,lng:121.488});
      const id=mainRecommendation.providers[0].id;
      const original=(await db.query('select lat,lng from providers where id=$1',[id])).rows[0];
      try {
        await db.query('update providers set lat=null,lng=null where id=$1',[id]);
        const r=await recommend(s,a); assert.equal(r.rankingType,'DISTRICT_ROTATION'); assert.equal(r.locationPrecision,'GPS');
        assert.ok(r.providers.every(p=>p.distanceKm===null)); assert.ok(r.notice.includes('尚無已確認的位置資料'));
      } finally { await db.query('update providers set lat=$2,lng=$3 where id=$1',[id,original.lat,original.lng]); }
    });
    await test('LOCAL-29', 'Actual HTTP assessment failure rolls back Assessment and Profile; safe error and retry succeed', async () => {
      const s=await session();
      await db.query(`create function local_test_fail_profile() returns trigger language plpgsql as $$ begin raise exception 'synthetic local write failure'; end $$;
        create trigger local_test_fail_profile before insert on care_need_profiles for each row execute function local_test_fail_profile()`);
      try {
        const r=await call('POST','/api/v1/assessments',{token:s.sessionToken,body:assessmentBody(s.sessionId)});
        error(r,500,'INTERNAL_ERROR'); assert.ok(!/synthetic local write failure|PGRST|postgres|SUPABASE_/i.test(JSON.stringify(r.json)));
        assert.equal((await db.query('select count(*)::int n from assessments where session_id=$1',[s.sessionId])).rows[0].n,0);
      } finally { await db.query('drop trigger local_test_fail_profile on care_need_profiles; drop function local_test_fail_profile()'); }
      await assess(s); assert.equal((await db.query('select count(*)::int n from assessments where session_id=$1',[s.sessionId])).rows[0].n,1);
    });
    await test('LOCAL-30', 'Real repository read failure returns safe INTERNAL_ERROR, not an empty successful resource list', async () => {
      await db.query('alter table providers rename to local_test_unavailable_providers');
      try {
        const r=await call('GET','/api/v1/providers'); error(r,500,'INTERNAL_ERROR');
        assert.ok(!/PGRST|postgres|relation|SUPABASE_/i.test(JSON.stringify(r.json)));
      } finally { await db.query('alter table local_test_unavailable_providers rename to providers'); }
      assert.equal(success(await call('GET','/api/v1/providers?pageSize=50')).totalCount,35);
    });
    await test('LOCAL-22', 'Admin authentication rejects forged tokens; actual operator key creates a separate admin Session', async () => {
      error(await call('GET','/api/v1/admin/knowledge/status',{admin:'forged-admin-token'}),401,'SESSION_INVALID');
      adminToken=success(await call('POST','/api/v1/admin/session',{body:{operatorId:LOCAL_OPERATOR,operatorKey:stack.operatorKey}})).adminToken;
      success(await call('GET','/api/v1/admin/knowledge/status',{admin:adminToken}));
      success(await call('GET','/api/v1/admin/knowledge/changes',{admin:adminToken}));
      success(await call('GET','/api/v1/admin/knowledge/records',{admin:adminToken}));
    });
    await test('LOCAL-23', 'Admin publish preview is read-only and blocked without new approvals; restorable list excludes current version', async () => {
      const preview=success(await call('GET','/api/v1/admin/knowledge/publish-preview',{admin:adminToken})); assert.equal(preview.canPublish,false);
      const versions=success(await call('GET','/api/v1/admin/knowledge/restorable-versions',{admin:adminToken}));
      assert.ok(versions.versions.every(v=>v.versionId!=='KB-2026-09-24-001'));
    });
    await test('LOCAL-31', 'Actual admin decision checks content fingerprint; review and rejection remove items from pending list', async () => {
      await stack.prepareAdminFixture();
      adminRecords=success(await call('GET','/api/v1/admin/knowledge/records',{admin:adminToken})).records;
      assert.equal(adminRecords.length,3);
      const [first,,rejected]=adminRecords;
      const body={decision:'APPROVED',reason:'Local synthetic review',expectedContentFingerprint:'sha256:'+'0'.repeat(64),confirm:true};
      error(await call('POST',`/api/v1/admin/knowledge/records/${first.id}/decision`,{admin:adminToken,body}),409,'KNOWLEDGE_STATE_CHANGED');
      success(await call('POST',`/api/v1/admin/knowledge/records/${first.id}/decision`,{admin:adminToken,body:{...body,expectedContentFingerprint:first.contentFingerprint}}));
      success(await call('POST',`/api/v1/admin/knowledge/records/${rejected.id}/decision`,{admin:adminToken,body:{...body,decision:'REJECTED',expectedContentFingerprint:rejected.contentFingerprint}}));
      stalePreview=success(await call('GET','/api/v1/admin/knowledge/publish-preview',{admin:adminToken}));
      assert.equal(stalePreview.canPublish,true); assert.equal(stalePreview.publishedRecordCount,1); assert.equal(stalePreview.totalRecordCount,22);
      const pending=success(await call('GET','/api/v1/admin/knowledge/records',{admin:adminToken})).records; assert.equal(pending.length,1);
    });
    await test('LOCAL-32', 'Old preview token is rejected without a publish; refreshed preview publishes exactly 2 new + 21 carried records', async () => {
      const second=adminRecords[1];
      success(await call('POST',`/api/v1/admin/knowledge/records/${second.id}/decision`,{admin:adminToken,body:{decision:'APPROVED',reason:'Local synthetic review',expectedContentFingerprint:second.contentFingerprint,confirm:true}}));
      error(await call('POST','/api/v1/admin/knowledge/publish',{admin:adminToken,body:{versionId:stalePreview.targetVersionId,previewToken:stalePreview.previewToken,confirm:true}}),409,'KNOWLEDGE_STATE_CHANGED');
      assert.equal(success(await call('GET','/api/v1/knowledge/status')).version,'KB-2026-09-24-001');
      const preview=success(await call('GET','/api/v1/admin/knowledge/publish-preview',{admin:adminToken}));
      assert.equal(preview.publishedRecordCount,2); assert.equal(preview.carriedForwardCount,21); assert.equal(preview.totalRecordCount,23);
      const result=success(await call('POST','/api/v1/admin/knowledge/publish',{admin:adminToken,body:{versionId:preview.targetVersionId,previewToken:preview.previewToken,confirm:true}}));
      assert.equal(result.versionId,'KB-2026-10-05-900'); assert.equal(result.totalRecordCount,23);
      assert.equal((await db.query("select count(*)::int n from knowledge_version_records where version_id='KB-2026-09-24-001'")).rows[0].n,21);
      assert.equal((await db.query('select knowledge_version from assessments where id=$1',[mainAssessment.assessmentId])).rows[0].knowledge_version,'KB-2026-09-24-001');
    });
    await test('LOCAL-33', 'Withdrawal restores an allowed historical version, excludes withdrawn version, preserves historical memberships', async () => {
      const options=success(await call('GET','/api/v1/admin/knowledge/restorable-versions',{admin:adminToken}));
      assert.ok(options.versions.some(v=>v.versionId==='KB-2026-09-24-001'));
      success(await call('POST','/api/v1/admin/knowledge/withdraw',{admin:adminToken,body:{withdrawVersionId:'KB-2026-10-05-900',republishVersionId:'KB-2026-09-24-001',reason:'Local synthetic restore',confirm:true}}));
      assert.equal(success(await call('GET','/api/v1/knowledge/status')).version,'KB-2026-09-24-001');
      const optionsAfter=success(await call('GET','/api/v1/admin/knowledge/restorable-versions',{admin:adminToken}));
      assert.ok(optionsAfter.versions.every(v=>v.versionId!=='KB-2026-10-05-900'&&v.versionId!=='KB-2026-09-24-001'));
      assert.equal(success(await call('GET','/api/v1/knowledge/records?pageSize=50')).totalCount,21);
      assert.equal((await db.query("select count(*)::int n from knowledge_version_records where version_id='KB-2026-10-05-900'")).rows[0].n,23);
    });
    await test('LOCAL-34', 'Admin changes route, confirmation, dismiss and repeated-decision conflict use actual SQL with audit', async () => {
      await db.query(`insert into knowledge_changes(id,knowledge_record_id,old_content_hash,new_content_hash,old_content,new_content,status,detected_at)
        values('LOCAL-SYNTHETIC-CHANGE',$1,'synthetic-old','synthetic-new','synthetic-old-text','synthetic-new-text','NEEDS_REVIEW',now())`,[adminRecords[0].id]);
      const changes=success(await call('GET','/api/v1/admin/knowledge/changes',{admin:adminToken})).changes;
      assert.equal(changes.length,1);
      const path='/api/v1/admin/knowledge/changes/LOCAL-SYNTHETIC-CHANGE/dismiss';
      error(await call('POST',path,{admin:adminToken,body:{reason:'Local fixture only',confirm:false}}),400,'VALIDATION_ERROR');
      const data=success(await call('POST',path,{admin:adminToken,body:{reason:'Local fixture only',confirm:true}})); assert.equal(data.change.status,'DISMISSED');
      error(await call('POST',path,{admin:adminToken,body:{reason:'Local fixture only',confirm:true}}),409,'INVALID_STATUS_TRANSITION');
      assert.equal(success(await call('GET','/api/v1/admin/knowledge/changes',{admin:adminToken})).changes.length,0);
    });
    await test('LOCAL-24', 'Stale withdrawal rejected with 409; explicit no-republish withdraw makes knowledge unavailable without fake success', async () => {
      const body={withdrawVersionId:'KB-2026-09-24-999',republishVersionId:null,reason:'Local synthetic rehearsal',confirm:true};
      error(await call('POST','/api/v1/admin/knowledge/withdraw',{admin:adminToken,body}),409,'KNOWLEDGE_STATE_CHANGED');
      success(await call('POST','/api/v1/admin/knowledge/withdraw',{admin:adminToken,body:{...body,withdrawVersionId:'KB-2026-09-24-001'}}));
      error(await call('GET','/api/v1/knowledge/status'),503,'KNOWLEDGE_UNAVAILABLE');
      error(await call('GET','/api/v1/knowledge/records'),503,'KNOWLEDGE_UNAVAILABLE');
      const s=await session(); error(await call('POST','/api/v1/assessments',{token:s.sessionToken,body:assessmentBody(s.sessionId)}),503,'KNOWLEDGE_UNAVAILABLE');
    });
    await test('LOCAL-25', 'Real consent contract unchanged and contains no activated local test version', async () => {
      assert.equal(createHash('sha256').update(readFileSync('contracts/legal/consent-versions.json')).digest('hex'),legalBefore);
      assert.ok(!readFileSync('contracts/legal/consent-versions.json','utf8').includes(TEST_CONSENT.privacyVersion));
    });
    const health=async()=>{
      const rows={};
      for(const table of ['assessments','care_need_profiles','recommendation_runs','recommendation_items','sessions'])
        rows[table]=(await db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows;
      return rows;
    };
    await test('LOCAL-49','Unreadable external journal blocks authenticated retention CLI before mutation or success audit',async()=>{
      const original=await health(); const count=(await db.query('select count(*)::int n from deletion_runs')).rows[0].n;
      await assert.rejects(cli('cleanupExpiredData',['--commit','--operator-id',LOCAL_OPERATOR],{NETLIFY_BLOBS_CONTEXT:stack.unavailableBlobsContext}),/Independent deletion journal\/read failed/);
      assert.deepEqual(await health(),original); assert.equal((await db.query('select count(*)::int n from deletion_runs')).rows[0].n,count);
    });
    await test('LOCAL-35', 'Actual protected retention CLI rejects wrong key; dry-run changes neither health tables nor audit', async () => {
      deletionTargets=(await db.query("select id from sessions where status='DELETION_REQUESTED'")).rows.map(r=>r.id); assert.equal(deletionTargets.length,5);
      deletionAssessments=(await db.query('select id from assessments where session_id=any($1::text[])',[deletionTargets])).rows.map(r=>r.id);
      deletionRuns=(await db.query('select id from recommendation_runs where assessment_id=any($1::text[])',[deletionAssessments])).rows.map(r=>r.id);
      assert.ok(deletionAssessments.length > 0); assert.ok(deletionRuns.length > 0);
      healthBefore=await health();
      await assert.rejects(cli('cleanupExpiredData',['--commit','--operator-id',LOCAL_OPERATOR],{KAREO_OPERATOR_KEY:'wrong-synthetic-key'}));
      const dry=await cli('cleanupExpiredData',['--dry-run','--operator-id',LOCAL_OPERATOR]); assert.ok(dry.includes('Status: SUCCESS'));
      assert.deepEqual(await health(),healthBefore); assert.equal((await db.query('select count(*)::int n from deletion_runs')).rows[0].n,0);
    });
    await test('LOCAL-36', 'Cleanup success-audit failure rolls back deletion, records FAILED and remains retryable via real PostgREST', async () => {
      await db.query(`create function local_test_fail_audit() returns trigger language plpgsql as $$ begin if new.status='SUCCESS' then raise exception 'synthetic local audit failure'; end if; return new; end $$;
        create trigger local_test_fail_audit before insert on deletion_runs for each row execute function local_test_fail_audit()`);
      try {
        await assert.rejects(cli('cleanupExpiredData',['--commit','--operator-id',LOCAL_OPERATOR]));
        assert.deepEqual(await health(),healthBefore);
        assert.equal((await db.query("select count(*)::int n from deletion_runs where status='FAILED'")).rows[0].n,1);
      } finally {await db.query('drop trigger local_test_fail_audit on deletion_runs; drop function local_test_fail_audit()');}
    });
    await test('LOCAL-37', 'Retry cleans all requested health data, retains required consent evidence, creates SUCCESS audit; second retry deletes zero', async () => {
      const cleaned=await cli('cleanupExpiredData',['--commit','--operator-id',LOCAL_OPERATOR]); assert.ok(cleaned.includes('Status: SUCCESS'));
      assert.equal((await db.query("select count(*)::int n from sessions where id=any($1::text[]) and status='DELETED'",[deletionTargets])).rows[0].n,deletionTargets.length);
      assert.equal((await db.query('select count(*)::int n from assessments where session_id=any($1::text[])',[deletionTargets])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from care_need_profiles where assessment_id=any($1::text[])',[deletionAssessments])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from recommendation_runs where assessment_id=any($1::text[])',[deletionAssessments])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from recommendation_items where recommendation_run_id=any($1::text[])',[deletionRuns])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from consents where session_id=any($1::text[])',[deletionTargets])).rows[0].n,deletionTargets.length);
      const current=await health();
      await cli('cleanupExpiredData',['--commit','--operator-id',LOCAL_OPERATOR]); assert.deepEqual(await health(),current);
      const successes=(await db.query("select sessions_deleted from deletion_runs where status='SUCCESS' order by started_at,id")).rows;
      assert.deepEqual(successes.map(r=>r.sessions_deleted),[5,0]);
    });
    await test('LOCAL-39', 'Earlier synthetic backup revives health/contact; replay actual withdrawal receipt and cleanup removes them again', async () => {
      restoreRehearsals.push(await restoreAndReplaySyntheticDeletion(withdrawalSnapshot,withdrawalReceipt,LOCAL_OPERATOR,stack.journal,stack.operatorKey));
    });
    await test('LOCAL-40', 'Earlier synthetic backup revives deleted Session health; replay actual deletion receipt and cleanup, preserving unrelated data', async () => {
      restoreRehearsals.push(await restoreAndReplaySyntheticDeletion(deletionSnapshot,deletionReceipt,LOCAL_OPERATOR,stack.journal,stack.operatorKey));
    });
  } catch { /* first failure is recorded; no false success or dependent-case cascade */ }
  return { schemaVersion:1, scope:'LOCAL-INTEGRATION-ONLY', releaseAcceptance:false, backend:stack.backend, baseUrl, startedAt, finishedAt:new Date().toISOString(),
    consent:'Synthetic LOCAL-TEST combo only in temporary bundles; production contract remains DRAFT', cloudWrites:0,
    status:results.length===49 && results.every(r=>r.status==='PASS')?'PASS':'FAIL', results, restoreRehearsals,
    limitations:['Not Netlify/deployed E2E; not counted toward the 49-case release gate','Browser/manual/operational cases require separate evidence','No actual daily scheduler trigger or formal D-05 approval'] };
}
