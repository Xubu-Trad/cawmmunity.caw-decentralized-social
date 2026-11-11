# Independent reproduction evidence — Issue #2 alpha.21 adversarial regression

This package lets a third party verify, offline and without re-running any
EVM experiment, that the independent trace agrees with the retained trace
of the alpha.21 adversarial regression reported by the author of
[Xubu-Trad/cawmmunity.caw-decentralized-social](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/2)
on every deterministic outcome. The independent run itself — on a
different machine and operating system (Windows 11) — is the
reproducer's report, recorded in `REPRODUCTION_RECEIPT.md`; the offline
checks in this package establish consistency of the recorded traces, not
independent authentication of that environment.

**Status: submitted to GitHub as PR #16 on 2026-11-07. (Originally
prepared as a local-only package; see Corrections — 2026-11-07 below.)**

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
| `independent-run.json` | Independent execution trace; byte-identical to the Windows original (SHA-256 confirmed by the reproducer on 2026-11-07) | `e9cf0f605958a78b79fb0f9fba46e145c88d8ce62a25caa87e1c669e9506e9da` |
| `retained/execution-trace.json` | Author's retained trace at the source commit | `5b639707c113b23fa7025a85c098693a6be3431781f175cf1f13b22d1b22b2dc` |
| `retained/execution-summary.json` | Author's retained summary | `1946ebb82978eb424086dcb81dc969dd62ad0e76108e06f2880396fb86ad30a9` |
| `retained/experiment-inputs.json` | Input manifest (16 files, hash-pinned) | `2637376a27b2a175d1995e98ff71c026f9925dff8a01729943b9f62bd9056bde` |
| `compare_traces.py` | Cross-trace comparison script (this package) | see package listing |
| `test_compare_traces.py` | Negative regression tests for `compare_traces.py` (12 scenarios; run `python3 test_compare_traces.py`) | see package listing |
| `comparison-result.json` | Output of `compare_traces.py` on the packaged files | see package listing |
| `checker-result.json` | Output of the repository's offline checker on the independent trace; first produced 2026-11-04, re-produced as pure JSON by `run-checker.mjs` on 2026-11-07 with identical values | `230e8cf8d12355118b654c9d054b7feb9fbb239727454fa70b815c388a659cec` |
| `run-checker.mjs` | Driver that re-runs the repository's offline checker against a trace | see package listing |
| `REPRODUCTION_RECEIPT.md` | Receipt: commit, environment, hashes, unconfirmed items, with dated corrections appended | `a15010c1a052508546d77cbe84645b0dfd69aa749face5a5512e249a25751137` |

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

Exit code 0 means every deterministic check MATCHes and every difference
falls inside the enforced bounds: the RPC method sets must be identical
and all non-receipt counts equal; a receipt-poll difference is accepted
only when it equals the difference in null receipt polls and every
null-polled transaction has an eventual receipt; transaction-hash
differences are accepted only for the bounded set of signed-submission
cases; and the retained summary's `capture_sha256` must equal the
retained trace file's SHA-256. Since the 2026-11-11 round (see
Corrections below) the bounds are tighter: receipt status and gasUsed
are read from the flat receipt objects — status must be identical for
all 208 transactions, and gasUsed may differ only on the
signed-submission transactions (the actual differences are enumerated
in `comparison-result.json`); non-poll RPC requests are compared by
content (label, method, params, result, with transaction hashes
normalized to labels), not by counts alone; every receipt poll must
follow its transaction's send and every null poll must precede that
transaction's final receipt; and each differing independent
transaction hash must equal the value recorded for this pinned
evidence pair in the script. `test_compare_traces.py` exercises the
genuine pair plus 11 tampered variants that must all be rejected.
Adding
`--experiment-dir <clone>/experiments/paid-adversarial` additionally
verifies the 16 input files on disk against the manifest hashes.
`comparison-result.json` in this package was produced by exactly the
command above (without `--experiment-dir`).

