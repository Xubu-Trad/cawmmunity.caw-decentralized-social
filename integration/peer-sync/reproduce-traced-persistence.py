"""Single entry point for the pinned tracing-aware experiment.

Run only with trusted verifier scripts, client executables and source directory.
This orchestrates existing checks; it does not authenticate public-chain finality.
"""
import sys
if sys.flags.optimize:
    raise SystemExit("OPTIMIZED_PYTHON_UNSUPPORTED: run without -O, -OO or PYTHONOPTIMIZE")
import argparse, importlib.util, json, subprocess, sys
from pathlib import Path

CHECKER = Path(__file__).with_name('traced-persistence-preflight.py')
spec = importlib.util.spec_from_file_location('traced_preflight', CHECKER)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

def run(source, manifest, geth, reth_command, output):
    source, manifest, output = Path(source).resolve(), Path(manifest).resolve(), Path(output).resolve()
    # Reject existing evidence and mismatched inputs before invoking any tool.
    if output.exists():
        raise ValueError('OUTPUT_EXISTS')
    preflight.verify_inputs(source, manifest)
    output.mkdir()  # parent must already exist; never overwrite an evidence lane
    commands = [
        [sys.executable, str(CHECKER), '--source', str(source), '--manifest', str(manifest),
         '--geth', str(geth), '--reth-command', str(reth_command), '--output', str(output/'preflight.json')],
        [sys.executable, str(source/'integration/peer-sync/reproduce-persistence.py'),
         '--driver', str(source/'integration/peer-sync/run-header-sync-early-trace.py'),
         '--geth', str(geth), '--reth-command', str(reth_command),
         '--fixture', str(source/'integration/peer-sync/fixture'), '--output', str(output/'execution'),
         '--reader', str(source/'integration/core-baseline-v1/check-geth-header-proof.mjs'),
         '--expected', str(source/'evidence/registry-later-20261109/result.json')],
    ]
    for stage, command in zip(['preflight', 'recovery'], commands):
        # Recheck after tool inventory too. Not a defense against hostile concurrent mutation.
        preflight.verify_inputs(source, manifest)
        with (output/(stage+'.log')).open('wb') as log:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
        (output/(stage+'-exit.json')).write_text(json.dumps({'exit':result.returncode})+'\n')
        if result.returncode:
            raise RuntimeError(stage.upper()+'_FAILED: '+str(result.returncode))
        if stage == 'preflight':
            inventory=json.loads((output/'preflight.json').read_text())
            if inventory.get('matchedInputs') != 17 or inventory.get('inventoryFingerprint') != preflight.INVENTORY:
                raise ValueError('PREFLIGHT_RESULT_MISMATCH')
    report=json.loads((output/'execution/reproduction.json').read_text())
    # The pinned wrapper already enforces proof, interruption and cleanup invariants.
    # Do not turn a preflight-only run into a recovery result.
    (output/'runner-result.json').write_text(json.dumps({'inputCommit':preflight.PIN,
        'inventoryFingerprint':preflight.INVENTORY,'reproduction':report,
        'scope':'local synthetic execution; independent operator and public finality not established'},indent=2)+'\n')
    return output/'runner-result.json'

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ['source','manifest','geth','reth-command','output']:
        parser.add_argument('--'+key,required=True)
    a=parser.parse_args()
    print(run(a.source,a.manifest,a.geth,a.reth_command,a.output))
