# Offline review of a recovery proof

A reviewer can now recheck saved `execution/evidence.json` using the existing pinned strict reader without starting blockchain clients or trusting `runner-result.json`. The command verifies the 17-file experiment manifest, snapshots the received JSON, invokes the existing Node reader, and optionally compares its computed proof result with the supplied runner summary. A misleading summary cannot replace cryptographic proof checking.

```text
python3 integration/peer-sync/verify-recovery-proof.py --source PINNED_SOURCE_DIRECTORY --evidence SAVED_EVIDENCE_JSON --summary SAVED_RUNNER_RESULT_JSON --output NEW_REVIEW_DIRECTORY
```

Use the trusted verifier scripts and Node executable, plus the source acquired through [the refreshed package](REFRESHED_RECOVERY_PACKAGE.md). The downloaded preflight module is trusted executable code, not untrusted input. Do not substitute a module supplied by an untrusted evidence submitter. The received evidence is treated as data. The tool makes no network calls or client-start requests itself; this is not an operating-system sandbox for the trusted Node executable.

The output includes the evidence byte hash and size, manifest fingerprint and freshly computed proof result. Existing output is refused; failed checks do not write a successful verification record. This checks the synthetic selected header and its storage proofs. It does not authenticate the operator, prove the claimed interruption or 29-header peer transfer, establish a separate host, or verify public-chain finality. The summary comparison covers only its proof subsection.

Six targeted cases passed against the retained refreshed-run evidence: genuine proof accepted; changed header, missing account proof, false summary, changed reader and existing output rejected. The original evidence was not modified. No new client execution or independent-operator result is claimed.

Reproduce the controls with:

```text
python3 integration/peer-sync/test-offline-recovery-proof.py PINNED_SOURCE_DIRECTORY SAVED_EVIDENCE_JSON SAVED_RUNNER_RESULT_JSON NEW_TEST_OUTPUT_DIRECTORY
```

Independent full recovery still requires another operator's run and review of its process evidence. This optional review tool does not change the frozen execution package or silently repin it.
