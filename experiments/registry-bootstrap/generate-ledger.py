"""Construct proof cases; values are synthetic, not executed or funded states."""
from pathlib import Path
import hashlib,json,runpy,sys
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[2]
pins={'reference/fixtures/generate-ethereum-proof-fixtures.py':'5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa','reference/fixtures/generate-execution-header-fixtures.py':'da12c4533bb1e354518ab49d83f44cb06b0c309ea2bd2f3a1df79b2809bcb021','experiments/paid-action/paid-build.json':'54f130a1f49e8569cbe7b9a6db54547f8e1e9275d9c0c256b5d916b01a59c54e'}
for path,pin in pins.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==pin
p=runpy.run_path(str(root/'reference/fixtures/generate-ethereum-proof-fixtures.py'));h=runpy.run_path(str(root/'reference/fixtures/generate-execution-header-fixtures.py'))
digest=p['digest'];rlp=p['rlp'];Trie=p['Trie'];integer=p['integer'];word=lambda n:n.to_bytes(32,'big');hx=lambda b:'0x'+b.hex()
build=json.loads((root/'experiments/paid-action/paid-build.json').read_bytes());registry=bytes.fromhex('11'*20);probe=bytes.fromhex('22'*20);owner=int('33'*20,16)
regcode=bytes.fromhex(build['contracts']['TestAccountRegistry']['runtime'][2:]);template=build['contracts']['CawPaidActionProbe'];code=bytearray.fromhex(template['runtime'][2:])
for name,locations in template['immutables'].items():
 value=word(int.from_bytes(registry,'big')) if name=='registry' else digest(regcode)
 for loc in locations:assert loc['length']==32;code[loc['start']:loc['start']+32]=value
code=bytes(code);regkeys=[digest(word(1)+word(s)) for s in (0,4)];regvalues=[owner,0]
regstore=Trie([(digest(k),rlp(integer(v))) for k,v in zip(regkeys,regvalues) if v])
keys=[digest(word(i)+word(s)) for s in (0,1,2) for i in (1,2,3)]+[word(s) for s in (3,4,5,6)]
good=[100,200,300,10,20,30,2,1,0,600,7,3,0];cases=[]
scenarios=[('zero',[0]*13,None),('nonzero',good,None),('wrong-total',good[:9]+[601]+good[10:],'PAID_LEDGER_TOTAL'),('overlocked',good[:3]+[101]+good[4:],'PAID_LEDGER_STAKE'),('entered',good[:-1]+[1],'PAID_LEDGER_ENTERED'),('liability-overflow',[(1<<256)-1,0,0,0,0,0,0,0,0,(1<<256)-1,1,0,0],'PAID_LEDGER_OVERFLOW')]
for name,values,error in scenarios:
 store=Trie([(digest(k),rlp(integer(v))) for k,v in zip(keys,values) if v])
 state=Trie([(digest(registry),rlp([integer(1),b'',regstore.root,digest(regcode)])),(digest(probe),rlp([integer(1),b'',store.root,digest(code)]))])
 header=h['synthetic_header']('london-16',1);header['stateRoot']=hx(state.root);header['hash']=h['encoded_header'](header,'london-16',p)[1]
 def evidence(addr,code,storage,keys,values):
  return {'header':header,'code':hx(code),'proof':{'address':hx(addr),'balance':'0x0','nonce':'0x1','codeHash':hx(digest(code)),'storageHash':hx(storage.root),'accountProof':state.proof(digest(addr)),'storageProof':[{'key':hx(k),'value':hex(v),'proof':storage.proof(digest(k))} for k,v in zip(keys,values)]}}
 cases.append({'name':name,'expectedError':error,'expected':{'credits':list(map(str,values[:3])),'stakes':list(map(str,values[3:6])),'nonces':list(map(str,values[6:9])),'totalCredits':str(values[9]),'poolDust':str(values[10]),'messageCount':str(values[11])},'selection':{'schema':'caw-test-paid-registry-binding-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':hx(registry),'probe':hx(probe),'accountId':'0x1'},'evidence':{'registry':evidence(registry,regcode,regstore,regkeys,regvalues),'probe':evidence(probe,code,store,keys,values)}})
output=Path(sys.argv[1]);raw=(json.dumps({'schema':'caw-constructed-paid-ledger/1','synthetic':True,'executed':False,'funded':False,'pins':pins,'cases':cases},indent=2)+'\n').encode()
with output.open('xb') as f:f.write(raw)
print(json.dumps({'cases':len(cases),'sha256':hashlib.sha256(raw).hexdigest()}))
