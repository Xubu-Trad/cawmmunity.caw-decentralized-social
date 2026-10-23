"""Synthetic owner/epoch states, not deployed observations or execution traces."""
from pathlib import Path
import hashlib,json,runpy,sys
sys.dont_write_bytecode=True
here=Path(__file__).resolve().parent;root=here.parents[1]
primitive=here/'generate-ethereum-proof-fixtures.py'
assert hashlib.sha256(primitive.read_bytes()).hexdigest()=='5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa'
p=runpy.run_path(str(primitive));h=runpy.run_path(str(here/'generate-execution-header-fixtures.py'))
build=json.loads((root/'experiments/account-authority/authority-build.json').read_bytes())
code=bytes.fromhex(build['contracts']['TestAccountRegistry']['runtime'][2:])
assert hashlib.sha256(code).hexdigest()=='4745276b40204bd6e373b3f6c2e990ba8aeb3feb2de69a97b44510c58153d68f'
digest=p['digest'];rlp=p['rlp'];Trie=p['Trie'];integer=p['integer'];hx=lambda b:'0x'+b.hex()
address=bytes.fromhex('11'*20);codehash=digest(code);cases=[]
for name,owner,epoch in [('owner-a-zero-epoch',int('22'*20,16),0),('owner-b-epoch-two',int('33'*20,16),2),('zero-owner',0,0),('oversized-owner',1<<160,0),('maximum-epoch',int('22'*20,16),(1<<256)-1)]:
 keys=[digest((1).to_bytes(32,'big')+slot.to_bytes(32,'big')) for slot in [0,4]]
 values=[owner,epoch];storage=Trie([(digest(k),rlp(integer(v))) for k,v in zip(keys,values) if v])
 account=rlp([integer(1),b'',storage.root,codehash]);state=Trie([(digest(address),account)])
 proof={'address':hx(address),'balance':'0x0','nonce':'0x1','codeHash':hx(codehash),'storageHash':hx(storage.root),'accountProof':state.proof(digest(address)),
        'storageProof':[{'key':hx(k),'value':hex(v),'proof':storage.proof(digest(k))} for k,v in zip(keys,values)]}
 header=h['synthetic_header']('london-16',1);header['stateRoot']=hx(state.root);header['hash']=h['encoded_header'](header,'london-16',p)[1]
 cases.append({'name':name,'evidence':{'header':header,'proof':proof,'code':hx(code)},'selection':{'schema':'caw-test-registry-state-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':hx(address),'accountId':'0x1'},'keys':list(map(hx,keys)),'owner':hex(owner),'epoch':hex(epoch)})
output=here/'registry-state-v1.json';output.write_text(json.dumps({'schema':'caw-synthetic-registry-state/1','synthetic':True,'runtimeCodeHash':hx(codehash),'primitive_sha256':hashlib.sha256(primitive.read_bytes()).hexdigest(),'cases':cases},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'runtimeCodeHash':hx(codehash),'cases':len(cases)}))
