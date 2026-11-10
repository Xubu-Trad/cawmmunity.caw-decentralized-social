# Reproduction receipt — Issue #2 alpha.21 adversarial regression (independent run)

Prepared 2026-11-04. Local document only; nothing has been posted to GitHub.

## Environment and source (confirmed)

- Repository: Xubu-Trad/cawmmunity.caw-decentralized-social
- Full source commit: `85627137cda2e79390f57dc6e05c7ceb7809e049` (confirmed on GitHub)
- Baseline contract commit (unchanged alpha.20): `91479b6dc8c9a264411d75177d43029e0266c354`
- OS: Windows 11; Python 3.12.10; cryptography 50.0.1
- Anvil 1.8.1, official Windows binary, matching the repo pin:
  size 41,583,616 bytes, SHA-256 `c6e29da1b010fe00bac6c0dc5c29484bd641deb5a84050aea10d13e9dc4fe26f`
- Run time recorded inside the trace: 2026-11-03T15:14:44.909572+00:00; complete = true, failure = null

## Command

The exact command line as typed was not recorded. The run was executed with the
runner's required form (reconstruction — argument values below are the confirmed
ones; working directory, launcher name and folder paths are NOT confirmed):

```
python experiments\paid-adversarial\run_paid_adversarial.py --anvil <path to pinned anvil.exe> --output <fresh output file> --expected-input-sha256 2637376a27b2a175d1995e98ff71c026f9925dff8a01729943b9f62bd9056bde
```

## Files and SHA-256 (existing files only)

- Independent trace (uploaded copy `independent-run.json`):
  `e9cf0f605958a78b79fb0f9fba46e145c88d8ce62a25caa87e1c669e9506e9da`
- Retained trace (`experiments/paid-adversarial/execution-trace.json` at the commit above):
  `5b639707c113b23fa7025a85c098693a6be3431781f175cf1f13b22d1b22b2dc`
- Retained summary (`experiments/paid-adversarial/execution-summary.json`):
  `1946ebb82978eb424086dcb81dc969dd62ad0e76108e06f2880396fb86ad30a9`
- Inputs manifest (`experiments/paid-adversarial/experiment-inputs.json`):
  `2637376a27b2a175d1995e98ff71c026f9925dff8a01729943b9f62bd9056bde`
- Offline checker output for the independent trace (`checker-result.json`, this folder;
  pure JSON since 2026-11-07, values unchanged from the original console capture):
  `230e8cf8d12355118b654c9d054b7feb9fbb239727454fa70b815c388a659cec`

No independent summary file existed before this receipt; the comparison was
previously reported in chat only. No hash is stated for any file that does not exist.

## Comparison outcome (verified 2026-11-04)

- 72/72 cases pass in the independent trace; case labels, expected outcomes and
  before/after snapshots match the retained trace exactly (transaction hashes excepted).
- 47 rejections, all with before == after (state unchanged).
- 11 successful paid posts.
- Final 40-slot snapshot exactly equal: credits 150000000000000000000007,
  vault 150000000000000000000018, dust 11.
- All 208 receipts match on status and gasUsed; inputs manifest identical.
- The repo's offline checker (`validateEvidence`) passes on the independent trace.
- Nondeterministic differences only: 25/72 transaction hashes differ (signed
  content depends on block timestamps); RPC calls 983 vs 970 (+13
  eth_getTransactionReceipt — first poll returned null for 13 transactions in
  the independent run, 0 in the retained run; final receipts identical);
  timestamps and performance counters differ; the trace-file hash therefore
  differs, which is expected because the retained capture hash is the hash of
  the retained trace file itself.

## Unconfirmed

- The exact command line as typed (see above).
- Whether the uploaded `independent-run.json` is byte-identical to the original
  output file on the Windows PC (only the uploaded copy was hashed here; the
  user can confirm with `Get-FileHash -Algorithm SHA256 <original file>`).
- Whether the author treats file-hash equality as a reproduction criterion.

## Corrections — 2026-11-07

The sections above are the original receipt of 2026-11-04 and are kept
unchanged. The following corrections apply:

- **Status.** The receipt was prepared as a local document. The evidence
  package containing it was submitted to GitHub as pull request #16 of
  Xubu-Trad/cawmmunity.caw-decentralized-social on 2026-11-07.
- **Original-file equality (was: unconfirmed).** On 2026-11-07 the
  reproducer confirmed with PowerShell `Get-FileHash -Algorithm SHA256`
  that the original output file on the Windows PC has SHA-256
  `e9cf0f605958a78b79fb0f9fba46e145c88d8ce62a25caa87e1c669e9506e9da`,
  identical to the packaged `independent-run.json`. The packaged copy is
  therefore byte-identical to the Windows original.
- **Environment attribution.** The environment above (Windows 11,
  Python 3.12.10, cryptography 50.0.1, the pinned Anvil binary) is the
  reproducer's reported environment. The offline checker and the
  comparison verify consistency of the recorded traces; they do not by
  themselves authenticate the machine or operating system used.
- **Checker output provenance.** The checker output was first produced
  on 2026-11-04 as a console capture. On 2026-11-07 it was re-produced
  as pure JSON with `run-checker.mjs` (values verified identical to the
  original capture); the packaged `checker-result.json` is that
  2026-11-07 output, SHA-256
  `230e8cf8d12355118b654c9d054b7feb9fbb239727454fa70b815c388a659cec`.
- **Comparison acceptance rules.** On 2026-11-07, following the PR #16
  review, `compare_traces.py` was tightened: unexpected RPC methods or
  counts now fail; extra receipt polls are accepted only when fully
  explained by null polls whose transactions have eventual receipts;
  transaction-hash differences are accepted only for the bounded set of
  signed-submission cases; and the retained summary's `capture_sha256`
  must equal the retained trace file's SHA-256. Both negative controls
  from the review (an appended `eth_unexpected` call; a zeroed
  `capture_sha256`) now fail, and the unmodified pair still passes.
- The exact-command limitation above is unchanged: the command line as
  typed was not recorded.
