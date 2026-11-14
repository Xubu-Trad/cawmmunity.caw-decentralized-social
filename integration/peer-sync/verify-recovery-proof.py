"""Recheck saved storage-proof bytes using the pinned reader, without client startup.

Trust the verifier source and Node executable explicitly. This verifies the selected
synthetic header/proof, not the operator, process history or public-chain finality.
"""
import argparse,hashlib,types,json,subprocess,sys
from pathlib import Path

PREFLIGHT_SHA256="69eea5fbe832aeb6fa8c2a69ac381a4ecb78549ae4189e2e1b43add2e713235f"

def verify(source, evidence, output, summary=None):
    source=Path(source).resolve();evidence=Path(evidence).resolve();output=Path(output).resolve()
    if output.exists():raise ValueError('OUTPUT_EXISTS')
    helper=source/'integration/peer-sync/traced-persistence-preflight.py'
    helper_bytes=helper.read_bytes()
    if hashlib.sha256(helper_bytes).hexdigest()!=PREFLIGHT_SHA256:
        raise ValueError('PREFLIGHT_CODE_MISMATCH')
    # Execute precisely the verified snapshot, not a second read of the path.
    preflight=types.ModuleType('pinned_preflight');preflight.__file__=str(helper)
    exec(compile(helper_bytes,str(helper),'exec'),preflight.__dict__)
    checked=preflight.verify_inputs(source,source/'evidence/traced-inputs-20261112/inputs.json')
    # Snapshot bytes for the reader; never execute code from the received artifact.
    data=evidence.read_bytes()
    if len(data)>16*1024*1024:raise ValueError('EVIDENCE_TOO_LARGE')
    json.loads(data)
    output.mkdir();(output/'evidence.json').write_bytes(data)
    q=subprocess.run(['node','--max-old-space-size=256',str(source/'integration/core-baseline-v1/check-geth-header-proof.mjs'),str(output/'evidence.json'),str(source/'evidence/registry-later-20261109/result.json')],capture_output=True,timeout=90)
    (output/'reader.log').write_bytes(q.stdout+q.stderr)
    if q.returncode:raise ValueError('STRICT_READER_REJECTED')
    proof=json.loads(q.stdout)
    if proof.get('fields')!=16 or proof.get('controls')!=['header root','header hash','wrong value','missing proof','altered node'] or proof.get('headerBindingVerified') is not True:raise ValueError('PROOF_BOUNDARY')
    if proof.get('chainAuthenticated') is not False or proof.get('finalityVerified') is not False:raise ValueError('SCOPE_CHANGED')
    if summary:
        claim=json.loads(Path(summary).read_text())
        if claim.get('reproduction',{}).get('proof')!=proof:raise ValueError('SUMMARY_PROOF_MISMATCH')
    result={'inputs':checked,'evidenceSha256':hashlib.sha256(data).hexdigest(),'evidenceSize':len(data),'proof':proof,'summaryProofCompared':bool(summary),'scope':'offline proof recheck only; does not prove peer recovery, execution history, independent operator or finality'}
    (output/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['source','evidence','output']:p.add_argument('--'+n,required=True)
    p.add_argument('--summary');a=p.parse_args();print(json.dumps(verify(a.source,a.evidence,a.output,a.summary)))
