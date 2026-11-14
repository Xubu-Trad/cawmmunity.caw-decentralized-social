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

## Helper verification before execution

The offline verifier now checks the preflight helper against SHA-256 `69eea5fbe832aeb6fa8c2a69ac381a4ecb78549ae4189e2e1b43add2e713235f`, corroborated against published setup commit `dbf8c39b798b1a37fa886b7b492d3e90d43c4fce`, before executing it. It executes the verified in-memory snapshot, avoiding a second file read between this check and helper execution. Previously the source directory was explicitly trusted; this adds a check for accidental or hostile helper substitution rather than relaxing that trust requirement.

All eight controls pass: the original six plus changed-helper and missing-helper rejection. The changed helper contains a harmless marker-file operation; the test confirms that operation never executes and no review output directory is created. No client services were launched. The top-level verifier and Node executable still require explicit trust. This does not protect against a compromised runtime or all concurrent source-file changes; use a trusted immutable source directory. The frozen 20-file client execution package is unchanged.