## Verification scope

Checked and MATCHing: all 72 case PASS/FAIL flags; case labels, expected
outcomes and before/after snapshots; the 47 rejections and their state
invariance (before == after); the 11 successful posts; the status of all
208 receipts, and their gasUsed except for the 9 differences listed
below; the final 40-slot snapshot (credits
150000000000000000000007, vault 150000000000000000000018, dust 11); the
16-entry input manifest; the Anvil/chain node configuration.

Classified as EXPECTED_DIFFERENCE (nondeterministic, individually
explained, not ignored): 25/72 transaction hashes (signed content depends
on block timestamps); receipt gasUsed on 9 of those signed-submission
transactions (small differences, e.g. 0x2aec5 vs 0x2aed1; all 9 occur on
transactions whose hashes also differ, and are enumerated with both
values in `comparison-result.json`; no cause for the gas differences is
asserted); RPC calls 983 vs 970 — exactly 13 extra
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

## Corrections — 2026-11-07

Applied after the PR #16 review; the original wording is recorded here
rather than silently rewritten.

- This README originally stated: "Status: local evidence package.
  Nothing in it has been posted to GitHub." That was true while the
  package was local. The package was submitted as PR #16 on
  2026-11-07, and the status line above now says so.
- The original text said the offline verification "establishes" a
  different-machine/OS reproduction. Corrected above: the environment
  is the reproducer's reported environment (see the receipt); the
  offline checks establish trace consistency only.
- Original-file equality was listed as unconfirmed in the receipt.
  On 2026-11-07 the reproducer confirmed the Windows original's
  SHA-256 by PowerShell; it matches the packaged file exactly.
- Checker-output dates: first produced 2026-11-04 (console capture);
  the packaged pure-JSON output was produced by `run-checker.mjs` on
  2026-11-07 with identical values.
- `compare_traces.py` acceptance rules were tightened on 2026-11-07
  (bounded RPC and transaction-hash exceptions; `capture_sha256` as an
  acceptance condition). Both negative controls from the PR #16 review —
  an appended `eth_unexpected` call and a zeroed `capture_sha256` —
  are now rejected, and the unmodified pair still passes.
- The exact-command limitation is unchanged.

## Corrections — 2026-11-11

Applied after an independent review (R-01 HOLD, comparator only) of the
pushed comparison at PR #16 head `23934eb`. The reproduction itself —
72 cases, 208 transactions, snapshots, receipt statuses — is unaffected.

- **The round-1 receipt claim was vacuous.** The comparison updated on
  2026-11-07 read receipt status/gasUsed from a nested
  `receipt["result"]` field. Both traces record FLAT receipt objects
  (status and gasUsed are top-level), so every pair compared as
  (None, None) and `comparison-result.json` reported "receipt
  (status, gasUsed) pairs identical: True" without examining any value.
  Corrected by reading the flat fields: receipt status is identical
  for all 208 transactions; gasUsed differs on exactly 9
  signed-submission transactions (enumerated with both values in
  `comparison-result.json`), now classified EXPECTED_DIFFERENCE inside
  the bounded set instead of being reported as identical.
- **RPC identity and poll ordering.** Method counts alone let a
  required call be replaced by an unrelated call of the same method,
  and let detached receipt polls pass. The comparison now checks call
  content (with bounded exemptions for the signed-submission helper
  calls whose calldata commits to the block timestamp), requires every
  receipt poll to follow its transaction's send, and requires null
  polls to precede the final receipt.
- **Pinned-pair hash values.** The bounded hash exception named which
  transactions may differ but not which values they must take, so a
  consistently rewritten hash passed. The expected independent values
  for the 28 differing transactions are now recorded in
  `compare_traces.py` for this pinned pair only; they are not a
  general acceptance rule for future runs.
- `test_compare_traces.py` (added to the PR on 2026-11-11) now covers
  12 scenarios: the genuine pair plus 11 rejection cases, including
  each mutation class above.
