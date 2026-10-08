import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { isProviderPublicInfo } from '../src/services/providerPublicInfo.js';
import { toImportPayload } from '../src/repositories/supabaseProviderRepository.js';
const info={assistivePrograms:['SMART_TECH'] as const,publicServices:['智慧科技輔具'],notice:null,sourceUrl:'https://dosw.gov.taipei/',checkedAt:'2026-10-08'};
describe('actual atomic Provider metadata SQL',()=>{
  it('metadata round-trips, old imports preserve it, and child failure rolls back metadata',async()=>{
    const db=new PGlite();
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role;
        create table providers (id text primary key,name text,type text,resource_category text,address text,city text,district text,lat double precision,lng double precision,phone text,website text,google_maps_url text,status text,verified boolean,created_at timestamptz,updated_at timestamptz);
        create table provider_services (id text primary key,provider_id text references providers(id),service_type text,active boolean);
        create table provider_service_areas (id text primary key,provider_id text references providers(id),city text,district text,active boolean);
        create table provider_contract_regions (id text primary key,provider_id text references providers(id),city text,service_type text,source_id text,checked_at timestamptz,active boolean);`);
      await db.exec(readFileSync(new URL('../supabase/migrations/0029_provider_public_info.sql',import.meta.url),'utf8'));
      const p={id:'SYNTHETIC',name:'synthetic SQL fixture',type:'ASSISTIVE_DEVICE',resource_category:'SERVICE_PROVIDER',public_info:info,address:'synthetic',city:'臺北市',district:'中正區',status:'ACTIVE',verified:true,created_at:'2026-10-08T00:00:00Z',updated_at:'2026-10-08T00:00:00Z'};
      const call=(payload:unknown)=>db.query('select import_provider_dataset($1::jsonb)',[JSON.stringify(payload)]);
      await call({providers:[p]});
      expect((await db.query<{public_info:unknown}>('select public_info from providers')).rows[0].public_info).toEqual(info);
      const {public_info,...old}=p; await call({providers:[old]});
      expect((await db.query<{public_info:unknown}>('select public_info from providers')).rows[0].public_info).toEqual(info);
      await expect(call({providers:[{...p,public_info:{...info,notice:'must rollback'}}],provider_services:[{id:'BAD',provider_id:'ABSENT',service_type:'ASSISTIVE_DEVICE',active:true}]})).rejects.toThrow();
      expect((await db.query<{public_info:unknown}>('select public_info from providers')).rows[0].public_info).toEqual(info);
    } finally {await db.close();}
  });
  it('private or malformed metadata is rejected at the Node boundary',()=>{
    expect(isProviderPublicInfo(info)).toBe(true);
    expect(isProviderPublicInfo({...info,contactName:'private'})).toBe(false);
    expect(isProviderPublicInfo({...info,sourceUrl:'javascript:alert(1)'})).toBe(false);
    expect(isProviderPublicInfo({...info,assistivePrograms:['UNKNOWN']})).toBe(false);
  });
});
