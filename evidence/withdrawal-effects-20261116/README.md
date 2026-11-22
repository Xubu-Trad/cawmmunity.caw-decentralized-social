# withdrawal effects verified against local state proofs

baseline: `8342dff6e39609e69e344d903b0e073f25fa9304`.

the new offline reader links one signed withdrawal to its successful receipt and the custody/token state before and after it. it checks both header hashes and their parent relationship, transaction and receipt roots, recovered sender, exact withdrawal bytes, registry ownership/epoch, post nonce, contract code hashes and storage proofs. the selected account loses exactly the withdrawn credit, custody and unpaid/credited liabilities decrease by that amount, and the recipient gains it. unallocated budget and the other fixture accounts' credits stay unchanged.

this first version accepts only an externally owned account withdrawing from the selected research fixture in a single-transaction block. contract-wallet calls and mixed blocks are outside this version. boundary proofs alone cannot isolate one transaction's effects inside a mixed block. endpoint hashes and code selections remain caller trust assumptions. this is not public-chain authentication, arbitrary-token verification, consensus verification or a claim of production safety. the checker does not execute the EVM; its executionReplayed flag remains false.

## fresh local evidence

a fresh isolated Geth run transferred account ownership, posted and withdrew two mock units. account credit moved from two to zero, custody from ten to eight, and the owner's token balance from ninety to ninety-two. all 37 withdrawal reader controls passed; 17 existing accounting regressions passed. EthereumJS 10.1.3 separately replayed the full captured sequence: 14 transactions and 14 matching post-genesis state roots, with the starting root verified. this second engine ran on the same machine; independent operator reproduction remains pending. the local node stopped normally.

the first accounting regression caught an output-shape compatibility change. its failing log is retained. the detailed proof reader now exposes per-account credits separately while the existing console summary keeps its original shape. the same regression passed afterward; no proof requirement was relaxed.

## repeat the checks

use the pinned Node 20.20.2 local-console environment and its existing lockfile/install procedure. from the repository root:

```sh
node integration/local-console/check-withdrawal-effects.mjs evidence/withdrawal-effects-20261116/withdrawal-boundaries.json evidence/withdrawal-effects-20261116/withdrawal-selection.json
node integration/local-console/test-withdrawal-effects.mjs evidence/withdrawal-effects-20261116
node integration/local-console/test-console-accounting.mjs evidence/withdrawal-effects-20261116/accounting-evidence.json
```

the selection file must be reviewed separately; treating the provider's own selection as trusted would not independently authenticate a chain. the core ignores any config or amount embedded in the evidence and uses the separate selection. mutations include missing proofs, altered signed bytes/receipts, wrong endpoint hashes, wrong amount, changed balances/code selections, and missing or multiple transactions.

the included replay.mjs uses the existing EthereumJS reproduction dependencies. capture.json and genesis.json are complete synthetic replay inputs; provide those two paths and an output-result path to the script. a clean-machine bootstrap of every tool and independent execution remain separate pending work.

## next

connect this reader to console acquisition and saved withdrawal receipts, preserving receipt discrepancies and before/after proofs for export. no console withdrawal-verification button or contract-wallet coverage is claimed by this package. the mission and protocol-policy decisions are unchanged.
