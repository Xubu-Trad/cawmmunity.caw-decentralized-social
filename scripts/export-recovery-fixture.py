"""Export the retained synthetic fixture and reader; no network or installation.

Run from any directory with Python 3.12. The destination must not exist.
This is a fixture exporter, not an authenticity verifier for received packages.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    'scripts/check-recovery-bundle.mjs',
    'public/bounded-json.mjs',
    'reference/recovery-bundle.mjs',
    'reference/paid-registry-permissions.mjs',
    'reference/paid-post-signatures.mjs',
    'reference/paid-body-history.mjs',
    'reference/paid-action-reader.mjs',
    'reference/keccak256.mjs',
    'reference/ethereum-execution-header.mjs',
    'reference/ethereum-block-senders.mjs',
    'reference/ethereum-block-transactions.mjs',
    'reference/ethereum-block-receipts.mjs',
    'experiments/paid-body-acquisition/verify_body.mjs',
    'LICENSE',
    'LICENSE_STATUS.md',
)
CAPTURE_HASH = 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36'
TRACE_HASH = '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode('utf-8')


def prepare(root):
    """Read and validate all retained inputs before creating output."""
    source = root / 'experiments/paid-signed-body-acquisition'
    raw = (source / 'body-captures.json').read_bytes()
    if digest(raw) != CAPTURE_HASH:
        raise ValueError('CAPTURE_PIN_MISMATCH')
    # Fixed local source, bounded decompression; never extract archive paths.
    with gzip.open(source / 'execution-trace.json.gz', 'rb') as stream:
        trace = stream.read(8 * 1024 * 1024 + 1)
    if len(trace) > 8 * 1024 * 1024 or digest(trace) != TRACE_HASH:
        raise ValueError('TRACE_PIN_MISMATCH')
    sample = json.loads(trace)['branches']['left']['collectors']['number']
    policy = dict(schema='caw-paid-post-policy/1', profile='paid-action-v1-eoa-65-low-s',
                  assumedEoaOwners=['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76',
                                    '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73'])
    members = {'history.json': sample['history'], 'manifest.json': sample['manifest'],
               'bodies.json': json.loads(raw)['branches']['left'], 'policy.json': policy}
    files = {name: (root / name).read_bytes() for name in SOURCES}
    hashes = {}
    for name, value in members.items():
        data = encoded(value)
        if len(data) > 1048576:
            raise ValueError('MEMBER_LIMIT')
        files['bundle/' + name] = data
        hashes[name] = digest(data)
    manifest = sample['manifest']
    files['selection.json'] = encoded(dict(schema='caw-recovery-selection/1',
        profile='fixed-registry-eoa/1', chainId='0x7a69',
        startBlockHash=manifest['start_block_hash'], endBlockHash=manifest['end_block_hash'],
        sha256=hashes))
    pin = digest(files['selection.json'])
    files['README.txt'] = (
        'CAW retained synthetic recovery fixture. Node 24.20.0; no npm install.\n'
        'From this directory, run:\n'
        'node --max-old-space-size=128 scripts/check-recovery-bundle.mjs bundle selection.json RETAINED_SELECTION_SHA256\n'
        'Retain the selection digest separately BEFORE transferring this directory.\n'
        'A digest supplied by an untrusted package does not authenticate that package.\n'
        'Verify reader/source identities against an independently retained source selection.\n'
        'INVENTORY.json records bytes, not source authenticity or release approval.\n'
        'This is the existing London chain 31337 fixture, not fresh acquisition.\n'
        'No account authority, execution, finality or production acceptance is established.\n'
        'Runtime and trusted local filesystem must be supplied separately.\n'
    ).encode('utf-8')
    files['INVENTORY.json'] = encoded(dict(schema='caw-retained-fixture-inventory/1',
        captureSha256=CAPTURE_HASH, decompressedTraceSha256=TRACE_HASH,
        files={name: {'sha256': digest(data), 'size': len(data)}
               for name, data in sorted(files.items())}))
    return files, pin


def export(destination, root=ROOT):
    # Fixed member names only. Existing/partial evidence is never overwritten.
    files, pin = prepare(root)
    destination.mkdir(parents=False, exist_ok=False)
    for name, data in sorted(files.items()):
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as stream:
            stream.write(data)
    return {'schema': 'caw-retained-fixture-export/1', 'files': len(files),
            'selectionSha256': pin, 'inventorySha256': digest(files['INVENTORY.json']),
            'independentReproduction': False, 'productionAccepted': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    print(json.dumps(export(args.destination), sort_keys=True))
