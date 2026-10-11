#!/usr/bin/env python3
"""Build public, offline house-number indexes. Requires pyproj; never user input.
Usage: python build-residence-index.py taipei.csv ntpc.zip
Raw downloads stay outside Git. EPSG:3826 -> EPSG:4326, no address interpolation.
"""
import csv, hashlib, io, json, re, sys, unicodedata, zipfile
from pathlib import Path
from collections import defaultdict
from pyproj import Transformer
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/residence'
NUM = {'零':0,'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
def number(s):
 if '十' in s:
  a,b=s.split('十'); return str(NUM.get(a,1)*10+NUM.get(b,0))
 return ''.join(str(NUM[c]) for c in s)
def normalize(s):
 s=unicodedata.normalize('NFKC',s).replace('台','臺')
 s=re.sub(r'[\s,，、]','',s)
 s=re.sub(r'[零〇一二三四五六七八九十]+(?=[段巷弄號])',lambda m:number(m[0]),s)
 s=re.sub(r'號之([0-9]+)',r'之\1號',s)
 m=re.match(r'^(.+?號)',s)
 return m[1] if m else ''
tp=['松山區','信義區','大安區','中山區','中正區','大同區','萬華區','文山區','南港區','內湖區','士林區','北投區']
nt=json.loads((ROOT/'contracts/reference/service-districts.json').read_text())['cities'][1]['districts']
groups=defaultdict(dict); ambiguous=set(); counts={}; transform=Transformer.from_crs(3826,4326,always_xy=True)
def ingest(rows,city,districts,columns):
 count=0
 for row in rows:
  count+=1
  try:
   code=row[columns[0]].strip(); i=int(code[-3:])//10-1
   if i<0 or i>=len(districts): continue
   district=districts[i]
   address=normalize(''.join(row[c].strip() for c in columns[1:6]))
   if not address: continue
   x,y=float(row[columns[6]]),float(row[columns[7]])
   if not (230000<x<360000 and 2680000<y<2820000): continue
   key=(city,district,address)
   if key in ambiguous: continue
   old=groups[(city,district)].get(address)
   if old and ((old[0]-x)**2+(old[1]-y)**2)**.5>30:
    groups[(city,district)].pop(address,None); ambiguous.add(key); continue
   groups[(city,district)][address]=(x,y)
  except (KeyError,ValueError): continue
 counts[city]=count
with open(sys.argv[1],encoding='utf-8-sig',newline='') as f:
 ingest(csv.DictReader(f),'臺北市',tp,['鄉鎮市區代碼','街路段','地區','巷','弄','號','橫座標','縱座標'])
with zipfile.ZipFile(sys.argv[2]) as z:
 with z.open(z.namelist()[0]) as f:
  ingest(csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig',newline='')),'新北市',nt,['areacode','street、road、section','area','lane','alley','number','x_3826','y_3826'])
OUT.mkdir(exist_ok=True,parents=True)
index={}; loaders=[]; converted={}
for (city,district),entries in sorted(groups.items()):
 code=('tp' if city=='臺北市' else 'nt')+str((tp if city=='臺北市' else nt).index(district)+1).zfill(2)
 result={}
 for key,(x,y) in entries.items():
  lng,lat=transform.transform(x,y)
  result[key]=[round(lat,6),round(lng,6)]
 converted[(city,district)]=result
 payload=json.dumps(dict(sorted(result.items())),ensure_ascii=False,separators=(',',':'))+'\n'
 (OUT/(code+'.json')).write_text(payload)
 loaders.append(f'  {json.dumps(city+"|"+district,ensure_ascii=False)}: () => import("./{code}.json"),')
 index[city+'|'+district]={'count':len(result),'file':code+'.json','sha256':hashlib.sha256(payload.encode()).hexdigest()}

providers=json.loads((ROOT/'data/providers/staging/providers.json').read_text()); derived={}; unresolved=[]
for p in providers:
 key=normalize(p['address']); prefix=(p['city']+p['district']).replace('台','臺')
 key=key.removeprefix(prefix)
 coords=converted.get((p['city'],p['district']),{}).get(key)
 if coords: derived[p['id']]={'lat':coords[0],'lng':coords[1],'source':('TAIPEI-2026-10' if p['city']=='臺北市' else 'NTPC-11509'),'matchedAddress':key}
 else: unresolved.append(p['id'])
(OUT/'provider-coordinates.json').write_text(json.dumps(derived,ensure_ascii=False,indent=2)+'\n')
manifest={'retrievedAt':'2026-10-11','license':'政府資料開放授權條款-第1版','licenseUrl':'https://data.gov.tw/license','sources':[{'publisher':'臺北市政府民政局','title':'臺北市門牌位置數值資料','version':'2026-10-02','url':'https://data.taipei/dataset/detail?id=b7c8e724-1e98-45ee-a0bd-f3840623ed97','download':'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=ce76ca0c-7f94-4935-ab47-1d2a41ca2abb','sha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()},{'publisher':'新北市政府民政局','title':'新北市門牌位置數值資料','version':'11509','url':'https://data.ntpc.gov.tw/datasets/d7b568ab-3819-40c8-a6e7-a6b199443101','download':'https://data.ntpc.gov.tw/api/datasets/d7b568ab-3819-40c8-a6e7-a6b199443101/csv/zip','sha256':hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest()}],'projection':'EPSG:3826 -> EPSG:4326 (pyproj, always_xy)','rawRowCounts':counts,'ambiguousRemoved':len(ambiguous),'districts':index,'providerMatched':len(derived),'providerUnresolvedIds':unresolved}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'raw':counts,'unique':sum(x['count'] for x in index.values()),'districts':len(index),'ambiguous':len(ambiguous),'providersMatched':len(derived),'unresolved':len(unresolved)},ensure_ascii=False))
