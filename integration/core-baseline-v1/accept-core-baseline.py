"""Frozen research package acceptance; no network acquisition or deployment."""
from pathlib import Path
import subprocess,json,sys,importlib.util
if not __debug__:raise RuntimeError('ASSERTIONS_REQUIRED')
repo,evm,out=map(lambda x:Path(x).resolve(),sys.argv[1:])
assert not out.exists(),'NEW_OUTPUT_REQUIRED'
baseline=repo/'integration/core-baseline-v1';inputs=repo/'evidence/c007-new-owner-replay-20261108';compare=repo/'experiments/c007-new-owner-post/compare-geth-transition.py'
spec=importlib.util.spec_from_file_location('comparison',compare);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
module.resource_preflight(out);module.selected_inputs(inputs,inputs/'blocks.json');out.mkdir(parents=True)
commands=[['node','--max-old-space-size=256',str(baseline/'check-core-baseline.mjs'),str(baseline/'manifest.json'),str(baseline/'compiler-input.json'),str(out/'compiler-output.json')],['node','--max-old-space-size=256',str(baseline/'check-replay-baseline.mjs'),str(out/'compiler-output.json'),str(inputs/'acquired-history.json'),str(baseline/'deployment-bindings.json')],[sys.executable,str(compare),str(inputs),str(inputs/'blocks.json'),str(evm),str(out/'replay')]]
records=[]
for i,command in enumerate(commands):
 with(out/f'step-{i}.log').open('x')as log:p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=180)
 records.append({'step':i,'exitCode':p.returncode});(out/'steps.json').write_text(json.dumps(records,indent=2))
 if p.returncode:raise RuntimeError(f'STEP_{i}_FAILED')
summary=json.loads((out/'replay/summary.json').read_text());assert summary['blocks']==38
(out/'acceptance.json').write_text(json.dumps({'frozenResearchPackageAccepted':True,'steps':records,'replay':summary,'productionAccepted':False,'consensusVerified':False,'newAcquisition':False},indent=2))
print(json.dumps({'steps':len(records),'blocks':38,'productionAccepted':False}))
