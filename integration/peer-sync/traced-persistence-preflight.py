"""Fixed-snapshot input verification and explicitly trusted tool inventory."""
import sys
if sys.flags.optimize:
    raise SystemExit("OPTIMIZED_PYTHON_UNSUPPORTED: run without -O, -OO or PYTHONOPTIMIZE")
import argparse,hashlib,json,platform,shutil,subprocess,sys
from pathlib import Path
PIN='e250e4061dd822c1a3dc9bf7627343753ebc7ba3'
INVENTORY='68129c10f2d6da410c07e1cfb61584fea5ba1a68ce232c2cd0c6458374d273f4'
def digest(path):
 h=hashlib.sha256()
 with path.open('rb')as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def verify_inputs(root,manifest):
 data=json.loads(manifest.read_text())
 fingerprint=hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 if fingerprint!=INVENTORY or data['commit']!=PIN:raise ValueError('INVENTORY_PIN_MISMATCH')
 root=root.resolve();count=0
 for name,v in data['files'].items():
  path=(root/name).resolve()
  if not path.is_relative_to(root):raise ValueError('INPUT_ESCAPES_ROOT')
  if not path.is_file():raise ValueError('INPUT_MISSING: '+name)
  if path.stat().st_size!=v['size'] or digest(path)!=v['sha256']:raise ValueError('INPUT_MISMATCH: '+name)
  count+=1
 return {'commit':PIN,'matchedInputs':count,'inventoryFingerprint':fingerprint}
def tool(command):
 # Caller supplies trusted executable/runtime arguments; this is not a sandbox.
 q=subprocess.run(command,capture_output=True,timeout=20)
 if q.returncode:raise ValueError('TOOL_VERSION_FAILED: '+Path(command[0]).name)
 files=[]
 for arg in command[:-1]:
  path=Path(arg)
  if not path.is_file():
   resolved=shutil.which(arg)
   if resolved:path=Path(resolved)
  if path.is_file():files.append({'name':path.name,'sha256':digest(path),'size':path.stat().st_size})
 return {'version':(q.stdout+q.stderr).decode(errors='replace').strip(),'files':files}
def main():
 p=argparse.ArgumentParser()
 for n in ['source','manifest','geth','reth-command','output']:p.add_argument('--'+n,required=True)
 a=p.parse_args();out=Path(a.output)
 if out.exists():raise ValueError('OUTPUT_EXISTS')
 result=verify_inputs(Path(a.source),Path(a.manifest))
 cmd=json.loads(Path(a.reth_command).read_text())
 if not isinstance(cmd,list)or not cmd or not all(isinstance(x,str)and x for x in cmd):raise ValueError('INVALID_TRUSTED_RETH_COMMAND')
 result.update({'tools':{'geth':tool([a.geth,'version']),'reth':tool(cmd+['--version']),'node':tool(['node','--version']),'strace':tool(['strace','--version']),'python':tool([sys.executable,'--version'])},'platform':{'system':platform.system(),'release':platform.release(),'machine':platform.machine()},'scope':'input consistency and tool inventory only; no execution/recovery or independent-review verdict','limitations':['Tool hashes are observations, not approved binary fingerprints.','Version commands execute explicitly trusted tools.','Shared libraries, kernel, filesystem and compiler provenance are not fully inventoried.','Post-check input replacement is not prevented; use a trusted immutable checkout.']})
 with out.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps({'matchedInputs':result['matchedInputs'],'scope':result['scope']}))
if __name__=='__main__':main()
