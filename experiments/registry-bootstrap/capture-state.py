"""Acquire same-code/different-registry proofs on disposable local Anvil."""
import argparse,hashlib,importlib.util,json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--anvil',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
 assert not a.output.exists(),'NEW_OUTPUT_REQUIRED';a.output.mkdir(parents=True)
 assert hashlib.sha256((HERE/'run.py').read_bytes()).hexdigest()=='92956d04c3fb1c2c25c927dba2c216b0be72987a9ae0bbdf326bca3a2c4a7ffd','RUNNER_PIN'
 spec=importlib.util.spec_from_file_location('bootstrap_base',HERE/'run.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 record={'schema':'caw-registry-bootstrap-state/1','complete':False,'localOnly':True,'impersonatedActors':True,'freshCompilation':False,'productionAccepted':False,'cases':[],'inputs':base.PINS};node=None;run=None
 try:
  for path,pin in base.PINS.items():base.need(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==pin,'INPUT_PIN')
  build=json.loads((ROOT/'experiments/paid-action/paid-build.json').read_bytes())
  for path,pin in build['sources'].items():base.need(hashlib.sha256((ROOT/'experiments/paid-action'/path).read_bytes()).hexdigest()==pin,'BUILD_SOURCE_PIN')
  nm=base.load('bootstrap_state_node',ROOT/'experiments/paid-action/paid_node.py');em=base.load('bootstrap_state_experiment',ROOT/'experiments/paid-action/run_paid_action.py');k=base.load('bootstrap_state_keccak',ROOT/'reference/fixtures/generate-ethereum-proof-fixtures.py')
  class ProofNode(nm.Node):
   proof_scope=None
   def _live(self):
    if self.started and time.monotonic()-self.started>300:self._halt('BOOTSTRAP_DEADLINE');raise RuntimeError('BOOTSTRAP_DEADLINE')
    return super()._live()
   def _params(self,method,params):
    if method=='eth_getProof':
     allowed=self.proof_scope;self.proof_scope=None
     base.need(allowed is not None and params==allowed,'PROOF_SCOPE_REFUSED');return
    return super()._params(method,params)
  node=ProofNode(a.anvil,'synthetic',a.output/'owned-node')
  with node:
   run=em.Run(node,k,build)
   for actor in (em.A,em.B,em.D):node.rpc('fund','anvil_setBalance',[actor,'0xde0b6b3a7640000']);node.rpc('actor','anvil_impersonateAccount',[actor])
   left=run.deploy('TestAccountRegistry',(em.A,em.B));right=run.deploy('TestAccountRegistry',(em.B,em.A))
   keys=['0x'+k.digest(em.word(1)+em.word(slot)).hex() for slot in (0,4)]
   def capture(name,reg,owner,epoch):
    header=node.rpc(name+'.header','eth_getBlockByNumber',['latest',False]);params=[reg,keys,header['number']];node.proof_scope=params
    proof=node.rpc(name+'.proof','eth_getProof',params);base.need(node.proof_scope is None,'SCOPE_NOT_CONSUMED')
    code=node.rpc(name+'.code','eth_getCode',[reg,header['number']]);direct=run.view(name+'.authority',reg,'authority(uint256)',1)
    base.need(direct=='0x'+(em.word(owner)+em.word(epoch)).hex(),'DIRECT_AUTHORITY')
    base.need(node.rpc(name+'.stable','eth_getBlockByNumber',['latest',False])['hash']==header['hash'],'STATE_MOVED')
    record['cases'].append({'name':name,'owner':owner,'epoch':hex(epoch),'directAuthority':direct,'selection':{'schema':'caw-test-registry-state-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':reg,'accountId':'0x1'},'evidence':{'header':header,'proof':proof,'code':code}})
   capture('left_initial',left,em.A,0);capture('right_initial',right,em.B,0)
   base.need(record['cases'][0]['evidence']['header']==record['cases'][1]['evidence']['header'],'SAME_INITIAL_HEADER')
   base.need(record['cases'][0]['evidence']['code']==record['cases'][1]['evidence']['code'],'SAME_RUNTIME')
   run.call('left_transfer',em.A,left,'transferFrom(address,address,uint256)',em.A,em.B,1);capture('left_transferred',left,em.B,1)
  base.need(node.receipt()['stop_reason'] is None,'NODE_STOP');record['complete']=True
 finally:
  if node:
   record['node']=node.receipt();trace=(json.dumps({'calls':node.calls,'remoteCalls':node.remote_calls,'transactions':run.rows if run else []},indent=2)+'\n').encode();(a.output/'trace.json').write_bytes(trace);record['traceSha256']=hashlib.sha256(trace).hexdigest()
  raw=(json.dumps(record,indent=2)+'\n').encode();base.need(len(raw)<524288,'CAPTURE_BOUND');(a.output/'capture.json').write_bytes(raw)
 print(json.dumps({'complete':record['complete'],'cases':len(record['cases'])}))
if __name__=='__main__':main()
