"""Frozen local research verification; no credentials, RPC or deployment."""
from pathlib import Path
import argparse,hashlib,json,os,platform,shutil,subprocess,sys
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p):return json.loads(p.read_bytes())
def main():
 if not __debug__:raise RuntimeError('OPTIMIZED_PYTHON_UNSUPPORTED')
 p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--pins',type=Path,required=True);p.add_argument('--pins-sha256',required=True);p.add_argument('--evm',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--require-authenticated-chain',action='store_true');a=p.parse_args()
 if platform.system()!='Linux':raise RuntimeError('LINUX_REQUIRED')
 repo=a.repo.resolve();out=a.output.resolve();evm=a.evm.resolve();assert not out.exists(),'OUTPUT_EXISTS'
 def guard():
  paths=[repo,out.parent]
  if any(x in platform.release().lower()for x in ['microsoft','wsl']):paths.append(Path('/mnt/c'))
  for path in paths:assert shutil.disk_usage(path).free>=2*1024**3,'DISK_FLOOR'
  mem=dict(x.split(':',1)for x in Path('/proc/meminfo').read_text().splitlines());assert int(mem['MemAvailable'].split()[0])*1024>=1024**3,'MEMORY_FLOOR'
 guard();pinBytes=a.pins.read_bytes();assert sha(pinBytes)==a.pins_sha256,'PIN_CATALOG';pins=json.loads(pinBytes)
 for name,pin in pins['files'].items():
  path=(repo/name).resolve();assert path.is_relative_to(repo),'PATH_ESCAPE';b=path.read_bytes();assert len(b)==pin['size'] and sha(b)==pin['sha256'],name
 assert subprocess.check_output(['node','--version'],text=True).strip()=='v20.20.2','NODE_VERSION'
 assert sha(evm.read_bytes())=='d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da','GETH_BINARY'
 out.mkdir();steps=[];base=repo/'integration/core-baseline-v1';e=repo/'evidence';inp=e/'registry-withdrawal-verification-20261109/input'
 manifest=e/'registry-selection-20261109/manifest.json';manifestPin=sha(manifest.read_bytes());model=e/'registry-later-20261109/model.json';modelPin=sha(model.read_bytes())
 def run(label,args):
  guard();q=subprocess.run(args,capture_output=True,timeout=120,cwd=repo);(out/(label+'.stdout')).write_bytes(q.stdout);(out/(label+'.stderr')).write_bytes(q.stderr);assert q.returncode==0,(label,q.stderr.decode(errors='replace'));v=json.loads(q.stdout);steps.append({'step':label,'status':'passed'});return v
 def node(label,name,*args):return run(label,['node','--max-old-space-size=256',str(base/name),*map(str,args)])
 try:
  node('execute','test-registry-hooks.mjs',base/'RegistryHookWithdrawalResearch.sol',out/'execution',e/'funded-claims-20261108/vectors.json',e/'funded-claims-20261108/proofs.json')
  for n in ['compiler-input.json','operations.json','result.json']:assert (out/'execution'/n).read_bytes()==(inp/n).read_bytes(),('EXECUTION_DRIFT',n)
  node('model','reconstruct-registry-later.mjs',out/'execution',e/'registry-later-20261109/input-pins.json');assert sha((out/'model.stdout').read_bytes())==modelPin,'MODEL_DRIFT'
  node('selection','check-registry-selection.mjs',manifest,manifestPin,inp/'compiler-input.json',inp/'operations.json')
  for label,script,directory,extra in [('initial','check-registry-storage.mjs','registry-storage-20261109',[]),('later','check-registry-later.mjs','registry-later-20261109',[out/'model.stdout',modelPin])]:
   evidence=e/directory/'evidence.json';node(label,script,manifest,manifestPin,evidence,load(evidence)['header']['hash'],inp/'compiler-input.json',*extra)
  run('geth',[sys.executable,str(base/'replay-registry-geth.py'),str(e/'registry-withdrawal-verification-20261109/fixture.json'),str(evm),str(out/'geth')])
  for tx,directory in [('01','registry-storage-20261109'),('27','registry-later-20261109')]:assert load(out/'geth'/('tx-'+tx)/'result.json')['stateRoot']==load(e/directory/'evidence.json')['header']['stateRoot'],'STATE_ROOT_LINK'
  summary={'status':'LOCAL_PIPELINE_VERIFIED_CHAIN_GATE_OPEN','sourceCommit':pins['sourceCommit'],'steps':steps,'transactions':28,'modelMutations':8,'initialProofMutations':14,'laterProofMutations':16,'gethControls':7,'chainAuthenticated':False,'finalityVerified':False,'productionAccepted':False,'missing':['independently trusted chain checkpoint','valid contiguous chain/header acquisition for selected deployment and later state','finality policy and evidence'],'limits':'Six local stages rerun. Saved synthetic headers linked to exact replay state roots, not public-chain deployment. External package supply-chain integrity is not established by this runner.'}
  (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
  if a.require_authenticated_chain:return 2
  return 0
 finally:
  (out/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[{pins["sourceCommit"]}] TRANSFORM="portable registry verification pipeline" SHA256={sha(f.read_bytes())} SIZE={f.stat().st_size} PATH={f.relative_to(out)}'for f in out.rglob('*')if f.is_file())+'\n')
if __name__=='__main__':sys.exit(main())
