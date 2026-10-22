# Bounded offline recovery bundle

This checker composes the existing body, post-signature and fixed-registry readers. It accepts four bounded UTF-8 JSON files and a separately retained selection record. It performs no RPC calls, starts no server and does not adopt state into the frontend or protocol.

The supported profile is **fixed-registry-eoa/1**, using the retained London-format local chain 31337 experiment. Contract-wallet authority, authenticated registry state, canonical endpoint selection and independent acquisition remain unproved. Unsupported profiles reject instead of falling back to unchecked reconstruction.

## Input and trust boundary

The directory must contain `history.json`, `manifest.json`, `bodies.json` and `policy.json`. Each file is limited to 1 MiB. Other directory entries are not read. The selection is limited to 16 KiB and has exactly:

```json
{
  "schema": "caw-recovery-selection/1",
  "profile": "fixed-registry-eoa/1",
  "chainId": "0x7a69",
  "startBlockHash": "<selected 32-byte lowercase hex hash>",
  "endBlockHash": "<selected 32-byte lowercase hex hash>",
  "sha256": {
    "history.json": "<exact UTF-8 file SHA-256>",
    "manifest.json": "<exact UTF-8 file SHA-256>",
    "bodies.json": "<exact UTF-8 file SHA-256>",
    "policy.json": "<exact UTF-8 file SHA-256>"
  }
}
```

The placeholders above are schema illustrations, not valid input. Hashes include whitespace and final newlines. The command additionally requires the exact selection file's SHA-256, retained outside the received package. This detects replacement of both the package and selection. Calculating that digest from an untrusted received selection at verification time defeats this substitution check. Retain it through an independently chosen trusted process; this component does not authenticate that process or establish canonical chain selection. Local reader code and the filesystem remain caller trust boundaries. The CLI is not a sandbox for a malicious local filesystem or privileged same-process JavaScript.

## Reproduce with the existing synthetic fixture

From the repository root, Python 3 standard library only:

```python
from pathlib import Path
import gzip, hashlib, json
r = Path('experiments/paid-signed-body-acquisition')
raw = (r / 'body-captures.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36'
trace_bytes = gzip.decompress((r / 'execution-trace.json.gz').read_bytes())
assert hashlib.sha256(trace_bytes).hexdigest() == '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975'
sample = json.loads(trace_bytes)['branches']['left']['collectors']['number']
policy = dict(schema='caw-paid-post-policy/1', profile='paid-action-v1-eoa-65-low-s', assumedEoaOwners=['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73'])
out = Path('recovery-fixture'); out.mkdir(exist_ok=False)
bundle = out / 'bundle'; bundle.mkdir()
members = {'history.json': sample['history'], 'manifest.json': sample['manifest'], 'bodies.json': json.loads(raw)['branches']['left'], 'policy.json': policy}
hashes = {}
for name, value in members.items():
    data = json.dumps(value, separators=(',', ':')).encode('utf-8')
    (bundle / name).write_bytes(data)
    hashes[name] = hashlib.sha256(data).hexdigest()
m = sample['manifest']
selection = dict(schema='caw-recovery-selection/1', profile='fixed-registry-eoa/1', chainId='0x7a69', startBlockHash=m['start_block_hash'], endBlockHash=m['end_block_hash'], sha256=hashes)
(out / 'selection.json').write_text(json.dumps(selection), encoding='utf-8')
print('Fixture selection digest:', hashlib.sha256((out / 'selection.json').read_bytes()).hexdigest())
```

This creates a fixture selection from explicitly pinned retained bytes. It is not independent public acquisition or an authenticated trust-bootstrap process. For this fixture reproduction, replace the placeholder below with the printed fixture digest. For received packages, use a digest retained separately before receipt. Run with Node 24.20.0:

```sh
node --max-old-space-size=128 scripts/check-recovery-bundle.mjs recovery-fixture/bundle recovery-fixture/selection.json "REPLACE_WITH_RETAINED_SELECTION_SHA256"
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/recovery-bundle.test.mjs
```

The command also works from another working directory with absolute paths to the script, bundle and selection. Missing/oversized files, mismatched hashes or selection digest, duplicate JSON keys, unsupported profiles and inconsistent history reject. No success record is emitted on rejection. This intentionally adds a required command argument; earlier two-path invocations now reject with usage instructions.

The pinned library API is `inspectPinnedRecoveryBundle(parts, selectionText, expectedSelectionSha256)` in `reference/recovery-bundle.mjs`; members are raw JSON strings. The original `inspectRecoveryBundle(parts, selectionText)` remains the explicitly unpinned fixture reader. It does not return `selectionPinMatched`. A pinned result reports both `selectionPinMatched: true` and `selectionTrust: "caller-retained-digest; provenance-not-authenticated"`.

## Evidence and remaining work

Focused checks cover both retained branches, byte alteration, missing bodies, wrong selected endpoint, unsupported chain/account profile, ambiguous JSON, excess members, accessors, input bounds, missing block evidence despite recomputed hashes and absent owner assumptions. Directory checks use newly created files; the CLI was separately run from that fresh working directory under the existing resource guard.

The selection-pinning increment adds replacement of both package and selection by the other valid branch, exact-byte whitespace changes, malformed/missing digests, oversized selection input and stable rejection of a null manifest. A deliberately self-selected replacement digest still yields false authentication/independence flags. These cases make the boundary observable; they do not supply independent review or acquisition.

An initial child-process CLI test could not launch under the single-process guard. That failed harness result is retained; the guard was not relaxed. The directory test and separate supervised CLI invocation replace that test arrangement.

Successful output leaves `endpointAuthenticated`, `acquisitionIndependent`, `accountAuthorityVerified`, `executionVerified`, `finalityVerified` and `productionAccepted` false. Only byte agreement with the supplied selection and conditional fixture reconstruction are established. All nine [operator-independence rows](OPERATOR_INDEPENDENCE.md) remain open; this is partial evidence for OI-03, not completion of OUT-08. The next step is an independently supplied package/trust-selection review, followed by an explicit acquisition and authority design rather than automatic state adoption.
