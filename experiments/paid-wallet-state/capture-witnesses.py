"""Acquire fixed fixture dependencies immediately before/after mined posts."""
from pathlib import Path
import hashlib,runpy

def proof_node(module):
 class ProofNode(module.SignedNode):
  proof_permission=None
  def _params(self,method,params):
   if method=='eth_getProof':
    allowed=self.proof_permission;self.proof_permission=None
    if self.phase!='prefix' or self._lease_active or self._body_active or allowed is None or params!=allowed:raise RuntimeError('WALLET_PROOF_SCOPE')
    return
   return super()._params(method,params)
 return ProofNode

def witness(writer,result,label):
 node=writer.n;header=writer.header(label+'.witness_header');word=lambda n:int(n,16).to_bytes(32,'big') if isinstance(n,str) else n.to_bytes(32,'big')
 slot=lambda n:'0x'+word(n).hex();mapping=lambda key,root:'0x'+writer.k(word(key)+word(root)).hex()
 targets={writer.base_actor:[],header['miner']:[],result['wallet']:[slot(0)],
  writer.reg:[mapping(i,s) for s in (0,4) for i in (1,2,3)],
  writer.probe:[mapping(i,s) for s in (0,1,2) for i in (1,2,3)]+[slot(s) for s in (3,4,5,6)],
  '0xf3b9569f82b18aef890de263b84189bd33ebe452':[mapping(writer.probe,0)],
  '0x'+'00'*19+'01':[]}
 witnesses=[]
 for address,keys in targets.items():
  params=[address,keys,header['number']];assert node.proof_permission is None
  node.proof_permission=params
  try:proof=node.rpc(label+'.proof','eth_getProof',params)
  finally:node.proof_permission=None
  code=node.rpc(label+'.code','eth_getCode',[address,header['number']]);witnesses.append({'proof':proof,'code':code})
 assert writer.header(label+'.witness_stable')==header,'WITNESS_STATE_MOVED'
 return {'header':header,'witnesses':witnesses}

if __name__=='__main__':
 here=Path(__file__).resolve().parent
 assert hashlib.sha256((here/'capture-mined.py').read_bytes()).hexdigest()=='90c0b0b461b1d102031221d50c76b747801f34e2ad6ab3311fccc29c3af61abd','MINED_RUNNER_PIN'
 base=runpy.run_path(str(here/'capture-mined.py'))['mined']
 def mined(writer,result,label,calldata,accepted):
  if label=='valid':return
  parent=witness(writer,result,label+'.parent')
  base(writer,result,label,calldata,accepted)
  child=witness(writer,result,label+'.child')
  entry=result['mined'][-1];assert entry['parent']==parent['header'] and entry['header']==child['header']
  entry['parentWitnesses']=parent;entry['childWitnesses']=child
 path=here/'run_wallet_state.py';raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='b53b902e949b40d9e7e0502d544f9364d2c2c4370ba38464801090df941c3907','RUNNER_PIN'
 text=raw.decode();pairs=[('node = node_module.SignedNode(', 'node = proof_node(node_module)('),
 ("            result['submissions'] = copy.deepcopy(writer.signed_submissions)","                writer.base_actor=A\n                mined(writer,result,label,calldata,accepted)\n            result['submissions'] = copy.deepcopy(writer.signed_submissions)")]
 for old,new in pairs:
  assert text.count(old)==1,'TRANSFORM_COUNT';text=text.replace(old,new)
 exec(compile(text,str(path)+'[wallet-witness-extension]','exec'),{'__name__':'__main__','__file__':str(path),'mined':mined,'proof_node':proof_node})
