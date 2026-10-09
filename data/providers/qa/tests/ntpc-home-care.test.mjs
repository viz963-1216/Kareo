import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectNtpc, loadNtpc, verifyNtpcFiles } from '../verify-ntpc-home-care.mjs';
import { checkEvidence } from '../lib/a-003-coverage.mjs';
import { ntpcPrimaryPhone } from '../lib/ntpc-primary-phone.mjs';
test('official newline separates phones but preserves wrapped extensions',()=>{
  for (const [raw,expected] of [
    ['02-6604-5036\n02-6604-3989','02-6604-5036'],
    ['02-8675-5001\n0905-586-552','02-8675-5001'],
    ['02-2625-7846\n02-7728-7275\n0978-943-348','02-2625-7846'],
    ['02-2984-9570\n#880或#886','02-2984-9570#880'],
    ['03-218-1190\r\n#6221','03-218-1190#6221'],
    [' ０９８７－３８０－８５９ ','0987-380-859'],
    ['02-2345-6789#12或02-2345-6790','02-2345-6789#12'],
  ]) assert.equal(ntpcPrimaryPhone(raw),expected);
});
test('joining primary and alternate numbers is rejected even if all digits are official',()=>{
  const d=loadNtpc();
  const row=d.manifest.rows.find(r=>r.serial===283);
  d.providers.find(p=>p.id===row.providerId).phone='02-8675-50010905-586-552';
  assert.match(inspectNtpc(d).join('\n'),/First source phone corrupted/);
});
test('all 366 official rows reconciled and all 800 original catalogue records protected',()=>assert.deepEqual(verifyNtpcFiles(),[]));
test('a missing source institution fails',()=>{const d=loadNtpc();d.providers=d.providers.filter(p=>p.id!==d.manifest.rows[0].providerId);assert.match(inspectNtpc(d).join('\n'),/Source provider missing/);});
test('a missing source row fails',()=>{const d=loadNtpc();d.manifest.rows.pop();assert.match(inspectNtpc(d).join('\n'),/366-row/);});
test('blank respite or short-care checkbox cannot be presented as an offered service',()=>{const d=loadNtpc();const row=d.source.find(r=>r.respite!=='✔');const id=d.manifest.rows[row.serial-1].providerId;d.info.find(x=>x.providerId===id).publicInfo.publicServices.push('新北特約居家喘息服務');assert.match(inspectNtpc(d).join('\n'),/Unsupported public service claim/);});
test('modified or deleted original service areas fail',()=>{const d=loadNtpc();d.areas[0].district='烏來區';assert.match(inspectNtpc(d).join('\n'),/Original 800 catalogue row changed/);});
test('the temporarily suspended institution cannot become a recommendation candidate',()=>{const d=loadNtpc();const id=d.manifest.rows.find(r=>r.suspended).providerId;d.providers.find(p=>p.id===id).status='ACTIVE';assert.match(inspectNtpc(d).join('\n'),/Suspended provider eligibility/);});
test('four outside-city offices have only evidenced New Taipei service areas',()=>{const d=loadNtpc();const cross=d.manifest.rows.filter(r=>r.outsideLocatedCity);assert.equal(cross.length,4);for(const row of cross)assert(d.areas.filter(a=>a.providerId===row.providerId).every(a=>a.city==='新北市'));d.areas.push({id:'made-up',providerId:cross[0].providerId,city:'桃園市',district:'桃園區',active:true});assert.match(inspectNtpc(d).join('\n'),/Invented service coverage/);});
test('corrupted mobile phone, official address or unverified coordinates fail',()=>{const d=loadNtpc();const id=d.manifest.rows.find(r=>/^09/.test(r.sourcePhone)&&r.status==='ADDED').providerId;const p=d.providers.find(p=>p.id===id);p.phone='02-017';assert.match(inspectNtpc(d).join('\n'),/First source phone corrupted/);p.lat=25;assert.match(inspectNtpc(d).join('\n'),/Unverified coordinate invented/);p.address=p.address+'999號';assert.match(inspectNtpc(d).join('\n'),/Source address differs/);});
test('an extra duplicate office or area not stated by the source fails',()=>{const d=loadNtpc();const id=d.manifest.rows[0].providerId;d.providers.push({...d.providers.find(p=>p.id===id),id:'duplicate-ntpc'});assert.match(inspectNtpc(d).join('\n'),/Duplicate home-care/);d.areas.push({id:'not-in-source',providerId:id,city:'新北市',district:'烏來區',active:true});assert.match(inspectNtpc(d).join('\n'),/Invented service coverage/);});
test('additional coverage preserves the original source claim and rejects unregistered evidence',()=>{const d=loadNtpc();assert.deepEqual(checkEvidence(d,d.evidence).errors,[]);const item=d.evidence.serviceAreas.find(x=>x.additionalSources?.length);item.additionalSources[0].sourceId='unregistered';assert.match(checkEvidence(d,d.evidence).errors.join('\n'),/additional service-area source/);});
