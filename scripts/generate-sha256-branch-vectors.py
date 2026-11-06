from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[1]
h=lambda b:hashlib.sha256(b).digest()
hx=lambda b:'0x'+b.hex()
levels=[[h(('caw synthetic leaf '+str(i)).encode()) for i in range(16)]]
while len(levels[-1])>1:
 layer=levels[-1];levels.append([h(layer[i]+layer[i+1]) for i in range(0,len(layer),2)])
proofs=[]
for i in range(16):
 proofs.append(dict(schema='caw-sha256-branch/1',leaf=hx(levels[0][i]),branch=[hx(levels[d][(i//2**d)^1]) for d in range(4)],depth=4,index=i,root=hx(levels[-1][0])))
zero=dict(schema='caw-sha256-branch/1',leaf=hx(levels[0][0]),branch=[],depth=0,index=0,root=hx(levels[0][0]))
siblings=[h(('high sibling '+str(i)).encode())for i in range(32)];value=levels[0][0]
for sibling in siblings:value=h(sibling+value)
high=dict(schema='caw-sha256-branch/1',leaf=hx(levels[0][0]),branch=list(map(hx,siblings)),depth=32,index=2**32-1,root=hx(value))
(R/'evidence/SHA256_BRANCH_VECTORS.json').write_text(json.dumps(dict(origin='synthetic Python hashlib whole-tree construction; not consensus-spec official vectors',proofs=proofs,zero=zero,high=high),indent=2)+'\n')
