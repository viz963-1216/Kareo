import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { rankLocatedProviders } from '../src/publicData/residenceRanking.ts';
import { buildAssessmentRequest, defaultAssessmentForm } from '../src/assessment/assessmentRequest.ts';

test('distance ordering uses raw Haversine distances, excludes missing positions and breaks real ties by ID', () => {
  const origin = { lat:25.01,lng:121.47 };
  const candidates = [ {id:'far',lat:25.0104,lng:121.47}, {id:'close',lat:25.0101,lng:121.47},
    {id:'unknown',lat:null,lng:null}, {id:'tie-b',...origin}, {id:'tie-a',...origin} ];
  const ranked = rankLocatedProviders(origin,candidates);
  assert.deepEqual(ranked.map(row => row.provider.id),['tie-a','tie-b','close','far']);
  assert.ok(ranked[2].distance < ranked[3].distance);
  assert.equal(Math.round(ranked[2].distance*10),Math.round(ranked[3].distance*10),'sorting cannot use rounded display values');
});

test('the residence string is never added to the assessment API payload', () => {
  const form = {...defaultAssessmentForm,residenceAddress:'新北市板橋區三民路二段正隆巷46弄1號'};
  const payload = buildAssessmentRequest('session',form,{precision:'EXACT',city:'新北市',district:'板橋區',lat:25.01,lng:121.48});
  assert.equal(Object.hasOwn(payload,'residenceAddress'),false);
  assert.ok(!JSON.stringify(payload).includes('正隆巷'));
  assert.equal(defaultAssessmentForm.residenceAddress,'');
});

test('actual local recommendation flow supports exact residence and preserves the first district draw without networking', async () => {
  const directory=mkdtempSync(join(tmpdir(),'kareo-residence-'));
  try {
    const outfile=join(directory,'flow.cjs');
    await build({stdin:{contents:`export { publicProviderApi } from './src/publicData/providerPreview';
      export { matchResidence, normalizeResidenceAddress } from './src/location/residence';
      import { createElement } from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
      import {MemoryRouter} from 'react-router-dom'; import {ProviderCard} from './src/components/ProviderCard';
      export const renderCard = provider => renderToStaticMarkup(createElement(MemoryRouter,{},createElement(ProviderCard,{provider,rankingType:'DISTANCE',recommendationId:'rec',serviceType:'HOME_CARE'})));`,
      resolveDir:fileURLToPath(new URL('..',import.meta.url)),loader:'tsx'},outfile,bundle:true,platform:'node',format:'cjs',logLevel:'silent',
      define:{'import.meta.env':JSON.stringify({BASE_URL:'/demo/',DEV:false,VITE_KAREO_API_MODE:'mock',VITE_KAREO_DEMO:'true',VITE_KAREO_DEPLOY_CONTEXT:'local'})}});
    const {publicProviderApi:api,matchResidence,normalizeResidenceAddress,renderCard}=createRequire(import.meta.url)(outfile);
    const index=JSON.parse(readFileSync(new URL('../../../data/residence/nt01.json',import.meta.url),'utf8'));
    const coordinates=matchResidence(index,'新北市','板橋區','新北市板橋區三民路二段正隆巷４６弄１號3樓');
    assert.ok(coordinates);
    assert.deepEqual(coordinates,matchResidence(index,'新北市','板橋區','三民路2段正隆巷46弄1號'));
    assert.equal(matchResidence(index,'新北市','板橋區','新北市中和區三民路二段正隆巷46弄1號'),null);
    assert.equal(matchResidence(index,'新北市','板橋區','三民路二段正隆巷46弄999999號'),null);
    assert.equal(normalizeResidenceAddress('只有板橋區'),'');
    const originalFetch=globalThis.fetch;
    globalThis.fetch=async () => { throw new Error('No network allowed for assessment/recommendation'); };
    try {
      const session=await api.createSession(); await api.acceptConsent(session.sessionId);
      const input=buildAssessmentRequest(session.sessionId,defaultAssessmentForm,{precision:'EXACT',city:'新北市',district:'板橋區',...coordinates});
      const exact=await api.submitAssessment(input);
      const recommendation=await api.getRecommendation({assessmentId:exact.assessmentId,serviceType:'HOME_CARE'});
      assert.equal(recommendation.rankingType,'DISTANCE'); assert.equal(recommendation.providers.length,3);
      assert.match(recommendation.notice,/已定位 \d+／\d+ 家/);
      assert.ok(recommendation.providers.every(p => typeof p.distanceKm==='number'));
      assert.deepEqual(recommendation,await api.getRecommendation({assessmentId:exact.assessmentId,serviceType:'HOME_CARE'}));
      const district=await api.submitAssessment({...input,location:{precision:'DISTRICT',city:'新北市',district:'板橋區',lat:null,lng:null}});
      const random=await api.getRecommendation({assessmentId:district.assessmentId,serviceType:'HOME_CARE'});
      assert.equal(random.rankingType,'DISTRICT_ROTATION'); assert.equal(random.providers.length,3);
      assert.deepEqual(random,await api.getRecommendation({assessmentId:district.assessmentId,serviceType:'HOME_CARE'}));
      assert.ok(random.providers.every(p => p.distanceKm===null)); assert.match(random.notice,/隨機/);
      const areas=JSON.parse(readFileSync(new URL('../../../data/providers/staging/provider-service-areas.json',import.meta.url),'utf8'));
      for(const provider of [...random.providers,...recommendation.providers]) assert.ok(areas.some(a => a.providerId===provider.id&&a.active&&a.city==='新北市'&&a.district==='板橋區'));
      const html=renderCard({...recommendation.providers[0],reasons:['提供您需要的服務','官方名冊列評鑑不合格']});
      assert.doesNotMatch(html,/推薦原因|提供您需要的服務/); assert.match(html,/評鑑不合格/); assert.match(html,/直線距離/);
      api.reset(); await assert.rejects(api.getRecommendation({assessmentId:district.assessmentId,serviceType:'HOME_CARE'}));
    } finally {globalThis.fetch=originalFetch;}
  } finally {rmSync(directory,{recursive:true,force:true});}
});
