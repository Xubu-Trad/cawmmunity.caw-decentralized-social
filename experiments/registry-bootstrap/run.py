"""Local registry identity experiment; unchanged contracts, no public RPC.

Uses the retained compiler output, not a fresh compiler reproduction. Actors
are explicitly impersonated on disposable Anvil; this is not signature proof.
"""
import argparse,hashlib,importlib.util,json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
PINS={
 'experiments/paid-action/paid_node.py':'ecd540dfd3414b28cbb9d085254cc2be3de42ea7f13033afb40b72c6884a4160',
 'experiments/paid-action/run_paid_action.py':'92b50402f8ad097839ec4e40e7e221647c89c8b9d0b3c915c4ce2400531130bf',
 'experiments/paid-action/paid-build.json':'54f130a1f49e8569cbe7b9a6db54547f8e1e9275d9c0c256b5d916b01a59c54e',
 'reference/fixtures/generate-ethereum-proof-fixtures.py':'5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa'}
def need(ok,msg):
 if not ok:raise RuntimeError(msg)
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
def main():
 p=argparse.ArgumentParser();p.add_argument('--anvil',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
 need(not a.output.exists(),'NEW_OUTPUT_REQUIRED');a.output.mkdir(parents=True)
 record={'schema':'caw-registry-bootstrap-experiment/1','complete':False,'localOnly':True,'impersonatedActors':True,'productionAccepted':False,'freshCompilation':False,'checks':[],'inputs':PINS}
 node=None;run=None
 try:
  for path,pin in PINS.items():need(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==pin,'INPUT_PIN:'+path)
  build=json.loads((ROOT/'experiments/paid-action/paid-build.json').read_bytes())
  for path,pin in build['sources'].items():need(hashlib.sha256((ROOT/'experiments/paid-action'/path).read_bytes()).hexdigest()==pin,'BUILD_SOURCE_PIN')
  nm=load('bootstrap_node',ROOT/'experiments/paid-action/paid_node.py');em=load('bootstrap_experiment',ROOT/'experiments/paid-action/run_paid_action.py');k=load('bootstrap_keccak',ROOT/'reference/fixtures/generate-ethereum-proof-fixtures.py')
  class BoundedNode(nm.Node):
   def _live(self):
    if self.started and time.monotonic()-self.started>300:self._halt('BOOTSTRAP_DEADLINE');raise RuntimeError('BOOTSTRAP_DEADLINE')
    return super()._live()
  node=BoundedNode(a.anvil,'synthetic',a.output/'owned-node')
  with node:
   run=em.Run(node,k,build)
   for actor in (em.A,em.B,em.D):
    node.rpc('fund','anvil_setBalance',[actor,'0xde0b6b3a7640000']);node.rpc('impersonate','anvil_impersonateAccount',[actor])
   left=run.deploy('TestAccountRegistry',(em.A,em.B));right=run.deploy('TestAccountRegistry',(em.B,em.A))
   lc=node.rpc('left_code','eth_getCode',[left,'latest']);rc=node.rpc('right_code','eth_getCode',[right,'latest'])
   need(left!=right and lc==rc,'IDENTICAL_RUNTIME');rh='0x'+k.digest(bytes.fromhex(lc[2:])).hex()
   owners=[]
   for reg in (left,right):owners.append(run.view('owner',reg,'authority(uint256)',1))
   need(owners==['0x'+(em.word(em.A)+em.word(0)).hex(),'0x'+(em.word(em.B)+em.word(0)).hex()],'DIFFERENT_INITIAL_AUTHORITY')
   record['checks'].append('identical registry runtime; different initial owner; same epoch zero')
   probes=[]
   for reg in (left,right):
    probe=run.deploy('CawPaidActionProbe',(reg,rh),{'registry':reg,'registryCodeHash':rh});probes.append(probe)
    need(run.view('binding',probe,'registry()')=='0x'+em.word(reg).hex(),'REGISTRY_BINDING')
    need(run.view('code_binding',probe,'registryCodeHash()')==rh,'HASH_BINDING')
   record['checks'].append('both paid probes accept the same registry runtime hash and bind their selected address')
   bad=build['contracts']['CawPaidActionProbe']['bytecode']+(em.word(left)+em.word(1)).hex()
   run.send('wrong_runtime_pin',em.D,None,bad,False,'RegistryCodeChanged()')
   record['checks'].append('wrong runtime pin rejects deployment')
   for label,probe,owner,other in [('left',probes[0],em.A,em.B),('right',probes[1],em.B,em.A)]:
    run.call(label+'_nonowner',other,probe,'withdraw(uint256,uint256,uint256)',1,0,1,success=False,error='NotAccountOwner()')
    record['checks'].append(label+' nonowner rejected')
    run.call(label+'_owner_unfunded',owner,probe,'withdraw(uint256,uint256,uint256)',1,0,1,success=False,error='InsufficientCredit()')
    record['checks'].append(label+' current owner reaches unfunded-credit rejection; no withdrawal succeeds')
   run.call('transfer_left',em.A,left,'transferFrom(address,address,uint256)',em.A,em.B,1)
   need(run.view('transferred_authority',left,'authority(uint256)',1)=='0x'+(em.word(em.B)+em.word(1)).hex(),'TRANSFER_AUTHORITY')
   run.call('stale_epoch',em.B,probes[0],'withdraw(uint256,uint256,uint256)',1,0,1,success=False,error='StaleEpoch()')
   record['checks'].append('transfer increments epoch; new owner with stale epoch rejected')
   run.call('old_owner',em.A,probes[0],'withdraw(uint256,uint256,uint256)',1,1,1,success=False,error='NotAccountOwner()')
   record['checks'].append('old owner with current epoch rejected')
   run.call('new_owner_unfunded',em.B,probes[0],'withdraw(uint256,uint256,uint256)',1,1,1,success=False,error='InsufficientCredit()')
   record['checks'].append('new owner with current epoch reaches unfunded-credit rejection')
   need(node.rpc('left_final_code','eth_getCode',[left,'latest'])==lc,'CODE_UNCHANGED')
   need(run.view('right_unchanged',right,'authority(uint256)',1)==owners[1],'OTHER_REGISTRY_UNCHANGED')
   record['checks'].append('transfer leaves runtime and other registry authority unchanged')
   record.update(complete=True,registryRuntimeKeccak=rh,registryRuntimeSha256=hashlib.sha256(bytes.fromhex(lc[2:])).hexdigest(),registries=[left,right],probes=probes,initialAuthority=owners,passed=len(record['checks']))
 finally:
  if node:
   record['guard']=node.receipt()
   trace={'calls':node.calls,'remoteCalls':node.remote_calls,'transactions':run.rows if run else []}
   raw=(json.dumps(trace,indent=2)+'\n').encode();(a.output/'trace.json').write_bytes(raw);record['traceSha256']=hashlib.sha256(raw).hexdigest()
  (a.output/'result.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
 if record['complete']:print(json.dumps({'passed':record['passed'],'complete':True,'productionAccepted':False}))
if __name__=='__main__':main()
