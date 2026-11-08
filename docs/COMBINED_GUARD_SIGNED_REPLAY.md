# Combined guard: new signed lifecycle and replay

The combined ownership/staking/settlement guard now has its own signed local lifecycle and two-engine execution evidence. Source SHA-256: `e4149f2ddb09e5f83c999e20dc14180f8f7c254584f401e2249bead0c2e45cfa`. Earlier sources, failed evidence lanes and frozen replay packages remain unchanged.

## Verified results

- Loopback-only Anvil capture: **26 signed transactions, 18 successes and eight expected reverts**; local services stopped afterward. Native funding is explicit synthetic genesis allocation, not production funds.
- Existing history readers accept blocks 1–26, matching transaction/receipt commitments and recovered senders. Nine history-corruption controls reject. Original genesis is retained, not silently rewritten to fit the reader profile.
- Existing accounting model and EthereumJS transaction execution agree on final contract values. Proofs verify **20 storage fields and four native accounts**, including two zero absence proofs under the independent execution root. Seven transaction/proof controls reject.
- Total gas: **8,012,622**. Base-fee burn: **3,605,760,036,571,469 wei**. Fee-recipient income: **12,419,483,963,428,531 wei**. Native balances reconcile under the selected funding and fee context.
- New synthetic block construction/fresh replay matches all 26 state roots, transaction and receipt roots; its positive control and seven corruption controls pass.
- Publisher-verified Geth independently matches all 26 synthetic transitions, roots and final native balances. Its six comparison/execution controls pass. Eight frozen-input checks pass for this separately pinned package.

Final independent state root: `0x439233c611f4f579bed50c3cc3f791bb4007655f093bd4226e43528f04ec192c`.

## Important boundaries

The normal signed lifecycle is new evidence for this bytecode. The adversarial callback scenarios themselves remain separate local creation/call tests; they were not submitted as signed chain transactions in this capture. Do not describe the normal lifecycle as a signed adversarial callback suite.

As before, synthetic block construction uses genesis fee 1,142,857,142 wei and adjusts 25 timestamps to increase strictly. Geth receives these explicit contexts; this is not consensus/header authentication or repair of Anvil's original state roots. The proof values are anchored to independent execution, not accepted as complete original-Anvil state proof. The same local operator performed both engines; outside builder reproduction remains open.

No full repository suite, fresh dependency install, real-token/NFT admission, economic-policy acceptance or public deployment is established. This remains a separate research variant in draft PR #19; neither it nor its parent PR is merged by this update.

## Reproduce the new frozen fixture

The [new package](../evidence/c007-combined-replay-20261108/manifest.json) contains the exact four files selected by the new runner. They total 512,410 bytes and were reviewed for known synthetic genesis/receipt actors and visible/hex-decoded path or credential patterns. No matches were found; a pattern scan alone is not exhaustive. The original fixture and runner pins remain unchanged.

From the repository root, use the already documented publisher-verified Geth binary:

```sh
python3 experiments/c007-settlement-callback/compare-geth-transition.py evidence/c007-combined-replay-20261108 evidence/c007-combined-replay-20261108/blocks.json /absolute/path/to/verified/evm /absolute/path/to/new-output
```

Existing Linux/WSL resource checks and limits apply. Actual execution was WSL; native Linux platform selection has mocked coverage. See [the original reproduction guide](../evidence/c007-frozen-replay-20261108/REPRODUCE.md) and [publisher verification](SECOND_ENGINE_TRANSITIONS.md) for prerequisites and trust boundaries. Do not change hashes to accept mismatching files.

The signed collector is retained alongside the variant for source review. Its live-capture prerequisites include the existing loopback Anvil wrapper and ethers dependency; replay of the published fixture does not require them. The prior unsigned lifecycle and callback commands remain available separately.

## Next gate

Review the shared serialization invariant and reproduce the published new fixture independently. Extend adversarial callback tests to signed transactions if that evidence is needed for promotion. Then return to the roadmap's unresolved registration/NFT authority and scalable economic design, without treating this finite three-account probe as a public candidate.
