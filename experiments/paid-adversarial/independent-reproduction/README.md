# Independent reproduction evidence — Issue #2 alpha.21 adversarial regression

This package lets a third party verify, offline and without re-running any
EVM experiment, that the alpha.21 adversarial regression reported by the
author of
[Xubu-Trad/cawmmunity.caw-decentralized-social](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/2)
was independently reproduced on a different machine and operating system,
with identical deterministic outcomes.

**Status: local evidence package. Nothing in it has been posted to GitHub.**

## What was reproduced

- Experiment: `experiments/paid-adversarial/run_paid_adversarial.py`
  (72 bounded adversarial cases, 208 local transactions) against the
  unchanged alpha.20 paid-action contract.
- Source commit of the independent run:
  `85627137cda2e79390f57dc6e05c7ceb7809e049`
- Baseline contract commit: `91479b6dc8c9a264411d75177d43029e0266c354`
- Independent environment: Windows 11, Python 3.12.10, cryptography 50.0.1,
  Anvil 1.8.1 official Windows binary matching the repository pin
  (size 41,583,616 bytes, SHA-256
  `c6e29da1b010fe00bac6c0dc5c29484bd641deb5a84050aea10d13e9dc4fe26f`).
  The pin is the Windows binary; the Linux binary of the same release does
  not match it, and the runner requires Windows-native Python, so the
  reproduction was performed on Windows.
- The exact command line as typed was not recorded. The run used the
  runner's required form:
  `python experiments\paid-adversarial\run_paid_adversarial.py --anvil <pinned anvil.exe> --output <fresh file> --expected-input-sha256 2637376a27b2a175d1995e98ff71c026f9925dff8a01729943b9f62bd9056bde`
- Run time recorded inside the independent trace:
  2026-11-03T15:14:44.909572+00:00, complete = true, failure = null.
- No real wallet, no public transaction, synthetic token only
  (`synthetic_only = true`). The only keys involved are the repository's
  published public test scalars, which appear identically in the retained
  trace.

## Files

| File | Content | SHA-256 |
|---|---|---|
| `independent-run.json` | Independent execution trace (byte-identical copy of the original upload) | `e9cf0f605958a78b79fb0f9fba46e145c88d8ce62a25caa87e1c669e9506e9da` |
| `retained/execution-trace.json` | Author's retained trace at the source commit | `5b639707c113b23fa7025a85c098693a6be3431781f175cf1f13b22d1b22b2dc` |
| `retained/execution-summary.json` | Author's retained summary | `1946ebb82978eb424086dcb81dc969dd62ad0e76108e06f2880396fb86ad30a9` |
| `retained/experiment-inputs.json` | Input manifest (16 files, hash-pinned) | `2637376a27b2a175d1995e98ff71c026f9925dff8a01729943b9f62bd9056bde` |
| `compare_traces.py` | Cross-trace comparison script (this package) | see package listing |
| `comparison-result.json` | Output of `compare_traces.py` on the packaged files | see package listing |
| `checker-result.json` | Output of the repository's offline checker on the independent trace, produced by `run-checker.mjs` (pure JSON) | `230e8cf8d12355118b654c9d054b7feb9fbb239727454fa70b815c388a659cec` |
| `run-checker.mjs` | Driver that re-runs the repository's offline checker against a trace | see package listing |
| `REPRODUCTION_RECEIPT.md` | Receipt: commit, environment, hashes, unconfirmed items | `9331058988180fa880080b23de6cbccc0064b0590ef6d6461f1d1cd16dbee413` |

## How to verify (two independent layers)

**Layer A — the repository's offline checker (single-trace consistency).**
`validateEvidence` from the repository's
`reference/paid-adversarial-evidence.mjs` recomputes the accounting of one
trace without executing an EVM. To re-run it against the packaged
independent trace you need a clone of the repository at commit
`85627137cda2e79390f57dc6e05c7ceb7809e049` (for the checker and the input
files), then, from this package's directory:

```
node run-checker.mjs --repo <path-to-repo-clone> --trace independent-run.json
```

Exit code 0 means the checker accepts the trace; the JSON printed on
stdout is what `checker-result.json` records: 72 cases, 47 rejected cases,
11 successful posts, 208 transactions, and the final snapshot. The checker
itself states `authenticatesChain: false` and `reexecutesContract: false`.

**Layer B — the comparison script in this package (cross-trace agreement).**
Runs anywhere with Python 3.10+ (standard library only), using only the
packaged files:

```
python3 compare_traces.py \
  --retained-trace retained/execution-trace.json \
  --retained-summary retained/execution-summary.json \
  --independent-trace independent-run.json \
  --out comparison-result.json
```

Exit code 0 means every deterministic check MATCHes. Adding
`--experiment-dir <clone>/experiments/paid-adversarial` additionally
verifies the 16 input files on disk against the manifest hashes.
`comparison-result.json` in this package was produced by exactly the
command above (without `--experiment-dir`).

## Verification scope

Checked and MATCHing: all 72 case PASS/FAIL flags; case labels, expected
outcomes and before/after snapshots; the 47 rejections and their state
invariance (before == after); the 11 successful posts; status and gasUsed
of all 208 receipts; the final 40-slot snapshot (credits
150000000000000000000007, vault 150000000000000000000018, dust 11); the
16-entry input manifest; the Anvil/chain node configuration.

Classified as EXPECTED_DIFFERENCE (nondeterministic, individually
explained, not ignored): 25/72 transaction hashes (signed content depends
on block timestamps); RPC calls 983 vs 970 — exactly 13 extra
`eth_getTransactionReceipt` polls, because the first poll returned null
for 13 transactions in the independent run and for none in the retained
run, with identical final receipts; run timestamps and performance
counters; consequently the whole-file SHA-256 of the independent trace
differs from the retained capture hash, which is the hash of the retained
trace file itself.

Out of scope: this package does not re-execute the contract, authenticate
a chain, or guarantee any property not listed above.

## Safety scan (performed before packaging)

`independent-run.json` was scanned for private keys, seed phrases,
API/RPC credentials, e-mail addresses, personal names, and local
(Windows) file paths. None were found: no drive or user paths, no e-mail
addresses, no credential fields; the only URLs are the repository's own
public links, identical to those in the retained trace; the only key
material is the published public test scalars, identical in both traces.
The packaged copy is therefore byte-identical to the original (same
SHA-256) and no redaction was necessary. The original was not modified.
