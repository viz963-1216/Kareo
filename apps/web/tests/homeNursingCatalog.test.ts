import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {isProviderDetail,isResourceLookupResponse} from '../src/api/realAdapter.ts';

test('actual public adapter loads all official nursing institutions, preserves district filters and accepts missing phones',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'kareo-nursing-'));
  try {
    const outfile=join(dir,'catalog.cjs');
    await build({stdin:{contents:"export {publicProviderApi} from './src/publicData/providerPreview';",resolveDir:fileURLToPath(new URL('..',import.meta.url)),loader:'ts'},outfile,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
    const api=createRequire(import.meta.url)(outfile).publicProviderApi;
    for(const [city,district,count] of [['臺北市',undefined,51],['新北市',undefined,96],['臺北市','松山區',4],['臺北市','大安區',4]] as const){
      const response=await api.getProviders({serviceType:'HOME_MEDICAL_NURSING',city,district,...(district?{areaFilter:'LOCATED_IN'}:{}),page:1,pageSize:50});
      assert.equal(response.totalCount,count); assert.equal(isResourceLookupResponse(response),true);
      assert.ok(response.items.every((p:any)=>p.city===city&&(!district||p.district===district)));
    }
    for(const id of ['TP-HMN-012','TP-HMN-051','NTPC-HMN-005','NTPC-HMN-013']){
      const p=await api.getProvider(id); assert.equal(p.phone,null); assert.equal(isProviderDetail(p),true);
      assert.equal(p.serviceAreaStatus,'UNCONFIRMED'); assert.deepEqual(p.serviceAreas,[]);
      assert.equal(isProviderDetail({...p,phone:123}),false); assert.equal(isProviderDetail({...p,phone:undefined}),false);
    }
    const response=await api.getProviders({serviceType:'HOME_MEDICAL_NURSING',city:'新北市',district:'板橋區',areaFilter:'SERVICE_AREA',page:1,pageSize:50});
    assert.equal(response.totalCount,0,'registered address cannot manufacture a home-service area');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
