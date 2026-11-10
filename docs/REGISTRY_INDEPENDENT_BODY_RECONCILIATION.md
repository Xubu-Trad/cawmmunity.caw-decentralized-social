# Independent contiguous body and receipt reconciliation

FACT — a separate pinned-fixture diagnostic reconciles all 28 captured transaction bodies with their receipts. EthereumJS 10.1.3 decodes type-2 envelopes under Shanghai/chain31337, verifies signatures, derives the two expected disposable senders, checks each sender's nonce sequence and reconstructs each transaction trie root. The existing CAW receipt and header readers verify the complete one-receipt blocks and parent-linked header sequence. Exact raw bytes, transaction hashes, statuses and logs match the earlier reconstructed fixture inputs.

All five altered-input controls reject: changed receipt status, changed transaction byte, missing block, duplicated transaction and an oversized envelope. No execution or state transitions were rerun. Agreement with earlier model input is not independent public-chain authentication.

## Separate diagnostic, unchanged acceptance policy

The original strict body reader remains unchanged: it accepts 26/28 blocks and rejects the same two oversized envelopes. This diagnostic does not add a fallback to that reader, a provider acceptance switch or a new production profile. It is restricted to the pinned local capture and operations, 29 captured blocks including genesis, 28 type-2 transactions, one transaction per block, two disposable senders, 34,000 bytes per envelope, 200,000 aggregate transaction bytes and 2 MiB per input file. These bounds describe this research tool, not a general transaction acceptance policy. Expanding the general reader still needs explicit profile/resource review.

The final `approved2` proof still rejects as an included-zero leaf. No node, proof or root was edited to disguise this; full storage verification remains incomplete. Public checkpoint trust, consensus, finality and production acceptance remain unestablished. An internally consistent chain is not necessarily an authentic chain.

## Reproduce

Use Node20.20.2 and @ethereumjs/mpt, tx, common and rlp10.1.3. From the draft checkout:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/verify-contiguous-independent.mjs evidence/registry-contiguous-20261109/capture.json ced803e9c056f572cbed7e795f06f65d8af2f60a83da9d7ed1431854137f6825 evidence/registry-withdrawal-verification-20261109/input/operations.json 51a138d15e5060344e914599c0e2e2624a90905a99bb8f08e1a9ca0c5b7361f3
```

Input SHA-256 pins are mandatory; the runner refuses an unpinned or oversized input before parsing. The recorded local wrapper checked 2 GiB disk and 1 GiB available memory, set the Node heap to256MiB and a120-second timeout. It reused installed dependencies and made no network calls. See `evidence/registry-contiguous-independent-20261110/result.json` for all28 sender/nonce/hash/receipt associations and negative controls. This result complements, rather than supersedes, the original strict reader's report.

Next: canonical storage evidence from independently executed contiguous state and a portable acquisition procedure. Do not substitute the previous synthetic Geth state root into the Anvil header: the execution contexts differ. A new acquisition must earn its own root and ancestry checks.
