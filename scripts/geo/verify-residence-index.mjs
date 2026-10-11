import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../../',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const manifest=await load('data/residence/manifest.json');
const indexes=new Map(); let count=0;
if(Object.keys(manifest.districts).length!==41) throw new Error('Expected41 districts');
for(const [key,entry] of Object.entries(manifest.districts)) {
 const bytes=await readFile(new URL(`data/residence/${entry.file}`,root));
 if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256) throw new Error(`Changed index: ${key}`);
 const index=JSON.parse(bytes);
 if(Object.keys(index).length!==entry.count) throw new Error(`Invalid index count: ${key}`);
 for(const point of Object.values(index)) if(point.length!==2 || !point.every(Number.isFinite) || point[0]<24 || point[0]>26 || point[1]<120 || point[1]>123) throw new Error(`Invalid coordinate: ${key}`);
 count+=entry.count; indexes.set(key,index);
}
const providers=await load('data/providers/staging/providers.json');
const coordinates=await load('data/residence/provider-coordinates.json');
for(const [id,point] of Object.entries(coordinates)) {
 const provider=providers.find(p=>p.id===id); const exact=indexes.get(`${provider?.city}|${provider?.district}`)?.[point.matchedAddress];
 if(!exact || exact[0]!==point.lat || exact[1]!==point.lng) throw new Error(`Unproven provider coordinate: ${id}`);
}
console.log(`Residence data verified:41 districts, ${count} exact public addresses, ${Object.keys(coordinates).length} derived provider positions.`);
