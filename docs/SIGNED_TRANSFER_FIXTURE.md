# Signed local transfer acquisition

FACT — an owned Anvil v1.8.1 node accepted one signed legacy transaction on local chain 31337. Three existing public test accounts were funded locally before the parent block: sender, recipient and fee recipient. No impersonation or public RPC was used. The acquisition allowlist permits only the fixed transaction and these accounts; its refusal checks run before startup. The inherited resource and process guards remain unchanged.

The [fixture](../experiments/signed-transfer-fixture/fixture.json) contains parent and child headers, account proofs and code, the signed transaction bytes and its receipt. The local capture hash records provenance; it does not authenticate a public chain. Request logs and machine-specific runtime details are excluded by the explicit projection script.

Three grouped offline cases passed:

1. Header/body binding, recovered sender, parent and child account proofs, receipt root, and expected nonce/balance deltas. The recipient gains one wei; the sender pays that value plus 21000 gas at 100000000000 wei per gas; the fee recipient gains the priority fee after the base fee is deducted.
2. Child state substituted for parent state is rejected.
3. Altered signed transaction bytes are rejected.

Run from the repository root using Node 24.20.0:

```text
node --max-old-space-size=256 experiments/signed-transfer-fixture/verify.mjs
```

To acquire a fresh capture on Windows with the pinned Anvil binary and existing guards, create an empty output directory and run:

```text
python -B experiments/signed-transfer-fixture/acquire.py --anvil PATH_TO_ANVIL --output NEW_DIRECTORY/capture.json
python -B experiments/signed-transfer-fixture/project.py NEW_DIRECTORY/capture.json NEW_DIRECTORY/fixture.json
```

The verifier reads the fixture alongside its source. To check a new capture, use a separate copy of the experiment directory with the new projected fixture. Keep earlier evidence intact. Fresh captures need not be byte-identical because local block timestamps differ. Acquisition uses the exact retained signed bytes and only artificial balances. Never fund these test identities with real funds.

[Result hashes](../evidence/SIGNED_TRANSFER_FIXTURE_RESULTS.json) identify the source and retained fixture. The initial verifier attempt used the nonexistent output property `sender`; it was corrected to the existing recovered `from` field. That failed attempt remains preserved. Projection line endings were normalized without changing parsed data.

INFERENCE — the retained data is suitable for attempting a bounded first-transaction replay with proven existing accounts. It does not establish that our execution adapter reproduces the transaction.

UNRESOLVED — independent runTx execution, exact receipt/gas comparison, post-state-root computation, contract-wallet authority, account creation/absence, reorgs and production acceptance. The three cases are separate from the previously recorded 1241/1241 offline suite, which was not rerun: existing reference/application sources were unchanged. Next connect this fixture to the pinned execution engine with nonce and balance validation enabled and compare its resulting accounts to the acquired child proofs.
