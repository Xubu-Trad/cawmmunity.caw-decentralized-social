# Account-proof composition for asset inspection

The asset inventory now composes with the existing `inspectHeaderBoundCode` reader. It verifies the execution header against the caller-selected hash, the account proof against that header's state root, and runtime bytes against both the committed account code hash and the caller-selected code hash. It also checks the selected block number. No new proof primitive or contract behavior was introduced.

## Scope

`boundInventory(evidenceText, selectionText)` accepts bounded JSON strings. Evidence has exactly header, proof and code as required by the existing reader. Selection has exactly chainId, blockNumber, blockHash, address, codeHash and profile. Chain ID is a caller label: the execution header does not independently authenticate it. Profile is explicitly selected, not inferred from a claimed chain.

This lane requires an empty storageProof array and selects zero storage keys. Nonempty storage proofs are rejected, never silently dropped. In the test, an explicit account-only projection is made from the preserved synthetic capture; the original capture and its storage rejections remain unchanged. This does not repair or certify those storage values.

The output separates accountProofAgainstSelectedHeaderVerified from consensusVerified, finalityVerified, currentStateVerified, chainIdAuthenticated, sourceMatchVerified, upgradeAuthorityVerified and productionAccepted. The latter fields remain false. A self-consistent invented header/state can satisfy the first property; an independent canonical/finality selection is still required. The nested scanner retains its own unverified-chain boundary. Token semantics and external dependency authority are not proved by account inclusion.

## Validation

One account/code proof from the preserved local constructor capture passed. Ten controls rejected changed runtime, changed account proof, wrong account, wrong selected header, changed state root, wrong selected code hash, wrong block number, unexpected storage proof, extra selection field and duplicate JSON selection key. These results concern a synthetic token on a local chain, not the actual CAW token or a current Ethereum state proof.

With the existing pinned ethers6.16.0 environment, run `node --max-old-space-size=256 experiments/c007-asset-inventory/test-bound.mjs /absolute/path/to/final-proof-batches.json`. Use the repository's reference/public readers at the parent commit recorded in provenance. The original local input is not newly republished here; its SHA-256 identifies the exact retained file. No network, new deployment or compiler invocation was needed.

Next gate: acquire and verify the actual selected asset's account/code evidence at an explicitly justified block. Keep historical source correspondence, source conflict C-001, canonicality/finality and deployment acceptance separate. No administrator bypass is proposed. README edits remain paused.
