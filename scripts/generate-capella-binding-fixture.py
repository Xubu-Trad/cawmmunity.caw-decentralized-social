"""Synthetic body/header composition using one official payload-header vector."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[1]
payload=json.loads((R/'evidence/consensus-capella-payload/vectors.json').read_text())['cases'][0]
header=json.loads((R/'evidence/consensus-beacon-header/vectors.json').read_text())['cases'][0]['header']
sha=lambda a,b:hashlib.sha256(a+b).digest()
hx=lambda b:'0x'+b.hex()
levels=[[hashlib.sha256(f'synthetic body field {i}'.encode()).digest() for i in range(16)]]
levels[0][9]=bytes.fromhex(payload['root'][2:])
while len(levels[-1])>1:
 a=levels[-1];levels.append([sha(a[i],a[i+1]) for i in range(0,len(a),2)])
header=dict(header,body_root=hx(levels[-1][0]))
chunks=[int(header['slot']).to_bytes(32,'little'),int(header['proposer_index']).to_bytes(32,'little')]+[bytes.fromhex(header[k][2:]) for k in ['parent_root','state_root','body_root']]+[bytes(32)]*3
while len(chunks)>1:chunks=[sha(chunks[i],chunks[i+1])for i in range(0,len(chunks),2)]
fixture={'origin':'synthetic body and beacon root; official payload-header case 0; not a live or official combined light-client fixture',
 'selectedBeaconRoot':hx(chunks[0]),'input':{'schema':'caw-capella-header-binding/1','profile':'capella-structural-only','beacon':header,'execution':payload['header'],'executionRoot':payload['root'],'executionBranch':[hx(levels[d][(9//2**d)^1])for d in range(4)]}}
(R/'evidence/CAPELLA_BINDING_FIXTURE.json').write_text(json.dumps(fixture,indent=2)+'\n')
