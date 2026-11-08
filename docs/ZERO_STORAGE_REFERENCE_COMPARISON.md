# Independent zero-storage comparison

## Finding

The two zero-storage rejections are independently reproduced. EthereumJS MPT 10.1.3 verifies the captured account proofs against the selected state root, decodes their storage roots independently, and verifies all 20 requested storage paths. Both disputed values really are **included leaves containing RLP `0x80`**. They are not absence proofs misread by the community reader.

EthereumJS StateManager 10.1.3 provides a separate controlled reference: unwritten zero is absent; writing one creates a leaf; writing zero removes it and restores the earlier root. The unchanged community state reader accepts those absence/nonzero proofs. A separate nonzero slot keeps the test trie nonempty. This executes state-manager controls, not the complete CAW lifecycle or a Geth node.

Six controls pass: wrong-root rejection, changed-node rejection, unwritten-zero absence, nonzero inclusion, cleared-zero absence, and restoration of the initial root after deletion. The 20 captured-path comparisons are separate from those six controls. These checks do not repair or approve the original Anvil capture.

## Primary-source corroboration

- [Geth v1.16.0 state storage update](https://github.com/ethereum/go-ethereum/blob/v1.16.0/core/state/state_object.go#L308-L336) updates nonzero slots and deletes zero-valued ones.
- [Anvil v1.5.1 storage-trie builder](https://github.com/foundry-rs/foundry/blob/v1.5.1/crates/anvil/src/eth/backend/mem/state.rs#L24-L35) encodes every supplied storage-map entry without filtering zeros. Its [proof builder](https://github.com/foundry-rs/foundry/blob/v1.5.1/crates/anvil/src/eth/backend/mem/mod.rs#L3631-L3656) uses that iterator.

FACT: independent proof decoding agrees with the captured included-zero representation, while the independent state manager deletes zero storage. INFERENCE: the retained local Anvil representation explains this discrepancy; there is no evidence here requiring a relaxation of the strict reader. The cited Geth behavior was source-reviewed, not executed. The installed independent-library files and fetched sources were hashed in the local evidence archive. Dependencies were reused, not freshly installed.

## Preserved compatibility findings

The first comparison reached an independent-library empty-trie proof-verifier rejection. A subsequent nonempty-trie control avoids that separate boundary; it does not establish empty-trie support in that library. Another attempt rejected EthereumJS's byte-style quantity `0x01`. The final adapter canonicalizes only the generated fixture's numeric storage-value metadata to `0x1`, retaining raw output and unchanged proof-node bytes. No Anvil proof bytes, roots or reader rules were rewritten. Earlier failed lanes remain preserved.

## Reproduce

Use the same installed candidate dependency versions: EthereumJS MPT, StateManager, RLP and Util 10.1.3; recorded Node 20.20.2. The candidate dependency lock supplies these transitive packages. Fresh installation was not tested here.

```sh
node --max-old-space-size=256 experiments/c007-constructor/compare-zero-proofs.mjs /absolute/path/to/fresh-execution/final-proof-batches.json /absolute/path/to/new-reference-result.json
```

Create the input with the [final-proof capture instructions](FINAL_STATE_PROOF_DIAGNOSTIC.md). The raw retained capture remains local; the public [comparison summary](../evidence/c007-zero-reference-20261108/result.json) contains per-slot conclusions and control roots. The comparison recovers trie contents, not consensus authority or execution semantics.

## Decision and next step

Keep the strict reader unchanged. The existing capture still has two rejected fields and `completeFinalStateProof=false`. Do not remove zero leaves and recompute a replacement root while claiming it belongs to the original signed header. Next independently execute the candidate lifecycle with canonical zero-storage handling, collect new proofs, and compare all reconstructed balances against that new execution's final root. Endpoint authentication, consensus/finality and production readiness remain separate gates.
