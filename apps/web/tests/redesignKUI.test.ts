import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

test('KUI public screens preserve unknown answers, distinguish failure states and show real provenance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kareo-kui-'));
  try {
    const outfile = join(directory, 'ui.cjs');
    await build({stdin:{contents:`
      import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
      import {MemoryRouter} from 'react-router-dom';
      import {HomePage} from './src/pages/HomePage';
      import {AssessmentPage} from './src/pages/AssessmentPage';
      import {KnowledgeCard, KnowledgeStatusPanel, KnowledgeInfoPage} from './src/pages/KnowledgeInfoPage';
      export {knowledgeFailure, publicDate} from './src/knowledge/knowledgeStatus';
      export {ApiError} from './src/api/realAdapter';
      export {defaultAssessmentForm} from './src/assessment/assessmentRequest';
      const render = (Component,props={},state={}) => renderToStaticMarkup(createElement(MemoryRouter,
        {initialEntries:[{pathname:'/assessment',state}]},createElement(Component,props)));
      export const home = () => render(HomePage);
      export const assessment = (initialForm,step) => render(AssessmentPage,{sessionId:'local',initialForm,onSubmit:async()=>{}},{step});
      export const status = (state,hasFilters=false) => render(KnowledgeStatusPanel,{state,hasFilters,onRetry:()=>{},onClear:()=>{}});
      export const card = record => render(KnowledgeCard,{record});
      export const planned = () => render(KnowledgeInfoPage,{availability:'coming-soon'});
    `,resolveDir:fileURLToPath(new URL('..',import.meta.url)),loader:'tsx'},outfile,bundle:true,platform:'node',format:'cjs',logLevel:'silent',
      define:{'import.meta.env':JSON.stringify({DEV:false,VITE_KAREO_API_MODE:'real',VITE_KAREO_PUBLIC_ANALYSIS:'true',VITE_KAREO_DEPLOY_CONTEXT:'production',VITE_KAREO_REQUIRE_SESSION_TOKEN:'true'}),
        __KAREO_CONSENT_DOCUMENTS__:JSON.stringify({schemaVersion:1,archives:[]})}});
    const ui = createRequire(import.meta.url)(outfile);
    const home = ui.home();
    assert.equal((home.match(/class="button primary"/g)??[]).length,1,'one strongest homepage action');
    assert.match(home,/結果示意・不是您的評估/); assert.match(home,/自己或家人/);
    assert.match(home,/href="tel:1966"/); assert.doesNotMatch(home,/3[–-]5|Demo|已核定/);

    const defaults = ui.defaultAssessmentForm;
    for(const key of ['ageRange','livingSituation','caregiverSituation','mobilityLevel','dailyLivingLevel','homeCare','medicalNursing','assistiveDevice','transportation','disabilityCertificate','incomeCategory']) {
      assert.equal(defaults[key],'UNKNOWN',`${key} must not assume an answer`);
    }
    const first = ui.assessment(defaults,1);
    assert.match(first,/第 1 步，共 2 步/); assert.match(first,/<legend>日常活動/);
    assert.doesNotMatch(first,/<legend>可能需要的服務/);
    const second = ui.assessment({...defaults,homeCare:'YES',ageRange:'75_84'},2);
    assert.match(second,/第 2 步，共 2 步/); assert.match(second,/上一步：修改照護狀況/);
    assert.match(second,/<legend>可能需要的服務/); assert.doesNotMatch(second,/<legend>日常活動|<textarea/);
    assert.match(second,/<option value="YES" selected="">是/,'saved answer is rendered when returning');

    const empty = JSON.parse(await readFile(new URL('../../../contracts/mock/knowledge/records-empty-response.json',import.meta.url),'utf8')).data;
    assert.match(ui.status({status:'loading'}),/role="status".*正在載入/);
    assert.match(ui.status({status:'success',response:empty},true),/清除篩選/);
    assert.doesNotMatch(ui.status({status:'success',response:empty},false),/清除篩選/);
    const fault = ui.status({status:'error'});
    assert.match(fault,/role="alert"/); assert.match(fault,/重新載入資訊/); assert.match(fault,/href="tel:1966"/);
    for(const status of ['coming-soon','unpublished']) {
      assert.doesNotMatch(ui.status({status}),/重新載入資訊/);
      assert.match(ui.status({status}),/href="\/resources"/);
    }
    assert.doesNotMatch(ui.planned(),/aria-label="篩選長照資訊"/);
    assert.equal(ui.knowledgeFailure(new ui.ApiError('NOT_FOUND','internal',404)),'error');
    assert.equal(ui.knowledgeFailure(new ui.ApiError('KNOWLEDGE_UNAVAILABLE','internal',503)),'unpublished');
    assert.equal(ui.knowledgeFailure(new Error('network')),'error');

    const fixture = JSON.parse(await readFile(new URL('../../../contracts/mock/knowledge/records-first-page-response.json',import.meta.url),'utf8')).data;
    const record = fixture.items[0]; const html = ui.card(record);
    assert.ok(html.includes(record.source.publisher)); assert.ok(html.includes(record.source.url));
    assert.match(html,/發布日期|最後查核|資訊維護/);
    assert.equal(ui.publicDate('2026-10-11T20:30:00Z'),'2026/10/12');
    assert.equal(ui.publicDate(null),'待補'); assert.equal(ui.publicDate('invalid'),'待補');
    assert.match(ui.card({...record,lastVerifiedAt:null}),/最後查核<\/dt><dd>待補/);
    assert.doesNotMatch(ui.card({...record,source:{...record.source,url:null}}),/target="_blank"/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
