"""Pinned signed-withdrawal experiment, extended only with endpoint ledger proofs.

The existing branch acquisition, writer retirement, guards and negative checks
are unchanged. Two exact source substitutions are checked before execution.
"""
import copy,hashlib
from pathlib import Path

def ledger_node_class(module,k):
 class LedgerNode(module.SignedNode):
  def paid_endpoint_proof(self):
   if self.phase not in ('read-left','read-right') or self._lease_active or self._body_active or self._proof_permission is not None:
    raise RuntimeError('STATE_READ_SCOPE')
   word=lambda n:n.to_bytes(32,'big')
   keys=['0x'+k.digest(word(i)+word(slot)).hex() for slot in (0,1,2) for i in (1,2,3)]+['0x'+word(slot).hex() for slot in (3,4,5,6)]
   config=self._scope.read_config
   params=[config['addresses']['probe'],keys,hex(config['end_block_number'])]
   self._proof_permission=((params[0],tuple(keys),params[2]),self.generation,self.phase)
   try:
    result=self.rpc('collector.'+self.phase[5:]+'.paid-proof','eth_getProof',params)
    if self._proof_permission is not None:raise RuntimeError('STATE_PERMISSION_UNCONSUMED')
    return result
   finally:self._proof_permission=None
 return LedgerNode

def attach_ledger(node,captured,end,registry_runtime,probe_runtime,k):
 before=len(node.calls)
 params=[captured['config']['addresses']['probe'],[],end['number']]
 try:node.rpc('unleased-paid-proof','eth_getProof',params)
 except RuntimeError as error:
  assert str(error)=='STATE_READ_SCOPE' and len(node.calls)==before,'PAID_UNLEASED_REFUSAL'
 else:raise RuntimeError('PAID_UNLEASED_ALLOWED')
 paid=node.paid_endpoint_proof()
 registry=copy.deepcopy(captured['registry_state']['evidence'])
 keys={'0x'+k.digest((1).to_bytes(32,'big')+slot.to_bytes(32,'big')).hex() for slot in (0,4)}
 registry['proof']['storageProof']=[p for p in registry['proof']['storageProof'] if p['key'] in keys]
 assert len(registry['proof']['storageProof'])==2,'REGISTRY_OWNER_EPOCH_KEYS'
 captured['ledger']={'schema':'caw-test-ledger-history/1',
  'evidence':{'registry':registry,'probe':{'header':end,'proof':paid,'code':probe_runtime}},
  'selection':{'schema':'caw-test-paid-registry-binding-selection/1','headerProfile':'london-16','hash':end['hash'],
   'registry':captured['config']['addresses']['registry'],'probe':captured['config']['addresses']['probe'],'accountId':'0x1'},
  'history':captured['collectors']['number']['history'],'manifest':captured['collectors']['number']['manifest']}
 assert registry['code']==registry_runtime,'REGISTRY_RUNTIME'
 captured['paid_unleased_refused_before_transport']=True

if __name__=='__main__':
 path=Path(__file__).resolve().parent/'../paid-signed-withdrawal-acquisition/run_signed_withdrawals.py'
 raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='4bb76ce61dbd120d79f095767b0335a15c8e3b0c2ad4e37accb8596147e812c9','RUNNER_PIN'
 text=raw.decode()
 replacements=[('node = node_module.SignedNode(', 'node = ledger_node_class(node_module,k)('),
  ('                return read','                attach_ledger(node,captured,end,registry_runtime,probe_runtime,k)\n                return read')]
 for old,new in replacements:
  assert text.count(old)==1,'TRANSFORM_COUNT'
  text=text.replace(old,new)
 scope={'__name__':'__main__','__file__':str(path),'ledger_node_class':ledger_node_class,'attach_ledger':attach_ledger}
 exec(compile(text,str(path)+'[ledger-proof-extension]','exec'),scope)
