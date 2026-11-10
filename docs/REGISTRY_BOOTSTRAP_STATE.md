# Complete local starting state and repeated storage checks

A new capture disables generated dev accounts (`--accounts 0`) and the default CREATE2 deployer. The exported state contains exactly two disposable funded accounts, each with100 native test units, nonce0, no code and no storage. No impersonation, fork or post-start account modification was used.

The genesis header still carries an empty state root in this installed Anvil build, despite the exported funding. The strict check stopped before transactions. We preserved that failure and the original genesis header. A subsequent new run explicitly mines one empty bootstrap block and requires its root to equal the complete starting allocation before submitting any of the28 signed transactions. This verifies a local starting point at block1; it does not authenticate genesis or consensus.

The Python trie reconstruction and independent EthereumJS trie reconstruction both match `0x7db35ca88845c0a6ae4198fed747f974eb748f895dbeb28cf28852d22f4acde4`. Independent negative controls reject a missing account, changed balance, additional account and changed header root. The original genesis header and exported starting state remain available for inspection. The bootstrap-to-first-transaction parent link and subsequent transaction header sequence pass the existing reader.

## Repeated checks

- All28 signed operations were mined after the bootstrap block; the local node was stopped after capture.
- The unchanged strict body reader accepts26/28; both transaction size rejections remain.
- The unchanged storage reader accepts15/16 selected fields; `approved2` still rejects with `ETH_PROOF_STORAGE`. Correcting starting-state acquisition does not repair that proof.
- Sequential Geth execution using the new captured block contexts now matches state roots for operations0–3. First divergence is operation4 (zero-based); all later state roots differ. All28 signed bodies, gas charges, statuses, logs, transaction roots and receipt roots still match.

The starting-state explanation therefore no longer accounts for every later mismatch in this new lane. The cause at operation4 is unresolved; it must be isolated before claiming state-transition agreement. No unsupported attribution to an engine defect is made. Do not substitute Geth roots into captured headers or accept a failed proof as an RPC value.

## Offline starting-state reproduction

With Node20.20.2 and @ethereumjs/mpt and rlp10.1.3, run from the draft checkout:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/verify-bootstrap-state.mjs evidence/registry-bootstrap-20261110/starting-state.json evidence/registry-bootstrap-20261110/capture.json
```

The fixture-specific checker requires the exact two accounts and values, rebuilds their trie, checks the selected bootstrap header's integrity and compares its state root. It is not a general-purpose or public-chain acquisition validator. Compare the result with `independent-starting-state.json`. `context-replay.json` records every Geth/captured state root; `result.json` preserves the strict reader's partial result.

Acquisition used the previously pinned Anvil binary and Geth binary, existing2GiB disk/1GiB startup memory guards and bounded run times. No release or public deployment occurred. Next isolate operation4's state difference from the matching predecessor state, then repeat canonical proof acquisition. Public checkpoint trust and finality remain separate unresolved gates.
