// Produce a guarded, public-data-only delta for the existing Kareo import RPC.
// Does not connect to a database; SQL is reviewed and executed separately.
import {writeFileSync} from 'node:fs';
import {verifyNursingFiles,loadNursing} from '../data/providers/qa/verify-home-nursing.mjs';
import {toImportPayload} from '../apps/api/dist/repositories/supabaseProviderRepository.js';
const data=loadNursing(),errors=verifyNursingFiles(data);
if(errors.length) throw new Error(errors.join('\n'));
const ids=new Set(data.manifest.rows.filter(r=>r.status==='ADDED').map(r=>r.providerId));
const info=new Map(data.info.map(r=>[r.providerId,r.publicInfo]));
// Use the same runtime timestamps and default category as the validated importer.
// Source records intentionally contain no database write timestamps.
const {nowTaipeiISOString}=await import('../apps/api/dist/lib/response.js');
const {importProviderDataset,hasRejections}=await import('../apps/api/dist/services/providerImportService.js');
const sourceProviders=data.providers.filter(p=>ids.has(p.id)).map(p=>({...p,publicInfo:info.get(p.id)}));
const sourceServices=data.services.filter(s=>ids.has(s.providerId));
const report=await importProviderDataset({}, {providers:sourceProviders,providerServices:sourceServices,providerServiceAreas:[],providerContractRegions:[]},{mode:'dry-run'});
if(hasRejections(report)||report.providersValid!==144||report.servicesValid!==144) throw new Error('Delta importer validation failed');
const now=nowTaipeiISOString();
const payload=toImportPayload({providers:sourceProviders.map(p=>({...p,resourceCategory:p.resourceCategory??'SERVICE_PROVIDER',createdAt:now,updatedAt:now})),services:sourceServices,serviceAreas:[],contractRegions:[]});
const retained=data.manifest.rows.filter(r=>r.status==='RETAINED').map(r=>({id:r.providerId,public_info:info.get(r.providerId)}));
const literal=value=>'$nursing147$'+JSON.stringify(value)+'$nursing147$::jsonb';
if(JSON.stringify([payload,retained]).includes('$nursing147$')) throw new Error('SQL delimiter in source');
const sql=`begin;
set local role service_role;
lock table public.providers, public.provider_services, public.provider_service_areas, public.provider_contract_regions in share row exclusive mode;
do $guard$
declare payload jsonb := ${literal(payload)};
retained jsonb := ${literal(retained)};
result jsonb;
begin
 if (select count(*) from providers) <> 1118 or (select md5(string_agg((to_jsonb(p)-'public_info')::text,',' order by id)) from providers p) <> '0bf6176b8bd230abf5e7e8ba2bf4cb8f' then raise exception 'Provider baseline changed; abort'; end if;
 if (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from provider_services p) <> '9773f7f55af804ef4f5588cd131b102a' then raise exception 'Service baseline changed; abort'; end if;
 if (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from provider_service_areas p) <> 'a026c0c369e30de8424afb92a7e58d53' or (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from provider_contract_regions p) <> '2e43ad93cde41c022f03fb1956981ba7' then raise exception 'Coverage baseline changed; abort'; end if;
 if exists(select 1 from providers p join jsonb_to_recordset(payload->'providers') as n(id text) using(id)) or (select count(*) from providers where id in ('TP-HMN-001','TP-HMN-002','TP-HMN-003') and public_info is null) <> 3 then raise exception 'Delta collision or metadata drift; abort'; end if;
 result := public.import_provider_dataset(payload);
 if result <> '{"providers":144,"provider_services":144,"provider_service_areas":0,"provider_contract_regions":0}'::jsonb then raise exception 'Wrong RPC write counts'; end if;
 update providers p set public_info=r.public_info from jsonb_to_recordset(retained) as r(id text,public_info jsonb) where p.id=r.id and p.public_info is null;
 if (select count(*) from providers where type='HOME_MEDICAL_NURSING') <> 147 or (select count(*) from providers) <> 1262 then raise exception 'Wrong final totals'; end if;
 if (select md5(string_agg((to_jsonb(p)-'public_info')::text,',' order by id)) from providers p where not exists(select 1 from jsonb_to_recordset(payload->'providers') as n(id text) where n.id=p.id)) <> '0bf6176b8bd230abf5e7e8ba2bf4cb8f' then raise exception 'Old provider core changed'; end if;
 if (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from provider_services p where not exists(select 1 from jsonb_to_recordset(payload->'provider_services') as n(id text) where n.id=p.id)) <> '9773f7f55af804ef4f5588cd131b102a' then raise exception 'Old service changed'; end if;
 if (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from provider_service_areas p) <> 'a026c0c369e30de8424afb92a7e58d53' or (select md5(string_agg(to_jsonb(p)::text,',' order by id)) from provider_contract_regions p) <> '2e43ad93cde41c022f03fb1956981ba7' then raise exception 'Coverage changed'; end if;
 if exists(select 1 from jsonb_to_recordset(payload->'providers') as n(id text,name text,type text,resource_category text,public_info jsonb,address text,city text,district text,lat double precision,lng double precision,phone text,website text,google_maps_url text,status text,verified boolean,created_at timestamptz,updated_at timestamptz) left join providers p using(id) where p.id is null or (p.name,p.type,p.resource_category,p.public_info,p.address,p.city,p.district,p.lat,p.lng,p.phone,p.website,p.google_maps_url,p.status,p.verified,p.created_at,p.updated_at) is distinct from (n.name,n.type,n.resource_category,n.public_info,n.address,n.city,n.district,n.lat,n.lng,n.phone,n.website,n.google_maps_url,n.status,n.verified,n.created_at,n.updated_at)) then raise exception 'New provider readback mismatch'; end if;
 if exists(select 1 from jsonb_to_recordset(payload->'provider_services') as n(id text,provider_id text,service_type text,active boolean) left join provider_services s using(id) where s.id is null or (s.provider_id,s.service_type,s.active) is distinct from (n.provider_id,n.service_type,n.active)) then raise exception 'Service readback mismatch'; end if;
 if exists(select 1 from jsonb_to_recordset(retained) as n(id text,public_info jsonb) join providers p using(id) where p.public_info is distinct from n.public_info) then raise exception 'Retained metadata mismatch'; end if;
end $guard$;
commit;
select jsonb_build_object('providers',(select count(*) from providers),'services',(select count(*) from provider_services),'nursing',(select count(*) from providers where type='HOME_MEDICAL_NURSING'),'nursingTaipei',(select count(*) from providers where type='HOME_MEDICAL_NURSING' and city='臺北市'),'nursingNewTaipei',(select count(*) from providers where type='HOME_MEDICAL_NURSING' and city='新北市'),'phonePending',(select count(*) from providers where type='HOME_MEDICAL_NURSING' and phone is null)) as verified_import;
`;
const target=process.argv[2];if(!target) throw new Error('Supply an output SQL path; this command never executes SQL.');
writeFileSync(target,sql);console.log('Prepared guarded 144-provider + 144-service delta and 3 metadata additions. No database writes.');
