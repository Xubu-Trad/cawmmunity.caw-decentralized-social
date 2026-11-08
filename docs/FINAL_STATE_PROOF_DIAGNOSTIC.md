# Final-state proof diagnostic — incomplete

The accounting model matches the local final snapshot. The next step requested actual storage proofs under the final execution header. A fresh bounded Anvil 1.5.1 / Shanghai run retains the same 26 signed transactions and expected lifecycle outcomes, then requests `eth_getProof` and runtime code at the captured final block number. The header hash is checked again after acquisition. The local process was stopped afterward.

## Observed result

The unchanged header-bound account/storage/code readers accept **18 of 20 requested storage fields**. Their values match reconstructed accounting. Runtime code matches the selected compiler artifacts, with the constructor's immutable token address applied. This is not independent source compilation.

Two fields reject with `ETH_PROOF_STORAGE`:

| Account | Field | Captured proof behavior |
| --- | --- | --- |
| Custody candidate | account 3 epoch (slot 7) | present leaf, RLP value `0x80`, claimed zero |
| Mock token | synthetic wallet A balance | present leaf, RLP value `0x80`, claimed zero |

The existing reader permits zero through an absence proof but rejects an included empty integer. The diagnostic records the present leaves; it does not turn those rejections into accepted balances. Whether this local-client representation requires a capture/client correction must be investigated before changing any acceptance rule. No claim is made here about a production-chain defect.

`completeFinalStateProof` remains **false**. The diagnostic exits **2** after writing its incomplete result. Nine corruption controls reject: changed storage claim, changed account proof, missing slot proof, wrong account, wrong header, altered runtime, altered slot layout, missing wallet batch and duplicate field. Those passing controls do not make the complete proof pass. The earlier local snapshot match remains valid within its original scope.

## Reproduce

Use the [signed lifecycle instructions](SIGNED_LOCAL_LIFECYCLE.md) to create a fresh local execution output. The harness now requests compiler storage layout and immutable references, then captures final proof batches in groups of at most 16 fields. No core reader limits or zero-storage rules changed.

```sh
node experiments/c007-constructor/prepare-final-inputs.mjs /absolute/path/to/fresh-execution /absolute/path/to/new-proof-inputs
node --max-old-space-size=256 experiments/c007-constructor/check-final-proofs.mjs /absolute/path/to/new-proof-inputs /absolute/path/to/new-proof-result.json
# Expected for the retained Anvil behavior: exit 2, INCOMPLETE_ZERO_STORAGE_REJECTED.
```

The retained [diagnostic summary](../evidence/c007-final-proof-diagnostic-20261108/result.json) records exact header/root, rejected slots and controls. The fresh raw capture and original failed lane are preserved locally; they are not included in this public diagnostic package. Reproduction requires making the local capture above. The input manifest pins locally captured bytes and endpoints; it does not authenticate the chain. The diagnostic is deliberately bounded to this lifecycle and expects these two rejections, not a general-purpose production verifier.

## Next gate

Resolve zero-storage proof representation using an independently checked execution-client/reference fixture, preserve both outcomes, and retain fail-closed behavior until the evidence supports a change. Then require all final storage values, including wallet A's zero balance, to verify. Independent endpoint selection, consensus/finality, general execution replay, real NFT/token admission and release review remain separate gates.
