import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isProviderDetail, isResourceLookupResponse, resourceLookupPath } from '../src/api/realAdapter.ts';
import { buildResourceLookupRequest, changeResourceCategory, changeLookupCity, changeAreaFilter, withIncludeUnconfirmed, initialLookupForm, lookupFormFromParams, lookupPageFromParams, lookupParams } from '../src/resources/resourceLookup.ts';
import { resourceServices } from '../src/resources/publicInfo.ts';
const detail = JSON.parse(readFileSync(new URL('../../../contracts/mock/providers/PROV-MOCK-301.json',import.meta.url),'utf8')).data;
const info={assistivePrograms:[],publicServices:['輔具評估（需預約）'],notice:'分站不辦理補助核定',sourceUrl:'https://atrc.aihsin.ntpc.gov.tw/NewsInfo/131',checkedAt:'2026-10-08'};
test('optional sourced metadata passes; unknown fields, malformed programme and private fields fail',()=>{
  assert.equal(isProviderDetail({...detail,publicInfo:info}),true);
  assert.equal(isProviderDetail({...detail,publicInfo:{...info,phone:'private'}}),false);
  assert.equal(isProviderDetail({...detail,publicInfo:{...info,assistivePrograms:['OTHER']}}),false);
  assert.equal(isProviderDetail({...detail,publicInfo:{...info,sourceUrl:'javascript:alert(1)'}}),false);
});

test('public resource links round-trip applied keyword, district, unconfirmed toggle and page, dropping removed filters',()=>{
  const params = new URLSearchParams({city:'新北市',district:'板橋區',areaFilter:'SERVICE_AREA',serviceType:'HOME_CARE',includeUnconfirmed:'true',q:'  長照  ',page:'2',contractCity:'臺北市',sessionToken:'ignored'});
  const form = lookupFormFromParams(params);
  assert.equal(form.q,'長照'); assert.equal(form.includeUnconfirmed,true);
  const request = buildResourceLookupRequest(form,lookupPageFromParams(params))!;
  assert.equal(request.page,2); assert.equal(request.district,'板橋區'); assert.equal(request.q,'長照');
  assert.equal('contractCity' in request,false);
  const publicParams = lookupParams(form,2);
  assert.equal(publicParams.has('contractCity'),false); assert.equal(publicParams.has('sessionToken'),false);
  assert.deepEqual(buildResourceLookupRequest(lookupFormFromParams(publicParams),lookupPageFromParams(publicParams)),request);
  for(const page of ['-1','0','1.5','abc','9007199254740992']) assert.equal(lookupPageFromParams(new URLSearchParams({page})),1);
  assert.equal(lookupPageFromParams(new URLSearchParams({page:'3'})),3);
});

test('centres cannot inherit home-service filters when changing categories or restoring a direct link',()=>{
  const selected={...initialLookupForm,city:'臺北市' as const,district:'大安區',serviceType:'ASSISTIVE_DEVICE' as const,assistiveProgram:'SMART_TECH' as const,areaFilter:'SERVICE_AREA' as const,includeUnconfirmed:true};
  const center=changeResourceCategory(selected,'ASSISTIVE_DEVICE_CENTER');
  assert.equal(center.serviceType,''); assert.equal(center.assistiveProgram,''); assert.equal(center.areaFilter,'LOCATED_IN'); assert.equal(center.includeUnconfirmed,false);
  assert.equal(changeAreaFilter(center,'SERVICE_AREA').areaFilter,'LOCATED_IN');
  assert.equal(withIncludeUnconfirmed(center,true).includeUnconfirmed,false);
  const restored=lookupFormFromParams(new URLSearchParams({city:'臺北市',district:'大安區',resourceCategory:'ASSISTIVE_DEVICE_CENTER',serviceType:'HOME_CARE',assistiveProgram:'PURCHASE',areaFilter:'SERVICE_AREA',includeUnconfirmed:'true'}));
  assert.deepEqual(buildResourceLookupRequest(restored),{resourceCategory:'ASSISTIVE_DEVICE_CENTER',city:'臺北市',district:'大安區',areaFilter:'LOCATED_IN',page:1,pageSize:20});
  const switched=changeLookupCity(selected,'新北市'); assert.equal(switched.district,'');
  const unsupported=lookupFormFromParams(new URLSearchParams({city:'OTHER',district:'大安區',areaFilter:'SERVICE_AREA',includeUnconfirmed:'true'}));
  assert.equal(buildResourceLookupRequest(unsupported),null);
  assert.equal(unsupported.district,''); assert.equal(unsupported.includeUnconfirmed,false);
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

test('same-district resource links preserve the valid district and location filter, rejecting mismatched districts',()=>{
  const form=lookupFormFromParams(new URLSearchParams({city:'臺北市',district:'南港區',areaFilter:'LOCATED_IN',serviceType:'ASSISTIVE_DEVICE'}));
  assert.deepEqual(buildResourceLookupRequest(form),{city:'臺北市',district:'南港區',areaFilter:'LOCATED_IN',serviceType:'ASSISTIVE_DEVICE',page:1,pageSize:20});
  assert.equal(lookupFormFromParams(new URLSearchParams({city:'臺北市',district:'板橋區',areaFilter:'INVALID'})).district,'');
  assert.equal(lookupFormFromParams(new URLSearchParams({city:'臺北市',district:'板橋區',areaFilter:'INVALID'})).areaFilter,'LOCATED_IN');
});
