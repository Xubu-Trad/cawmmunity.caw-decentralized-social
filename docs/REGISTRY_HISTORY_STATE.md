# Signed registry history and endpoint state

`inspectPaidRegistryStateHistory(text)` composes the existing signed-body, receipt, post-signature and registry-replay readers with the four-witness approval-state reader. It accepts evidence, never a caller's claimed verified report. This remains a reference checker, not automatic recovery adoption.

The exact JSON envelope contains schema `caw-paid-registry-state-history/1`, `history`, `manifest`, `captures`, `policy`, `stateEvidence` and `stateSelection`. It is limited to 1 MiB using the unchanged bounded parser. Component limits remain in force. The first four evidence fields use the existing paid-registry history API; the last two use the selected approval-state API.

After the mandatory signed history checks pass, the proof's selected block hash must equal the history manifest's checked end hash, and the registry addresses must match. The selected account's final owner, epoch and token approval must match replay. The selected current-owner/operator permission must also match; an absent replay entry means false under the fixture's explicit zero-initial-grants assumption.

Success returns frozen nested reports, `selectedEndpointStateMatchesHistory` and `selectedOperatorMatchesReplay`. It does not rewrite lower-level flags. `allRegistryStateVerified`, `initialStateVerified`, `executionVerified`, `accountAuthorityVerified`, `currentPermissionVerified`, `endpointAuthenticated`, `consensusVerified`, `finalityVerified`, `freshnessVerified` and `productionAccepted` remain false. One selected account/operator pair does not prove every registry slot or grant.

## Evidence boundary

FACT — the retained signed-history run and the later executed approval-proof run are separate executions. Their endpoints cannot be combined as one observed history. The integration tests therefore use explicitly constructed terminal state roots and proofs attached to the retained signed transaction/receipt history. Only the final header's state root/hash and associated block-hash metadata are replaced; no claim is made that the retained transactions executed to that constructed root. Transaction and receipt commitments alone do not prove such execution.

Eight focused checks cover matching composition, conflicting owner/epoch/approval/operator values, a different selected endpoint, and inability to bypass signed-body verification with a supplied success flag or invalid transaction bytes. The five endpoint recipes are synthetic, generated offline using existing Python trie/header primitives, not an independent cryptographic implementation. Full suite: 1152/1152 across 61 files.

The first focused run stopped at the wrapper's invalid 8 MiB parser request. The wrapper was corrected to the shared parser's existing 1 MiB maximum; no parser or resource guard was weakened. Earlier results remain preserved. The generator's old executable fingerprint also stopped startup; the current configured bundled Python 3.12.14 executable was checked for a valid OpenAI signature and pinned for this run.

## Reproduce

```text
python -I -B reference/fixtures/generate-paid-registry-state-fixtures.py --output NEW_RECIPE.json
node --test tests/paid-registry-state-history.test.mjs
```

The generator refuses an existing output. Compare the new recipe with the committed recipe hash in [the validation record](../evidence/REGISTRY_HISTORY_STATE_TEST_RESULTS.json). The test reads the committed recipe and retained signed fixture. No network or wallet is used by this recipe generator.

UNRESOLVED — a single executed signed-body capture with matching endpoint proofs, public anchor authenticity, execution and contract-wallet/callback scope. Next: extend the established signed local collector with read-only proof acquisition at its own endpoint. Do not reuse impersonated actors as signature evidence, infer prior authorization from final ownership, or present constructed endpoints as observed EVM state.
