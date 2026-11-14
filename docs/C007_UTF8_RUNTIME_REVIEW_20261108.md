# Integrated synthetic action: UTF-8 runtime review

2026-11-08. Continues the locally sealed C-007 integrated contract at source SHA-256
`ac956a70048e02177c74f78ad4a1244476c095d48fbd38e9d114592cbad55e69`.
This is independent community research, not adopted economics or a deployable protocol.

The supplied Solidity source and compiled runtime are unchanged. The new runner
executes the strict UTF-8 validator inside the signed fixed-pool settlement call.
It requires 1–420 Unicode scalar values and at most 1,680 bytes, without normalization.
Whitespace and embedded NUL remain accepted. These are provisional choices under
[C-004](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/8).

## Verified execution

Separate focused groups ran internally on Node v20.20.2 with EthereumJS 10.1.3 and
explicit Shanghai rules. They are not a repository-wide test run or another WSL run.

| Group | Outcome |
| --- | --- |
| Signed settlement | 18 expected outcomes, 2 successes and 16 rejections |
| Reward withdrawals | 10 expected outcomes, 2 successes and 8 rejections |
| Signed time windows | 10 expected outcomes, 3 successes and 7 rejections |
| Prior exact-text cases | 9 expected outcomes, 4 successes and 5 rejections |
| Strict UTF-8 boundary vectors | 22 expected outcomes, 11 successes and 11 rejections |

The two intentional text changes reject previously accepted empty and malformed
UTF-8. The other seven text outcomes and all 18/10/10 prior regression records
match the retained results except gas. Accepted event payloads reproduce the exact
submitted bytes. Rejections preserve observed state and emit no logs. The separate
Python audit checks strict decoding, byte/scalar bounds, event byte payloads,
nonce/credit/dust changes and complete observed before/after snapshots.

The original 22 oracle inputs include 419/420/421 ASCII, 420/421 four-byte scalars,
NFC/NFD examples, whitespace, NUL, invalid leads, overlong encodings, surrogates,
out-of-range code points, truncation and invalid continuation bytes. They are
finite cases, not exhaustive Unicode or arbitrary-input coverage.

A separately compiled control removes only `_validateUtf8Text(text);`. The runner
then fails at `signed_empty` because the call succeeds instead of reverting.
That expected failure is retained; it is not an additional passing settlement case.
Recompiling the unmodified source with solc 0.8.30 reproduces the entire supplied
compiler-output JSON object, not just its runtime hash.

## Inputs and provenance

The user supplied a 38-file archive with SHA-256
`6b2927c833e6c1070846f5b532b4c3c3c9a8f8bd490720220480de856edf085f`.
Both original manifest identities and all 36 listed artifacts matched. Archive
integrity does not independently authenticate the original machine or build origin.
The two original lanes remain unchanged:

- Text-byte EVM V2 manifest `89fd5c6ca4352d51586b519baec4376b2db252f487708e283c63fd3a894e3539`.
- UTF-8 compile V1 manifest `7c05dbdb15d10d49f75f0464cd3d90c93194b9240d0bdfaf813a5900c9fc944f`.

The transfer did not include the original fixture/window/text input JSON files.
New, explicitly derived inputs use the retained initial snapshots and case fields.
Fee shares were independently recalculated with integer arithmetic and checked
against retained after-states. These are new derived fixtures, not recovered
byte-identical original inputs. Wrong-signer selection uses the retained case label
and the original runner's public synthetic key 2. No real wallet key is used.

The published historical result retains its old `signedTextPublished:false` field
and obsolete scope labels unchanged. Those fields lag the text-event implementation;
they are historical metadata, not the new verdict. The new result records true for
text publication only within this synthetic EVM scope. Similarly, stale comments
in the unchanged Solidity source saying there is no settlement describe earlier
increments. This document supersedes those descriptions without altering sealed bytes.

[Artifact inventory](../evidence/c007-utf8-runtime-20261108/provenance.json) identifies
copied versus derived source, inputs, output and logs. Local absolute paths are not
needed for public reproduction. Raw negative-control logs stay in the internal lane;
the published derivative replaces only the scratch directory prefix.

## Reproduce

From the repository root, choose an unused output directory:

```sh
npm ci --prefix experiments/c007-utf8 --ignore-scripts --no-audit --no-fund
node --max-old-space-size=512 experiments/c007-utf8/run.mjs \
  experiments/c007-utf8 \
  experiments/c007-utf8/fixtures/derived-fixtures.json \
  NEW_UTF8_OUTPUT \
  experiments/c007-utf8/fixtures/derived-window.json \
  experiments/c007-utf8/fixtures/derived-text.json \
  experiments/c007-utf8/fixtures/utf8_vectors.json
python3 experiments/c007-utf8/audit.py \
  evidence/c007-utf8-runtime-20261108/retained-text-results.json \
  NEW_UTF8_OUTPUT/results.json \
  experiments/c007-utf8/fixtures/utf8_vectors.json
```

Use Node v20.20.2. The recorded execution applied a 512 MiB Node heap cap,
60 CPU seconds, 90 wall seconds, and disk/memory preflight checks. The shell command
above does not install the outer CPU/wall limits. Dependencies reuse the matching
isolated lock. Compiler/runtime identity and the derivation script are retained.
Original source/documents use MIT; unmodified dependencies retain their own licenses.

`compile-control.mjs experiments/c007-utf8 NEW_CONTROL` checks an exact compiler
rebuild and creates the deliberately weakened compile profile. Passing NEW_CONTROL
as the first runner argument must fail at signed_empty. Never publish or use that
mutated runtime as the candidate.

## Limits and next engineering gate

This harness injects owners, balances, credits and the root into storage, installs
runtime code directly, and mints a synthetic token. Local signed intent verification
is exercised; signed Ethereum transactions and contract deployment are not. The
chain ID of 1 is a local EVM setting, not evidence of mainnet execution. No NFT
admission, independent root initialization or real CAW integration is established.
The contract contains a test-only injected-revert argument. Only three fixed accounts
participate, exact-floor multiplication can overflow at larger values, and no
scalable economic rule or withdrawal-liveness guarantee is adopted.

Next test the same runtime from explicitly initialized empty custody through actual
mock-token approvals/deposits, backed stake updates and signed settlement/withdrawal,
retaining root derivation and complete rollback evidence. Keep fixture-only account
admission explicit. Separately resolve registration, economic policy, scalable
accounting, cancellation and independent history/recovery gates. Do not treat this
UTF-8 result as completion of the accepted one-action milestone. No CI, public
network transaction, full-suite rerun or production acceptance occurred.
