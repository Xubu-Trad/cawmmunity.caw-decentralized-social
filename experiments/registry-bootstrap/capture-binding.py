"""Acquire paired registry and paid-probe code proofs on disposable local Anvil."""
import argparse,hashlib,importlib.util,json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--anvil',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
 assert not a.output.exists(),'NEW_OUTPUT_REQUIRED';a.output.mkdir(parents=True)
 assert hashlib.sha256((HERE/'run.py').read_bytes()).hexdigest()=='92956d04c3fb1c2c25c927dba2c216b0be72987a9ae0bbdf326bca3a2c4a7ffd','RUNNER_PIN'
 spec=importlib.util.spec_from_file_location('bootstrap_base',HERE/'run.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 record={'schema':'caw-paid-registry-binding-capture/1','complete':False,'localOnly':True,'impersonatedActors':True,'freshCompilation':False,'productionAccepted':False,'cases':[],'inputs':base.PINS};node=None;run=None
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
   rh='0x'+k.digest(bytes.fromhex(build['contracts']['TestAccountRegistry']['runtime'][2:])).hex()
   probes=[run.deploy('CawPaidActionProbe',(reg,rh),{'registry':reg,'registryCodeHash':rh}) for reg in (left,right)]
   header=node.rpc('selected_header','eth_getBlockByNumber',['latest',False])
   def acquire(label,address,slots):
    params=[address,slots,header['number']];node.proof_scope=params
    proof=node.rpc(label+'.proof','eth_getProof',params);base.need(node.proof_scope is None,'SCOPE_NOT_CONSUMED')
    code=node.rpc(label+'.code','eth_getCode',[address,header['number']])
    return {'header':header,'proof':proof,'code':code}
   for label,reg,probe,owner in [('left',left,probes[0],em.A),('right',right,probes[1],em.B)]:
    registry=acquire(label+'.registry',reg,keys);paid=acquire(label+'.probe',probe,[])
    direct=run.view(label+'.owner',reg,'authority(uint256)',1)
    binding=run.view(label+'.binding',probe,'registry()');codehash=run.view(label+'.codehash',probe,'registryCodeHash()')
    base.need(direct=='0x'+(em.word(owner)+em.word(0)).hex(),'DIRECT_OWNER')
    base.need(binding=='0x'+em.word(reg).hex() and codehash==rh,'DIRECT_BINDING')
    base.need(node.rpc(label+'.stable','eth_getBlockByNumber',['latest',False])['hash']==header['hash'],'STATE_MOVED')
    record['cases'].append({'name':label,'owner':owner,'epoch':'0x0','directAuthority':direct,'directRegistry':binding,'directCodeHash':codehash,
     'selection':{'schema':'caw-test-paid-registry-binding-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':reg,'probe':probe,'accountId':'0x1'},
     'evidence':{'registry':registry,'probe':paid}})
  base.need(node.receipt()['stop_reason'] is None,'NODE_STOP');record['complete']=True
 finally:
  if node:
   record['node']=node.receipt();trace=(json.dumps({'calls':node.calls,'remoteCalls':node.remote_calls,'transactions':run.rows if run else []},indent=2)+'\n').encode();(a.output/'trace.json').write_bytes(trace);record['traceSha256']=hashlib.sha256(trace).hexdigest()
  raw=(json.dumps(record,indent=2)+'\n').encode();base.need(len(raw)<524288,'CAPTURE_BOUND');(a.output/'capture.json').write_bytes(raw)
 print(json.dumps({'complete':record['complete'],'cases':len(record['cases'])}))
if __name__=='__main__':main()
