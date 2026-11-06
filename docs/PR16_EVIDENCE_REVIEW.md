# PR #16 independent evidence review

Reviewed [WD-27's PR #16](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/16) at `e3748350c6b6e8865bb3d3252ef3060649f3d4bc`. **Changes requested; not merged.** The submitted original trace passes our existing offline consistency checker, but the added comparison script has two reproduced acceptance gaps.

## Verified here

- Independent trace SHA-256 matches `e9cf0f605958a78b79fb0f9fba46e145c88d8ce62a25caa87e1c669e9506e9da`.
- The retained trace, summary and input-manifest copies are byte-identical to source commit `85627137cda2e79390f57dc6e05c7ceb7809e049`. All sixteen input file hashes match our retained files.
- Our checker is unchanged from that pinned commit. Its locally executed output exactly matches `checker-result.json`: 72 cases, 47 rejections, 11 successful posts and 208 transactions. A deliberately changed state snapshot rejects.
- The inspected comparison script passes the unmodified submitted pair with input-file checking enabled.

No contract or third-party runner was executed. The comparison script was inspected before running in the existing resource guard. The Node checker and Python comparison are offline checks of supplied bytes. They cannot independently prove who generated them, the machine used, or the exact command that was typed.

## Required corrections

1. **Unexpected RPC differences still pass.** Append one local-call record with label `unexplained`, request method `eth_unexpected`, and response result null to a copy of the independent trace. The comparison exits 0 and reports PASS. Its RPC classification is unconditional rather than an enforced allowlist. It should reject unexplained method/request differences and specifically validate any allowed extra null receipt polls against the relevant requests and eventual receipts. Transaction-hash differences also need bounded justification, not an unconditional expected-difference label.
2. **Incorrect retained capture hash still passes.** Change only `capture_sha256` in a copy of the retained summary to 64 zeros. The script prints that consistency is false but still exits 0/PASS. Make the byte-hash equality an acceptance condition. Add permanent rejection tests for both cases.
3. **Publication/provenance wording needs reconciliation.** README and receipt still say nothing was posted to GitHub. README says offline verification establishes a different-machine/OS reproduction; it establishes consistency with the submitted receipt, not independent authentication of that environment. PR body says original-file equality was confirmed, while the receipt lists it as unconfirmed. Preserve the original receipt if historical, but add a clear dated correction and distinguish reported facts from checks performed here. Also reconcile the future-dated checker-output note against the actual revision history rather than silently changing provenance.

These findings do not invalidate the submitted trace's successful offline check or allege a fabricated run. They concern claims and acceptance conditions in the review package. Please amend the same PR so attribution, evidence and review stay together. Issue #2 remains open.

[Machine-readable results](../evidence/PR16_REVIEW.json). The two mutated copies are negative controls only; the original files were not modified. Full suite and EVM were not rerun. Public-test and production gates remain blocked; hosted CI remains deferred.
