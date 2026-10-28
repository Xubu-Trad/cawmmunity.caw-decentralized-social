# signed history and endpoint ledger reconciliation

FACT -- fifteen focused groups pass against a new local acquisition. both branches supply signed raw transactions, complete bodies and receipts, 13 paid-ledger slot witnesses, and selected registry owner/epoch witnesses. the existing body-ledger composition now has positive acquired fixtures, rather than only separate positive controls.

the capture extends the pinned signed-withdrawal runner through two exact, count-checked substitutions: the node class receives a fixed paid-proof method, and each branch acquisition adds endpoint ledger witnesses. the unchanged runner still verifies all its pinned inputs before and after execution, retires the writer before acquisition, acquires history through number and hash paths, checks read restrictions and retires leases across branch changes. no impersonation method is enabled. the new paid-proof permission is single-use and bound to the configured paid probe, exact 13 keys, endpoint block, phase and generation. unleased proof requests are refused before transport.

the owned Anvil1.8.1 London31337 node used published test signing identities, fabricated gas and the retained synthetic token runtime. 38 signed local submissions and 1266 local requests completed; no upstream requests occurred. the node stopped and its listener was released. no real wallet or real CAW balance was used. the complete request record remains private; the public compact capture includes its hash.

## verified scope

each branch passes the existing ledger/code/storage/header checks and the existing complete-body, sender and receipt-root history checks. all three credits, stakes and nonces, totals, dust, message count and selected owner/epoch agree with the same bounded replay. the executed histories include posting, withdrawal and registry authority changes in the unchanged fixture scenario.

negative groups reject the other branch's bodies or ledger proofs, missing or reordered bodies, altered raw transaction bytes, missing receipts, altered receipt status, altered or missing paid storage witnesses, a forged final credit, and a caller acceptance claim.

both tips have the same height and different hashes. both pass when explicitly selected. that proves selected consistency, not a rule for choosing the canonical tip. public-provider independence, endpoint authenticity, anchor-body verification, EVM execution verification, token backing, production authority, withdrawal safety, consensus, finality, freshness and production acceptance remain unproven. the fixture is a synthetic experiment, not production deployment certification. the stronger composition is not connected to the frontend.

## reproduce

```text
node --max-old-space-size=256 experiments/registry-bootstrap/check-signed-ledger.mjs experiments/registry-bootstrap/signed-ledger.json
```

[reader](../experiments/registry-bootstrap/body-ledger-reader.mjs), [checks](../experiments/registry-bootstrap/check-signed-ledger.mjs), [capture](../experiments/registry-bootstrap/signed-ledger.json), [results and hashes](../evidence/SIGNED_LEDGER_RESULTS.json).

fresh acquisition uses the existing pinned Python dependencies, Anvil binary and Windows safeguards. select a new output filename with an existing parent:

```text
python -B experiments/registry-bootstrap/capture-signed-ledger.py --anvil <anvil.exe> --output <new-capture.json> --expected-input-sha256 9d0b222ace51dad9f3393fc12bc6e1458d7709c492a3acb012c4e8fef9a66f93
python -B experiments/registry-bootstrap/compact-signed-ledger.py <new-capture.json> <new-joint.json>
node --max-old-space-size=256 experiments/registry-bootstrap/check-signed-ledger.mjs <new-joint.json>
```

the raw acquisition includes both collectors and the complete private RPC record. the checked public form projects each branch's ledger envelope and the capture values from body_captures, preserving their bytes as JSON data. its rawCaptureSha256 identifies the retained raw record. source/provenance records accompany this increment. the existing 768 MiB startup memory, 2 GiB disk, 512 MiB node process, 600 second node lifetime and request/output limits were retained. fifteen groups are a focused result; prior whole-suite counts were not rerun.

UNRESOLVED -- deterministic agreement at a caller-selected header is not permission to trust that header. next reconcile the stronger result with the existing anchor-selection and operator-independence requirements. external token-state backing and contract-wallet/production authority require separate evidence; they are not implied by signed fixture transactions.
