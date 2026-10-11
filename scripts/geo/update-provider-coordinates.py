"""Refresh derived public provider points from the checked-in official address indexes.
No network, interpolation, user address or changes to the authoritative Provider data.
"""
import json, re, unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/residence'
NUM={'零':0,'〇':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
def number(s):
    if '十' in s:
        a,b=s.split('十');return str(NUM.get(a,1)*10+NUM.get(b,0))
    return ''.join(str(NUM[c]) for c in s)
def normalize(s):
    s=unicodedata.normalize('NFKC',s).replace('台','臺')
    s=re.sub(r'[\s,，、]','',s)
    s=re.sub(r'[零〇一二三四五六七八九十]+(?=[段巷弄號])',lambda m:number(m[0]),s)
    s=re.sub(r'號之([0-9]+)',r'之\1號',s)
    m=re.match(r'^(.+?號)',s)
    return m[1] if m else ''
m=json.loads((OUT/'manifest.json').read_text())
indexes={k:json.loads((OUT/v['file']).read_text()) for k,v in m['districts'].items()}
derived={};unresolved=[]
for p in json.loads((ROOT/'data/providers/staging/providers.json').read_text()):
    key=normalize(p['address']).removeprefix((p['city']+p['district']).replace('台','臺'))
    coords=indexes.get(p['city']+'|'+p['district'],{}).get(key)
    if coords:derived[p['id']]={'lat':coords[0],'lng':coords[1],'source':'TAIPEI-2026-10' if p['city']=='臺北市' else 'NTPC-11509','matchedAddress':key}
    else:unresolved.append(p['id'])
(OUT/'provider-coordinates.json').write_text(json.dumps(derived,ensure_ascii=False,indent=2)+'\n')
m['providerMatched']=len(derived);m['providerUnresolvedIds']=unresolved
(OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Derived public points:',len(derived),'unresolved:',len(unresolved))
