"""Offline orchestration tests; subprocesses are mocked, not recovery proof."""
import argparse,importlib.util,json,shutil,tempfile,subprocess
from pathlib import Path
from unittest.mock import patch
p=argparse.ArgumentParser();p.add_argument('--source',required=True,type=Path);p.add_argument('--manifest',required=True,type=Path);a=p.parse_args()
s=importlib.util.spec_from_file_location('runner',Path(__file__).with_name('reproduce-traced-persistence.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
results=[]
with tempfile.TemporaryDirectory(prefix='caw-runner-') as d:
 root=Path(d);source=root/'source';shutil.copytree(a.source,source);manifest=root/'inputs.json';shutil.copyfile(a.manifest,manifest)
 def invoke(name,effect):
  with patch.object(m.subprocess,'run',side_effect=effect) as calls:
   try:m.run(source,manifest,'GETH_SENTINEL','RETH_SENTINEL',root/name)
   except (ValueError,RuntimeError,FileNotFoundError):pass
   else:raise AssertionError('unexpected acceptance: '+name)
   return calls.call_count
 f=source/'integration/peer-sync/tracing-capability.py';original=f.read_bytes();f.write_bytes(original+b'x')
 assert invoke('changed',AssertionError('tool invoked'))==0;assert not(root/'changed').exists();results.append('changed input stops before tools/output')
 f.unlink();assert invoke('missing',AssertionError('tool invoked'))==0;results.append('missing input stops before tools');f.write_bytes(original)
 (root/'existing').mkdir();(root/'existing/keep').write_text('keep');assert invoke('existing',AssertionError('tool invoked'))==0;assert(root/'existing/keep').read_text()=='keep';results.append('existing evidence preserved')
 assert invoke('failed-preflight',lambda *a,**k:subprocess.CompletedProcess(a[0],9))==1;assert not(root/'failed-preflight/execution').exists();results.append('nonzero preflight prevents recovery')
 assert invoke('no-preflight-record',lambda *a,**k:subprocess.CompletedProcess(a[0],0))==1;results.append('exit zero without preflight record rejected')
 def fake_preflight(command,**kw):
  dest=Path(command[command.index('--output')+1]);dest.write_text(json.dumps({'matchedInputs':17,'inventoryFingerprint':m.preflight.INVENTORY}));f.write_bytes(original+b'changed during inventory');return subprocess.CompletedProcess(command,0)
 assert invoke('changed-after-preflight',fake_preflight)==1;f.write_bytes(original);results.append('input change during tool inventory prevents recovery')
 def fake_recovery_failure(command,**kw):
  if str(m.CHECKER) in command:
   Path(command[command.index('--output')+1]).write_text(json.dumps({'matchedInputs':17,'inventoryFingerprint':m.preflight.INVENTORY}));return subprocess.CompletedProcess(command,0)
  assert command[command.index('--driver')+1]==str(source/'integration/peer-sync/run-header-sync-early-trace.py')
  assert command[command.index('--reader')+1]==str(source/'integration/core-baseline-v1/check-geth-header-proof.mjs')
  return subprocess.CompletedProcess(command,7)
 assert invoke('failed-recovery',fake_recovery_failure)==2;assert not(root/'failed-recovery/runner-result.json').exists();results.append('recovery failure preserved without success record; exact driver and reader selected')
print(json.dumps({'checks':len(results),'results':results,'scope':'mocked process dispatch, not node execution'}))
