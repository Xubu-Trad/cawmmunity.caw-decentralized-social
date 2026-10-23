"""Constructed terminal state recipes for retained signed history, NOT execution."""
from pathlib import Path
import argparse,gzip,hashlib,json,runpy,sys
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[2]
def pinned(path,sha):
 raw=(root/path).read_bytes();assert hashlib.sha256(raw).hexdigest()==sha;return raw
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 assert not args.output.exists() and args.output.parent.is_dir()
 primitive='reference/fixtures/generate-ethereum-proof-fixtures.py'
 pinned(primitive,'5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa')
 p=runpy.run_path(str(root/primitive));h=runpy.run_path(str(root/'reference/fixtures/generate-execution-header-fixtures.py'))
 trace=gzip.decompress(pinned('experiments/paid-signed-body-acquisition/execution-trace.json.gz','d98a1b7c2e5d28bc05b75e427b7e2eacb7e237c6756c6dd460124feb6e18a276'))
 assert hashlib.sha256(trace).hexdigest()=='6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975'
 history=json.loads(trace)['branches']['left']['collectors']['number']['history']
 build=json.loads(pinned('experiments/account-authority/authority-build.json','43dca5ba9079d2f5a1bc4a155b21b31a147f573fd8ab995c7fbde3e11b9341fa'))
 code=bytes.fromhex(build['contracts']['TestAccountRegistry']['runtime'][2:]);k=p['digest'];rlp=p['rlp'];integer=p['integer'];Trie=p['Trie']
 word=lambda x:x.to_bytes(32,'big');hx=lambda b:'0x'+b.hex()
 owner=int('47ecac8221f18970c48cf48aaa3cbe8167bbbe73',16);operator=int('33'*20,16)
 address=bytes.fromhex(history['addresses']['registry'][2:]);cases=[]
 for name,o,epoch,approved,allowed in [('matching',owner,1,0,0),('wrong-owner',1,1,0,0),('wrong-epoch',owner,2,0,0),('wrong-approval',owner,1,operator,0),('wrong-operator',owner,1,0,1)]:
  keys=[k(word(1)+word(slot)) for slot in (0,4,2)]+[k(word(operator)+k(word(o)+word(3)))];values=[o,epoch,approved,allowed]
  storage=Trie([(k(key),rlp(integer(v))) for key,v in zip(keys,values) if v])
  account=rlp([integer(1),b'',storage.root,k(code)]);state=Trie([(k(address),account)])
  proof={'address':hx(address),'balance':'0x0','nonce':'0x1','codeHash':hx(k(code)),'storageHash':hx(storage.root),'accountProof':state.proof(k(address)),
   'storageProof':[{'key':hx(key),'value':hex(v),'proof':storage.proof(k(key))} for key,v in zip(keys,values)]}
  header=dict(history['end_block']);header['stateRoot']=hx(state.root);header['hash']=h['encoded_header'](header,'london-16',p)[1]
  cases.append({'name':name,'evidence':{'header':header,'proof':proof,'code':hx(code)},'selection':{'schema':'caw-test-registry-approval-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':hx(address),'accountId':'0x1','operator':hx(word(operator)[-20:])}})
 output={'schema':'caw-constructed-paid-registry-endpoints/1','synthetic':True,'executionClaim':False,'cases':cases}
 with args.output.open('x',encoding='utf-8',newline='\n') as f:f.write(json.dumps(output,indent=2)+'\n')
 print(json.dumps({'cases':len(cases),'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}))
if __name__=='__main__':main()
