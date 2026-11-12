"""Run a persistence experiment and its existing strict proof reader together."""
import argparse,subprocess,json,sys,hashlib
from pathlib import Path
p=argparse.ArgumentParser()
for name in ['driver','geth','reth-command','fixture','output','reader','expected']:
 p.add_argument('--'+name,required=True)
a=p.parse_args();out=Path(a.output)
if out.exists():raise SystemExit('OUTPUT_EXISTS: preserve prior evidence and choose a fresh directory')
cmd=[sys.executable,a.driver,'--geth',a.geth,'--reth-command',a.reth_command,'--fixture',a.fixture,'--output',a.output]
q=subprocess.run(cmd,timeout=240)
if q.returncode:raise SystemExit(q.returncode)
service=json.loads((out/'service.json').read_text());recovery=json.loads((out/'result.json').read_text());restart=json.loads((out/'restart.json').read_text());window=json.loads((out/'write-window.json').read_text())
if not (service['allStopped']):raise SystemExit('SERVICES_NOT_STOPPED')
if not (not window['completionMarkersBeforeKill']):raise SystemExit('MISSED_WINDOW')
if not (restart['identityPreserved'] and restart['peersBeforeReplacement']==0 and restart['targetAbsent']):raise SystemExit('RESTART_ISOLATION')
if not (recovery['matchingHeaders']==29 and recovery['originalSourceStillStopped'] and recovery['replacementPeerDifferentIdentity'] and not recovery['destinationFileImportUsed']):raise SystemExit('RECOVERY_BOUNDARY')
q=subprocess.run(['node','--max-old-space-size=256',a.reader,str(out/'evidence.json'),a.expected],capture_output=True,timeout=90)
(out/'strict-reader.log').write_bytes(q.stdout+q.stderr)
if q.returncode:raise SystemExit(q.returncode)
proof=json.loads(q.stdout)
if not (proof['fields']==16 and proof['controls']==['header root','header hash','wrong value','missing proof','altered node'] and proof['headerBindingVerified']):raise SystemExit('PROOF_BOUNDARY')
if not (proof['chainAuthenticated'] is False and proof['finalityVerified'] is False):raise SystemExit('SCOPE_CHANGED')
summary={'restart':restart,'recovery':recovery,'proof':proof,'service':service,'scope':'same-host synthetic execution; independent operator reproduction pending'}
(out/'reproduction.json').write_text(json.dumps(summary,indent=2)+'\n')
paths=[Path(a.driver),Path(a.reader),Path(a.expected),out/'evidence.json',out/'strict-reader.log',out/'reproduction.json']
(out/'REPRODUCTION_PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[supplied-driver,fixture,existing-strict-reader] TRANSFORM="combined experiment and strict verification" SHA256={hashlib.sha256(x.read_bytes()).hexdigest()} SIZE={x.stat().st_size} PATH={x.name}'for x in paths)+'\n')
print(json.dumps(summary))
