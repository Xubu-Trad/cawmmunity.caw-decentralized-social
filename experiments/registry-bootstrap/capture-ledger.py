"""Acquire synthetic-token executed ledger proofs and bounded history."""
import argparse,hashlib,importlib.util,json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--anvil',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
 assert not a.output.exists(),'NEW_OUTPUT_REQUIRED';a.output.mkdir(parents=True)
 assert hashlib.sha256((HERE/'run.py').read_bytes()).hexdigest()=='92956d04c3fb1c2c25c927dba2c216b0be72987a9ae0bbdf326bca3a2c4a7ffd','RUNNER_PIN'
 spec=importlib.util.spec_from_file_location('bootstrap_base',HERE/'run.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
 record={'schema':'caw-executed-paid-ledger/1','complete':False,'localOnly':True,'impersonatedActors':True,'freshCompilation':False,'syntheticToken':True,'realTokenEvidence':False,'productionAccepted':False,'cases':[],'inputs':base.PINS};node=None;run=None
 try:
  for path,pin in base.PINS.items():base.need(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==pin,'INPUT_PIN')
  build=json.loads((ROOT/'experiments/paid-action/paid-build.json').read_bytes())
  for path,pin in build['sources'].items():base.need(hashlib.sha256((ROOT/'experiments/paid-action'/path).read_bytes()).hexdigest()==pin,'BUILD_SOURCE_PIN')
  nm=base.load('bootstrap_state_node',ROOT/'experiments/paid-action/paid_node.py');em=base.load('bootstrap_state_experiment',ROOT/'experiments/paid-action/run_paid_action.py');k=base.load('bootstrap_state_keccak',ROOT/'reference/fixtures/generate-ethereum-proof-fixtures.py')
  for path,pin in {'experiments/paid-adversarial/synthetic_node.py':'5d3e509cb2557b791a6d4c8dc012a75f41f9cdc2ce10b1df708034fbcabad8d3','experiments/account-authority/account-token-build.json':'55a07478fa4673c9d48d4f5905b1b73cc540e6bac90b023cec705cf80562129f'}.items():
   base.need(hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==pin,'SYNTHETIC_INPUT_PIN');record['inputs'][path]=pin
  synthetic=base.load('ledger_synthetic_node',ROOT/'experiments/paid-adversarial/synthetic_node.py')
  class ProofNode(synthetic.SyntheticNode):
   proof_scope=None
   def _live(self):
    if self.started and time.monotonic()-self.started>300:self._halt('BOOTSTRAP_DEADLINE');raise RuntimeError('BOOTSTRAP_DEADLINE')
    return super()._live()
   def _params(self,method,params):
    if method=='eth_getProof':
     allowed=self.proof_scope;self.proof_scope=None
     base.need(allowed is not None and params==allowed,'PROOF_SCOPE_REFUSED');return
    return super()._params(method,params)
  node=ProofNode(a.anvil,a.output/'owned-node')
  with node:
   run=em.Run(node,k,build)
   for actor in (em.A,em.B,em.D):node.rpc('fund','anvil_setBalance',[actor,'0xde0b6b3a7640000']);node.rpc('actor','anvil_impersonateAccount',[actor])
   node.install_token()
   for actor in (em.A,em.B):run.send('synthetic_balance',em.D,em.TOKEN,run.data('setBalance(address,uint256)',actor,10000))
   start=run.header('history_start');first=len(run.rows)
   reg=run.deploy('TestAccountRegistry',(em.A,em.B));rh='0x'+k.digest(bytes.fromhex(build['contracts']['TestAccountRegistry']['runtime'][2:])).hex()
   probe=run.deploy('CawPaidActionProbe',(reg,rh),{'registry':reg,'registryCodeHash':rh});run.reg=reg;run.probe=probe
   regkeys=['0x'+k.digest(em.word(1)+em.word(slot)).hex() for slot in (0,4)]
   ledgerkeys=['0x'+k.digest(em.word(i)+em.word(slot)).hex() for slot in (0,1,2) for i in (1,2,3)]+['0x'+em.word(slot).hex() for slot in (3,4,5,6)]
   def capture(label):
    header=run.header(label+'.header');direct=run.state(label+'.direct')
    def acquire(address,slots):
     params=[address,slots,header['number']];node.proof_scope=params
     proof=node.rpc(label+'.proof','eth_getProof',params);base.need(node.proof_scope is None,'SCOPE_NOT_CONSUMED')
     return {'header':header,'proof':proof,'code':node.rpc(label+'.code','eth_getCode',[address,header['number']])}
    registry=acquire(reg,regkeys);paid=acquire(probe,ledgerkeys)
    base.need(run.header(label+'.stable')['hash']==header['hash'],'STATE_MOVED')
    byblock={int(row['receipt']['blockNumber'],16):row for row in run.rows[first:]};blocks=[]
    for number in range(int(start['number'],16)+1,int(header['number'],16)+1):
     block=node.rpc(label+'.history','eth_getBlockByNumber',[hex(number),False]);row=byblock[number]
     base.need(block['transactions']==[row['receipt']['transactionHash']],'HISTORY_COMPLETENESS')
     blocks.append({'header':block,'transactions':[{'transaction':{'to':None,**row['transaction']},'receipt':row['receipt']}]})
    history={'schema':'caw-paid-history/1','chain_id':31337,'addresses':{'registry':reg,'probe':probe,'token':em.TOKEN},'registry_runtime':registry['code'],'probe_runtime':paid['code'],'start_block':start,'end_block':header,'blocks':blocks,'final':direct}
    manifest={'chain_id':31337,'addresses':history['addresses'],'registry_runtime_sha256':hashlib.sha256(bytes.fromhex(registry['code'][2:])).hexdigest(),'probe_runtime_sha256':hashlib.sha256(bytes.fromhex(paid['code'][2:])).hexdigest(),'start_block_hash':start['hash'],'end_block_hash':header['hash']}
    record['cases'].append({'name':label,'direct':direct,'history':history,'manifest':manifest,'selection':{'schema':'caw-test-paid-registry-binding-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':reg,'probe':probe,'accountId':'0x1'},'evidence':{'registry':registry,'probe':paid}})
   capture('zero')
   for actor in (em.A,em.B):run.call('approve',actor,em.TOKEN,'approve(address,uint256)',probe,10000)
   for i,actor,amount in [(1,em.A,100),(2,em.A,200),(3,em.B,300)]:run.call('deposit',actor,probe,'deposit(uint256,uint256,uint256)',i,0,amount)
   for i,actor,amount in [(1,em.A,10),(2,em.A,20),(3,em.B,30)]:run.call('stake',actor,probe,'stake(uint256,uint256,uint256)',i,0,amount)
   capture('nonzero')
   run.call('withdraw',em.A,probe,'withdraw(uint256,uint256,uint256)',1,0,7)
   run.call('unstake',em.A,probe,'unstake(uint256,uint256,uint256)',1,0,5)
   run.call('foreign_withdraw',em.B,probe,'withdraw(uint256,uint256,uint256)',1,0,1,success=False,error='NotAccountOwner()')
   capture('withdrawn')
  base.need(node.receipt()['stop_reason'] is None,'NODE_STOP');record['complete']=True
 finally:
  if node:
   record['node']=node.receipt();trace=(json.dumps({'calls':node.calls,'remoteCalls':node.remote_calls,'transactions':run.rows if run else []},indent=2)+'\n').encode();(a.output/'trace.json').write_bytes(trace);record['traceSha256']=hashlib.sha256(trace).hexdigest()
  raw=(json.dumps(record,indent=2)+'\n').encode();base.need(len(raw)<2097152,'CAPTURE_BOUND');(a.output/'capture.json').write_bytes(raw)
 print(json.dumps({'complete':record['complete'],'cases':len(record['cases'])}))
if __name__=='__main__':main()
