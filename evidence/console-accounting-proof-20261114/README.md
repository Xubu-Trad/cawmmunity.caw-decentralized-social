# console accounting bound to state proofs

the local console now verifies custody credit, unpaid liability and displayed token balances against the same selected header used for its authority checks. a conflicting RPC response stops action planning. this closes the earlier gap where ownership was proof-backed but displayed accounting still depended on ordinary contract-call responses.

## exact scope

source baseline: `76c9e75edc5c4d4ea88f43f580150d996de49d76`.

the selected WalletOwnerWithdrawalResearch fixture stores unpaid liability at slot 1, unallocated budget at slot 2, credited liability at slot 7 and account credits in mapping slot 6. its selected AdmissionTokenFixture stores balances in mapping slot 0. the existing header-bound reader checks the account and storage proofs and the selected runtime hashes. we compare the observed credit, liability and wallet/owner/custody balances with those proven values, then require:

- unpaid liability = unallocated budget + credited liability;
- credited liability = credits for the fixture's accounts 2, 3 and 4;
- custody's token balance covers unpaid liability.

this is deliberately specific to those contracts and storage layouts. it is not a general token verifier, proof of future solvency, public-chain consensus or approval to use real funds. authority and accounting are checked before the console returns a snapshot; the existing final header recheck remains. contracts must still enforce authorization and accounting when a transaction executes.

## execution and rejection evidence

a fresh local Geth run transferred account ownership, posted as the new owner and withdrew the remaining credit. proofs accepted both the funded and zero-credit states. unpaid liability and custody balance fell by the withdrawal amount, the owner's balance rose by that amount, and a further withdrawal plan was rejected for insufficient credit.

EthereumJS replay matched all 14 signed transactions and 14 post-genesis state roots, including gas, receipt status and logs. seventeen targeted checks passed: the genuine zero-credit state, contradictory displayed values, altered headers, missing or corrupted proofs, wrong code selections and balance-key deduplication. these mutation tests do not independently exercise every possible insolvency state.

the existing 12 authority checks, 15 acquisition checks, 11 interruption checks and post/transfer/withdrawal plan regression suites also passed. this is same-operator local evidence, not independent reproduction or a browser-extension test.

the first fresh lane stopped on a duplicate variable declaration in the test harness before executing its scenario. that failed lane was retained locally; the corrected V2 lane produced this package. verification rules were not relaxed.

## reproduce

use Node 20.20.2 and the committed local-console dependency lock:

```sh
npm --prefix integration/local-console ci
node integration/local-console/test-console-accounting.mjs evidence/console-accounting-proof-20261114/accounting-evidence.json
```

expected: 17 checks. for fresh mining, use the existing Linux/Geth setup and verified executable. place this checkout in `src/` beside `mine-accounting-proof.py` and `lane.mjs`. copy `evidence/console-safe-transfer-20261113/post-authority-sequence-before-safe.mjs` into `src/integration/local-console/` for the retained old-reader rejection control. provide `GETH_BIN` and run `python3 mine-accounting-proof.py positive` in a fresh directory. the wrapper retains the disk/memory guards and stops only its own node. use the existing locked second-engine replay procedure with the generated capture and genesis. this portable wrapper has not been separately run on another machine.

the earlier 64-file ownership reproduction package remains frozen at its documented target. do not substitute this changed console into that review. this accounting extension is a separate increment.

next: make these verified accounting results visible and unambiguous in the console, then test how the interface handles missing or contradictory accounting evidence. paid-post economics and public-network authentication remain separate unresolved work.
