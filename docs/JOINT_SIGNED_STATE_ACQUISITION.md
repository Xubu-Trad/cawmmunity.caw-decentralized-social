# Joint signed-history and registry-proof acquisition

FACT — the signed local collector now acquires account/storage proofs at each branch's own endpoint. Both executed branches pass `inspectPaidRegistryStateHistory` using their original signed transaction bytes, receipts, headers and observed registry state roots. No endpoint root or header was constructed for these positive cases.

The run uses the existing pinned writer, body collectors and Anvil guard. It performs 22 signed local submissions with published test identities, no impersonation and no remote RPC. The gas balances and token are synthetic fixtures; the token runtime is installed locally. The registry/probe are deployed through signed local transactions. The owned node exits and its listener release is checked.

## Read scope

The small `state_node.py` adapter adds only an endpoint `eth_getProof` read. The selected registry and block come from the active branch read configuration. Exactly four distinct storage keys are accepted. The expected request is stored immutably, consumed once before transport, and cleared on failure. Generation, phase and nested lease checks prevent reuse across branch changes. Existing write restrictions, process limits and response/trace bounds remain unchanged.

The runner derives owner/epoch/token-approval keys and one current-owner/operator key, captures the proof after history/body acquisition, then rechecks the selected header. The subsequent JavaScript verifier derives the owner from its proof, verifies the code hash, rechecks signed transaction and receipt commitments, and requires exact endpoint/replayed-state agreement. The initial owner label used for acquisition is not accepted as proof by that verifier.

Six transport-free Python checks cover direct calls without scope, one-use consumption, altered address/keys/block, retired generation, phase/nesting/key restrictions and cleanup on transport failure. Review caught a mutable request alias after the first successful capture. The permission was changed to an immutable tuple, boundary tests passed, and a second complete capture was run. The first capture is retained as prior evidence; the published fixture is the corrected second run.

## Observed coverage

The left branch transfers account 1 from A to B; the right branch instead performs a self-transfer. Both end at epoch 1 and have different hashes at the same height. Token approval and the selected operator grant are zero/false in both. These are not positive grant/revocation cases; the separate six-state approval experiment covers those locally but is not silently combined with this signed run.

Six Node cases cover scope, both branch compositions, cross-branch proof substitution, invalid transaction bytes and a forged owner value. Full offline suite: 1158/1158 across 62 files. The 510,403-byte `joint-capture.json` is a byte-preserving projection of selected evidence from the corrected raw run, SHA-256 `94a43795e6029a859b4bf4dfe05af41998317bee1fb0b2fb231b6642931d64dd`. Its embedded raw-capture hash records provenance. Raw request logs and the prior capture are retained privately; they are not included in this public fixture.

## Reproduce

On the established Windows environment, calculate SHA-256 of `experiments/paid-signed-state-acquisition/experiment-inputs.json`, then:

```text
python experiments/paid-signed-state-acquisition/run_signed_state.py --anvil PATH_TO_PINNED_ANVIL --output NEW_RAW.json --expected-input-sha256 INPUT_MANIFEST_SHA256
python experiments/paid-signed-state-acquisition/extract_joint_capture.py --input NEW_RAW.json --sha256 NEW_RAW_SHA256 --output NEW_JOINT.json
python -I -B experiments/paid-signed-state-acquisition/test_state_node.py
node --test tests/paid-signed-state-acquisition.test.mjs
```

Output parents must exist and files must be new. The Node regression checks the committed joint fixture; for a fresh capture, pass each branch object from NEW_JOINT.json as JSON to `inspectPaidRegistryStateHistory`. Fresh timestamps/hashes may differ. The extractor projects saved collector results and checks scope/status; it is not a second independent raw-transcript replay. Cryptographic/body/state checking is performed by the existing JavaScript readers.

UNRESOLVED — public-chain anchor authentication, finality, freshness, contract-wallet/callback behavior and independent execution verification. The joint local acquisition gap is closed only for this fixed test profile. All acceptance/authority/execution flags remain unchanged. Next: positively granted/revoked approval state in a signed joint capture, then the broader authority and independently acquired anchor gates. No deployment or production readiness is asserted.
