# C-004: cross-profile text acceptance evidence

This comparison records two **experimental profiles**, not an approved
interoperability or whitespace policy. Neither profile is presumed defective.
The demo requires non-whitespace text; the unchanged Paid Action Probe requires
nonempty strict UTF-8, at most 420 scalars and at most 1,680 bytes. It does not
reject valid whitespace merely for being whitespace.

## Observed inputs

Escapes below denote exact input; no trimming or normalization is applied.
`a × N` means the deterministic string `"a".repeat(N)`.

| Input | UTF-8 hex / generator | Bytes | Scalars | Demo | Probe record |
| --- | --- | ---: | ---: | --- | --- |
| `""` | empty | 0 | 0 | `EMPTY_TEXT` | `InvalidText` |
| `"   "` | `202020` | 3 | 3 | `EMPTY_TEXT` | accepted (new local run) |
| `"\t"` | `09` | 1 | 1 | `EMPTY_TEXT` | accepted |
| `" \t\r\n "` | `20090d0a20` | 5 | 5 | `EMPTY_TEXT` | accepted |
| `"Hello CAW"` | `48656c6c6f20434157` | 9 | 9 | accepted | accepted |
| `"  CAW  "` | `20204341572020` | 7 | 7 | accepted, preserved | accepted, preserved |
| `"\u00e9"` | `c3a9` | 2 | 1 | accepted | accepted |
| `"e\u0301"` | `65cc81` | 3 | 2 | accepted | accepted |
| `a × 420` | `61` repeated 420 times | 420 | 420 | accepted | accepted |
| `a × 421` | `61` repeated 421 times | 421 | 421 | `TEXT_TOO_LONG` | `InvalidText` |

## Reproducible comparison

From the repository root, with Node 24:

```sh
node --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/model.test.mjs
node --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/caw-paid-action.test.mjs
```

The added test imports the actual demo model through the existing model suite.
For each fixture it executes `applyAction` in a fresh demo state and checks the
result/error and preserved text. It separately checks retained Probe receipt
status, recorded `eth_call` error data for rejected text, calldata text bytes,
and successful `Posted` event bytes. It checks the unchanged Probe source hash.
**Running this comparison does not execute Solidity.** A receipt alone contains
no revert reason; `InvalidText` is supported by the accompanying recorded call.

`tests/fixtures/c004-cross-profile.json` contains reduced transaction/receipt
records and provenance. Nine cases come from the independently checked
`CAWmmunity_Issue8_C004_R01_Evidence.zip`, SHA-256
`20bc1c21979fa88238a645e03ee4b1737bc490603bdd6bbfdbf7a86de81d5b75`.
The source records were `RESULTS.json`, `TRANSACTIONS.json` and
`DEPLOYMENT.json`; their hashes are retained in the fixture. Original ZIP member
hashes and source Git blobs were checked before selecting records.

The spaces-only case was added using the same unchanged Probe and Registry in
a fresh isolated London EVM (chain ID 31337, no fork), Solidity 0.8.10,
optimizer 200. Original creation bytecodes were reproduced before deployment.
A synthetic ERC-20 was installed at the Probe's token constant address; this is
**not** an execution of the real CAW token. The review evidence packet contains
the runner, compiler input/output, RPC log, receipts and source identities.
No compiler, EVM or new dependency is required by the repository comparison test.

The compared application Base is
`832e3eb88ca75694a55da0478c9106046b41ba56`; the historical experiment is
`91479b6dc8c9a264411d75177d43029e0266c354`. Probe, Registry, demo model and
economics source bytes were checked equal between those fixed inputs.
The Probe SHA-256 is
`e48f8f8f816aae21e0e9865a8be0aa2e47204ea04b4c12b4124e5b0452412da1`.

## Contribution and limits

PR #11 documents Unicode counting examples and PR #12 exercises demo Unicode
boundaries. This check adds a different assertion: **identical text can have
different acceptance outcomes across the two retained profiles**, notably
whitespace-only inputs. The accent and 420/421 cases are small cross-profile
controls, not another general Unicode counting table or segmentation suite.

The embedded records support offline consistency checks, not independent
production-chain authentication. They are reduced evidence, not the complete
original archive. Editing an expected outcome must produce a test mismatch;
the contributor review packet records that negative control.

Both accepted profiles preserve the represented text bytes; this does not
establish general frontend/protocol agreement or a new signature rule.
Issue #8 still requires a normative counting/whitespace decision. This change
selects neither profile, changes neither validator, adopts no normalization,
and establishes no DM, URL-weighting, production compatibility or account
security guarantee.
