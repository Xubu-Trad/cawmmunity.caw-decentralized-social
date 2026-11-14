# Complete local history: state divergence reconciliation

A fresh isolated run captured the full account state after every one of the28 signed transactions. The complete two-account bootstrap allocation was checked against the starting header before replay. Sequential pinned Geth execution used each captured block environment and carried only its own prior allocation forward.

For all28 steps, nonzero storage, balances, nonces and code agree between Geth and the captured state after omitting zero-valued storage entries and empty accounts for this diagnostic comparison. Independently reconstructing the original exported trie reproduces each captured Anvil root. Reconstructing with those entries omitted reproduces each Geth root. The first4 roots already agree; all24 later differences are explained by the recorded representation differences in this run. Every transaction root, receipt root, outcome, gas charge, log set and signed body also agrees.

The report lists zero-leaf counts and empty-account addresses for every step. This is a full-history check of this fixture, not proof that all possible differences in all versions have the same cause. The rejected original proofs remain unchanged. Omitting entries to diagnose a second root does not authorize accepting a proof under the first root.

## Canonical replay storage proofs

The entire final Geth allocation was independently rebuilt into a trie and required to equal Geth's final state root. Sixteen selected registry proofs generated from that trie pass the unchanged CAW state-proof reader and agree with the independently reconstructed model. `approved2` is absent, so its zero value is accepted as absence rather than an included-zero leaf. Wrong-root, wrong-value, missing-proof and altered-node controls reject.

These proofs bind to the Geth replay root `0x87510643272dc550d8fab031a3291505960b30f1fecdddd5a611d161efdb873f`. They do not bind to the different captured Anvil header. `headerBindingVerified`, `chainAuthenticated` and public finality remain false. No captured header has been edited or replacement chain invented.

## Reproduction and remaining work

The retained state comparison is `evidence/registry-all-state-20261110/result.json`. The final canonical allocation and generated proofs are in `evidence/registry-canonical-replay-20261110/`. To repeat the strict proof check from the draft checkout with Node20.20.2:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/check-canonical-registry.mjs evidence/registry-canonical-replay-20261110/evidence.json evidence/registry-later-20261109/result.json
```

The captured states and per-step Geth environment/allocation/result files remain in the preserved acquisition/replay lane. The whole acquisition is not yet packaged as a portable one-command public reproducer. The existing transaction-reader size limits remain unchanged.

Next obtain a header sequence from a canonical execution source, verify each state transition from the complete starting allocation, and bind these strict storage proofs to that source's actual headers. A local canonical chain would still require independent checkpoint/consensus/finality validation before representing public-chain history. Full production acceptance remains blocked.
