# Independent call-level execution and final proofs

The candidate's verified signed-history inputs now execute through EthereumJS EVM and MerkleStateManager 10.1.3, separately from the original Anvil execution. All **26 outcomes match: 18 successes and eight reverts**, with exact emitted-log comparison. The unchanged community state-proof reader accepts **all 20 final storage values**, matching the accounting model. Account 3's zero epoch and wallet A's zero token balance are proved absent.

## Execution boundary

The harness first regenerates header-chain, transaction-root, receipt-root and sender checks for the local capture. It uses the recovered sender, signed calldata, destination, value, gas price and block context as EVM call inputs. Each caller nonce must match before execution. Contracts are created normally from their creation bytes; no contract code, credits, stake roots or final storage are injected.

Execution uses the Shanghai profile and chain ID 31337. The harness subtracts the bounded legacy intrinsic calldata/creation cost from the supplied gas limit. It does **not** run a complete Ethereum transaction processor: native gas payments, refunds, fee-recipient accounting, full transaction admission and transaction-level access warming are not reproduced. All values are zero in this retained transaction set. Call outcomes and logs matching is meaningful evidence, but not full transaction or block equivalence.

The resulting local execution state root is separate from the Anvil root. Proofs against this new root establish the modeled custody fields and the three token balances; they do not change the old header or authenticate a public chain. No fresh signing or live network is involved. The same chosen compiled creation bytes are executed; independent compilation is not claimed.

## Final comparison

Seventeen custody fields and three token balance fields verify. Credits remain 1,000 / 10 / 10 research units; stakes 1,000 / 3 / 8; owners A / B / B; epochs 2 / 1 / 0; nonce 1. The vault holds 1,020 research units plus one base unit of dust. Wallet A holds zero; wallet B holds 5,000 research units minus one base unit. The display convention is 10^18 base units, not a statement about original-token compatibility.

Four negative controls reject changed claimed values, missing storage slots, a changed proof node, and substitution of the original Anvil state root. The original Anvil capture's two zero-leaf rejections remain preserved and unresolved for that header. No core reader rule changed.

The independent state-manager API's byte-style numeric proof values are converted to canonical JSON quantities before inspection, with raw output retained. Trie-node bytes remain unchanged. Both zero fields are actual absence proofs, unlike the original captured included-zero leaves.

## Reproduce

Use the candidate's installed EthereumJS dependencies 10.1.3 and Node 20.20.2. Fresh dependency installation was not performed. Create a fresh acquisition using the [signed lifecycle and final-proof capture](FINAL_STATE_PROOF_DIAGNOSTIC.md), then run:

```sh
node --max-old-space-size=256 experiments/c007-constructor/reexecute-lifecycle.mjs /absolute/path/to/fresh-execution /absolute/path/to/new-independent-output
```

The source directory must contain `acquired-history.json` and `compiler-output.json` with storage layout. The output directory must not exist. It writes a summary plus per-call roots and raw/adapted proofs. The [public result](../evidence/c007-independent-call-20261108/result.json) is a summary; full local execution/proof records are preserved locally. This run used bounded resources and no local server.

## Next gate

Move from call-level comparison to full transaction processing, including native balances, fees/refunds, transaction validation and final-root comparison under a defined genesis. Preserve the call-level and failed Anvil evidence separately. Independent endpoint authentication, consensus/finality, NFT admission, open-population economics and production review remain open. PR #19 remains draft and stacked on #18.
