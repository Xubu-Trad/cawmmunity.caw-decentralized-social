# Chrono review package: preserved fresh Geth replay

This package supplies the generated capture.json and evidence.json requested for the successful local replay described in REPRODUCTION_SETUP.md. Their bytes match the original run's retained provenance. Original generated JSON is unchanged. It is a historical evidence package, not a new EVM run or an independent execution claim.

## Exact source identities

- Fixture/input source: ef2adad6cc5cf30feb8de7dbace5e4849f92b7f3. The three included input files were byte-compared with this commit.
- Capture script and proof-reader first publication: bc1f3f2358b069c58add92a95b2564568acfd761. The included capture-public-wallet.py and verify-fresh-wallet.mjs match that publication.
- Later host-disk-guard addition: d0e5e370875d71973cef14efcf86690cf2b7abc3. That guard-only revision was not the historical executed capture script.
- Original reviewer target: 1a162a4a50c0d51312c3943a5f222780c421d140 remains separate. This package does not move T1/T2 to PASS.

The capture was prepared locally before its first publication. There is no honest single clean-checkout commit to assign retrospectively to the whole run. Source pins, script hashes and recorded input/output hashes identify its components. The record does not establish a complete original source compilation/signing or client-binary rebuild.

## Files and verification

capture.json contains genesis plus21 transaction blocks. evidence.json contains the final header and16 registry storage fields. genesis.json, result.json and service.json are original outputs. input-* files are the previously published replay inputs, not newly generated data. fresh-capture.log and fresh-proof.log are the retained command output. init.log and node.log are the execution logs with personal absolute paths replaced by <LOCAL_PATH>; log-redactions.json gives original and public hashes. ORIGINAL_PROVENANCE.txt describes the original run, including hashes of unredacted logs retained privately. Use SHA256SUMS for this public package's actual bytes.

The generic Geth startup banner mentions Ethereum mainnet. It is not evidence of mainnet execution: this run used the local developer configuration, chain31337, zero peers and disabled discovery. No real assets or public deployment were used.

**Historical numeric shell exit codes were not retained in the available records.** RUN_IDENTITY.json marks them null. Successful output and the stopped-service record are present, but neither is relabelled as a recorded shell exit0. The commands below are portable reconstructed commands, not an exact shell-session transcript.

New checks performed while preparing this package have explicit recorded exits. The combined capture checker reports INCOMPLETE and exits2: all22 headers,21 retained signed-input identities/state-root comparisons and16 registry fields match;19 transactions pass the strict commitment/sender readers. Blocks8/9 contain33230/33231-byte transactions beyond the unchanged reader limit. This previously documented boundary remains open; no full-history PASS is asserted. Eight corruption controls pass their rejection expectations (test-process exit0). These are artifact checks, not execution replay.

## Reproduce the original procedure

Use a checkout at bc1f3f2358b069c58add92a95b2564568acfd761 only to inspect the historical capture version. For new execution use the later guarded script at d0e5e370875d71973cef14efcf86690cf2b7abc3 or its unchanged descendant, and record that tool commit separately. Use the pinned Geth executable and a new output directory. Keep all guards intact.

```sh
python3 integration/core-baseline-v1/capture-public-wallet.py --geth /absolute/path/to/verified/geth --capture evidence/chrono-replay-20261113/input-capture.json --genesis evidence/chrono-replay-20261113/input-genesis.json --expected evidence/chrono-replay-20261113/input-expected-storage.json --output /absolute/path/to/new-output
node integration/core-baseline-v1/verify-fresh-wallet.mjs /absolute/path/to/new-output/evidence.json evidence/chrono-replay-20261113/input-expected-storage.json
```

Record each exit code immediately and retain both stdout and stderr. The documented environment is Linux Python3, Node20.20.2/npm10.8.2 and the pinned Geth bytes. A new run can have different header hashes because of timestamps; do not change the preserved evidence to match it.

## Inspect this package without starting a node

From a checkout containing the new combined verifier:

```sh
cd evidence/chrono-replay-20261113
sha256sum -c SHA256SUMS
cd ../..
node integration/core-baseline-v1/verify-wallet-capture.mjs evidence/chrono-replay-20261113/capture.json evidence/chrono-replay-20261113/input-capture.json evidence/chrono-replay-20261113/evidence.json evidence/chrono-replay-20261113/input-expected-storage.json
```

Expected combined-checker exit:2 (INCOMPLETE), not0. The artifact endpoint is selected from the retained local run, not authenticated by public consensus. Matching the package's hashes establishes byte identity relative to this manifest, not its publisher's trustworthiness or protocol safety. Full strict transaction acceptance, independent execution, public finality and production readiness remain separate gates.
