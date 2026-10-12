import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

test('public production UI analyses actual answers locally while resource reads use the real API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kareo-public-analysis-'));
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  try {
    const outfile = join(directory, 'public.cjs');
    await build({ stdin: { contents: `
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import { HomePage } from './src/pages/HomePage';
      import { ConsentPage } from './src/pages/ConsentPage';
      import { PrivacyPage } from './src/pages/PrivacyPage';
      export { api, apiMode, preciseLocationEnabled } from './src/api';
      export { demoMode, publicAnalysisMode } from './src/demo';
      export const render = () => [HomePage, ConsentPage, PrivacyPage].map(Component =>
        renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(Component, {onAccept: async () => {}}))));
    `, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx' }, outfile,
      bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
      define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_KAREO_API_MODE: 'real',
        VITE_KAREO_DEPLOY_CONTEXT: 'production', VITE_KAREO_PUBLIC_ANALYSIS: 'true',
        VITE_KAREO_REQUIRE_SESSION_TOKEN: 'true' }),
        __KAREO_CONSENT_DOCUMENTS__: JSON.stringify({ schemaVersion: 1, archives: [] }) } });
    const app = createRequire(import.meta.url)(outfile);
    assert.equal(app.apiMode, 'real');
    assert.equal(app.demoMode, false);
    assert.equal(app.publicAnalysisMode, true);
    assert.equal(app.preciseLocationEnabled, false);
    for (const html of app.render()) assert.doesNotMatch(html, /Demo|展示|草案版本|正式評估尚未開放/);
    assert.match(app.render()[0], /href="\/consent"/);
    assert.match(app.render()[1], /不保存至資料庫/);
    assert.match(app.render()[2], /公開資源與制度查詢讀取 Kareo 資料庫/);

    const response = JSON.parse(await readFile(new URL('../../../contracts/mock/providers/lookup/list-all-first-page-response.json', import.meta.url), 'utf8'));
    globalThis.fetch = async (input, init) => {
      requests.push({url: String(input), method: init?.method ?? 'GET'});
      assert.equal(init?.method ?? 'GET', 'GET', 'no personal-flow network writes');
      assert.match(String(input), /^\/api\/v1\/providers\?/);
      return new Response(JSON.stringify(response), { status: 200, headers: {'Content-Type':'application/json'} });
    };
    await app.api.assertConsentReady();
    const session = await app.api.createSession();
    await app.api.acceptConsent(session.sessionId);
    const request = {sessionId: session.sessionId, ageRange: '75_84',
      location: {precision:'DISTRICT',city:'臺北市',district:'大安區',lat:null,lng:null},
      livingSituation:'WITH_FAMILY',caregiverSituation:'FAMILY_LIMITED',mobilityLevel:'NEEDS_ASSISTANCE',dailyLivingLevel:'PARTIAL_ASSISTANCE',
      needs:{homeCare:'YES',medicalNursing:'NO',assistiveDevice:'YES',transportation:'NO'},freeText:''};
    const result = await app.api.submitAssessment(request);
    assert.deepEqual(result.careNeedProfile.careNeeds, ['HOME_CARE','ASSISTIVE_DEVICE']);
    assert.equal(result.knowledgeVersion, 'KB-2026-09-24-001');
    const recommendation = await app.api.getRecommendation({assessmentId:result.assessmentId, serviceType:'ASSISTIVE_DEVICE'});
    assert.equal(recommendation.providers.length, 3);
    assert.ok(recommendation.providers.every((p: {district:string}) => p.district === '大安區'));
    const no = await app.api.submitAssessment({...request, needs:{homeCare:'NO',medicalNursing:'NO',assistiveDevice:'NO',transportation:'NO'}});
    assert.deepEqual(no.careNeedProfile.careNeeds, []);
    assert.notEqual(no.careNeedProfile.summary, result.careNeedProfile.summary);
    await assert.rejects(() => app.api.createLead({}), /直接洽詢單位/);
    await assert.rejects(() => app.api.deleteSession(), /只保留在此分頁/);
    await assert.rejects(() => app.api.withdrawConsent(), /只保留在此分頁/);
    assert.deepEqual(requests, [], 'the complete analysis did not send answers or create cloud records');
    const resources = await app.api.getProviders({page:1,pageSize:20});
    assert.equal(resources.totalCount, response.data.totalCount);
    assert.equal(requests.length, 1, 'public resource query uses actual read-only adapter');
    app.api.forgetLocalSession();
    await app.api.createSession();
    await assert.rejects(() => app.api.getRecommendation({assessmentId:result.assessmentId,serviceType:'ASSISTIVE_DEVICE'}), /需求分析/);
  } finally {
    globalThis.fetch = previousFetch;
    await rm(directory, {recursive:true,force:true});
  }
});
