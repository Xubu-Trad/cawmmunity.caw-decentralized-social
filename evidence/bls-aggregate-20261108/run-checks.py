"""Execute scoped checks from repository root; refuse to overwrite evidence."""
from pathlib import Path
import hashlib,json,shutil,subprocess
w=Path.cwd();e=w/'evidence/bls-aggregate-20261108'
assert shutil.disk_usage(w).free>=2*1024**3
mem={x.split(':')[0]:x.split(':')[1].strip() for x in Path('/proc/meminfo').read_text().splitlines()}
assert int(mem['MemAvailable'].split()[0])*1024>=1024**3
node=Path(shutil.which('node')).resolve();nodehash=hashlib.sha256(node.read_bytes()).hexdigest()
assert nodehash=='61ab14cd750fc24d5db53490ec5fc40f756e4b6e136b78cf7004265471d9bd1d'
assert subprocess.check_output(['node','--version'],text=True).strip()=='v24.22.1'
n=0
for package in json.loads((w/'evidence/bls-g1-20261107/dependency-inventory.json').read_text()):
 for a in package['files']:
  b=(w/a['PATH']).read_bytes();assert len(b)==a['SIZE'];assert hashlib.sha256(b).hexdigest()==a['SHA256'];n+=1
assert n==486
prefix=['node','--max-old-space-size=256','--test','--test-reporter=tap','--test-concurrency=1','--test-timeout=30000']
groups=[('focused',['experiments/bls-g1/aggregate.test.mjs']),('bls-regression',['experiments/bls-g1/g1.test.mjs','experiments/bls-g1/committee.test.mjs','experiments/bls-g1/signature.test.mjs']),('bootstrap-regression',['tests/'+x+'.test.mjs' for x in ['sha256-branch','beacon-header-root','capella-payload-root','capella-header-binding','minimal-capella-bootstrap','bootstrap-profile-selection','bootstrap-fixture-metadata-selection','pinned-minimal-capella-bootstrap']])]
records=[]
for name,files in groups:
 cmd=prefix+files;log=e/(name+'-attempt-1.tap')
 with log.open('xb') as f:
  r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=45)
 text=log.read_text();counts={}
 for line in text.splitlines():
  if line.startswith('# pass ') or line.startswith('# fail '):counts[line.split()[1]]=int(line.split()[2])
 records.append({'name':name,'command':cmd,'exitCode':r.returncode,'counts':counts,'log':str(log.relative_to(w))})
 print(name,r.returncode,counts,flush=True)
 with (e/(name+'-command.json')).open('x') as f:json.dump(records[-1],f,indent=2);f.write('\n')
 if r.returncode:raise SystemExit(r.returncode)
run={'schema':'caw-bls-aggregate-run/1','parentCommit':'c4b033719f7d29c729f5614fcde4944d199bcb1b','node':'v24.22.1','nodeSha256':nodehash,'declaredNode':'24.20.0','declaredRuntimeRun':False,'reusedDependencyFilesVerified':n,'guards':{'diskMinimumBytes':2*1024**3,'memoryMinimumBytes':1024**3,'heapMiB':256,'processDeadlineSeconds':45},'groups':records,'fullSuiteRerun':False,'ciRun':False}
with (e/'run.json').open('x') as f:json.dump(run,f,indent=2);f.write('\n')
