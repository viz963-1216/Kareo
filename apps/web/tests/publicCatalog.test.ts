import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isProviderDetail, isResourceLookupResponse, resourceLookupPath } from '../src/api/realAdapter.ts';
import { buildResourceLookupRequest, changeResourceCategory, initialLookupForm, lookupFormFromParams } from '../src/resources/resourceLookup.ts';
import { resourceServices } from '../src/resources/publicInfo.ts';
const detail = JSON.parse(readFileSync(new URL('../../../contracts/mock/providers/PROV-MOCK-301.json',import.meta.url),'utf8')).data;
const info={assistivePrograms:[],publicServices:['輔具評估（需預約）'],notice:'分站不辦理補助核定',sourceUrl:'https://atrc.aihsin.ntpc.gov.tw/NewsInfo/131',checkedAt:'2026-10-08'};
test('optional sourced metadata passes; unknown fields, malformed programme and private fields fail',()=>{
  assert.equal(isProviderDetail({...detail,publicInfo:info}),true);
  assert.equal(isProviderDetail({...detail,publicInfo:{...info,phone:'private'}}),false);
  assert.equal(isProviderDetail({...detail,publicInfo:{...info,assistivePrograms:['OTHER']}}),false);
  assert.equal(isProviderDetail({...detail,publicInfo:{...info,sourceUrl:'javascript:alert(1)'}}),false);
});
test('official programme round-trips in request and URL; switching to center clears it',()=>{
  const form=lookupFormFromParams(new URLSearchParams('assistiveProgram=SMART_TECH&serviceType=ASSISTIVE_DEVICE'));
  assert.equal(buildResourceLookupRequest(form)?.assistiveProgram,'SMART_TECH');
  assert.match(resourceLookupPath(buildResourceLookupRequest(form)!),/assistiveProgram=SMART_TECH/);
  assert.equal(changeResourceCategory(form,'ASSISTIVE_DEVICE_CENTER').assistiveProgram,'');
  assert.equal(initialLookupForm.assistiveProgram,'');
});
test('empty recommendation services never imply a center offers no public services',()=>{
  assert.equal(resourceServices('ASSISTIVE_DEVICE_CENTER',[],info),'輔具評估（需預約）');
  assert.match(resourceServices('ASSISTIVE_DEVICE_CENTER',[]),/輔具公共服務/);
});
test('optional applied programme is validated without weakening the original strict contract',()=>{
  const response=JSON.parse(readFileSync(new URL('../../../contracts/mock/providers/lookup/list-resource-center-response.json',import.meta.url),'utf8')).data;
  assert.equal(isResourceLookupResponse({...response,appliedFilters:{...response.appliedFilters,assistiveProgram:'PURCHASE'}}),true);
  assert.equal(isResourceLookupResponse({...response,appliedFilters:{...response.appliedFilters,assistiveProgram:'OTHER'}}),false);
});
