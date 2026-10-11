import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectNursing,loadNursing,verifyNursingFiles} from '../verify-home-nursing.mjs';
import {nursingPhone} from '../lib/home-nursing-phone.mjs';
test('both official rosters reconciled without losing prior resources',()=>assert.deepEqual(verifyNursingFiles(),[]));
test('a missing institution or serial fails',()=>{const d=loadNursing();d.providers=d.providers.filter(p=>p.id!=='NTPC-HMN-096');d.manifest.rows.pop();assert.match(inspectNursing(d).join('\n'),/missing|incomplete/);});
test('a wrong district or address fails official identity checks',()=>{const d=loadNursing();d.providers.find(p=>p.id==='TP-HMN-013').district='內湖區';assert.match(inspectNursing(d).join('\n'),/identity/);});
test('institution address must not become service coverage or a guessed coordinate',()=>{const d=loadNursing();d.areas.push({id:'fake',providerId:'TP-HMN-013',city:'臺北市',district:'松山區',active:true});d.providers.find(p=>p.id==='TP-HMN-013').lat=25;assert.match(inspectNursing(d).join('\n'),/Invented coverage/);});
test('changes to prior providers or service areas fail immutable baseline',()=>{const d=loadNursing();d.providers[0].name+='changed';d.areas[0].district='wrong';assert.match(inspectNursing(d).join('\n'),/Existing row changed/);});
test('missing or malformed official phones remain null, valid split numbers retain extension',()=>{
 for(const [raw,expected] of [['02-2364-6040轉17','02-23646040轉17'],['02-27372181-3938','02-27372181轉3938'],['0921-066248','0921066248'],['(02)22820677;0979033731','02-22820677'],['02-25523234轉3271或3273','02-25523234轉3271'],['02-278612885轉8984',null],['0922-26464',null],['29600200',null],['',null]]) assert.equal(nursingPhone(raw),expected);
 const d=loadNursing();d.providers.find(p=>p.id==='NTPC-HMN-005').phone='02-12345678';assert.match(inspectNursing(d).join('\n'),/Source phone differs/);
});
