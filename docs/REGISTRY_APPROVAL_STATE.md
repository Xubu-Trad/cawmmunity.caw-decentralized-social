# Selected registry approval proofs

`inspectTestRegistryApprovalState(evidenceText, selectionText)` extends the fixed test-registry profile with a token approval and one operator grant belonging to the proved current owner. It does not enumerate all grants or authorize a transaction.

Selection contains exactly schema `caw-test-registry-approval-selection/1`, `headerProfile`, `hash`, `registry`, `accountId` and `operator`. The operator is a canonical 20-byte address. Zero is permitted because the fixture permits a zero operator. Evidence contains exactly `header`, `proof` and `code`, as in the existing state reader, with exactly four storage witnesses in this order:

1. Owner mapping at root slot 0 for the selected account ID.
2. Epoch mapping at root slot 4 for that ID.
3. Token approval mapping at root slot 2 for that ID.
4. Nested operator mapping at root slot 3, keyed first by the **proved current owner**, then by the selected operator.

The owner is derived from its proof, never from an unverified caller-supplied owner label. The existing code/header/account checks cover every witness. Zero values require valid absence witnesses. Approval values must fit an address; the operator flag must be exactly zero or one. The unchanged owner/epoch-only reader still requires exactly two witnesses.

Success reports the nested owner/epoch result, `approved`, `operatorOwner`, `operator`, `operatorAllowed` and `selectedApprovalStateDecoded`. This covers only that selected owner/operator pair. `allOperatorGrantsVerified`, transaction/current permission, account authority, execution, endpoint authentication, consensus, finality, freshness and production acceptance remain false. No previous flag is upgraded and no recovery adoption is enabled.

## Executed evidence

FACT — six states were acquired from the pinned TestAccountRegistry on a disposable guarded Anvil 1.8.1 London chain: initial; token approval granted; operator granted; transferred to B; returned to A; and operator revoked. All acquired proofs matched direct `authority`, `getApproved` and `isApprovedForAll` reads. Latest-state direct calls were bracketed by equal local header hashes.

Transfers cleared the token approval. A's operator grant did not become B's grant, remained present when the NFT returned to A, and disappeared after explicit revocation. Local callers were funded and impersonated; no signature ownership proof, remote RPC, production broadcast or code/storage injection is claimed. The transfer caller was both token-approved and an operator; this run does not isolate which of those two authorizations was necessary.

Twelve tests cover the six acquired states, provenance, wrong-owner witnesses, changed operators, missing zero witnesses, forged values, substituted code and forbidden owner overrides. Full offline suite: 1144/1144 across 60 files. Tests reuse existing proof primitives; this is not an independent cryptographic implementation.

## Reproduce

With the existing Windows resource-guarded environment and pinned Anvil binary:

```text
python experiments/account-authority/capture_registry_approvals.py --anvil PATH_TO_PINNED_ANVIL --output NEW_CAPTURE.json
node --test tests/registry-approval-state.test.mjs
```

The output parent must exist; the output file must be new. The test checks the committed capture. A fresh capture can be checked by passing each case's evidence/selection JSON to the exported reader. Block hashes may differ between runs. The existing 768 MiB startup and other process limits remain enforced. Source and capture hashes are in [the validation record](../evidence/REGISTRY_APPROVAL_TEST_RESULTS.json).

UNRESOLVED — selected endpoint authenticity, complete ordered history and transaction-position authority. This does not authenticate every past operator grant. The earlier reconciliation counterexample remains valid for the owner/epoch-only profile. Next: compose selected approval state with the existing signed-history reader at an explicitly matched endpoint, without treating a post-state grant as authorization for earlier calls.
