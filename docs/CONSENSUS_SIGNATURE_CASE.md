# Official minimal Capella signature case

FACT — The first update in the official `advance_finality_without_sync_committee` case verifies against the supplied bootstrap committee and our derived signing context. Source: ethereum/consensus-spec-tests commit `bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908`, `tests/minimal/capella/light_client/sync/pyspec_tests/advance_finality_without_sync_committee`. Original metadata/config/steps and lossless hex of the compressed update are retained with the MIT notice. The corresponding bootstrap is already retained in evidence/consensus-capella-bootstrap.

The bounded retained Snappy decoder expands the update to3676bytes. The minimal32-member layout has attested-header offset2052, finalized-header offset at1748, participation bytes1944–1947, signature bytes1948–2043, signature slot bytes2044–2051. The extracted attested BeaconBlockHeader SSZ root matches the external steps.yaml expectation `0xe7c1b621e495c3987e97fd40456b2dd8e233e37b5ef487d48d3f44665d783ccf`. Attested slot40 and signature slot41 select the fixture's Capella-at-epoch0 version `0x03000001`. This is an explicit single-fixture assumption, not a general fork-schedule implementation. All32 participation bits are set; no partial-bit ordering conformance is established here.

The fixture genesis root and DOMAIN_SYNC_COMMITTEE `0x07000000` produce signing root `0x00523ff78738757a35831bebf0620aa2f9f7a6ceb8938d9466c7ac3a2fb94f1b`. The unchanged aggregate adapter verifies the supplied signature under those32 keys. Five controls reject a changed domain type, fork version, genesis root, message root, or omitted participant. The derived signing root is ours; the independently supplied signature is the external check, not a separately published expected signing-root constant.

## Trust boundary

This is a fixture equation with a corresponding consensus domain, not authenticated live membership or a complete light-client update verifier. This run does not recheck committee inclusion, finality/execution branches, period transitions, enrollment/possession, checkpoint provenance, freshness or current network identity. No update is accepted by the application. The compensating-key boundary in BLS_POP_AGGREGATE_20261108.md remains. The nested domain result retains signatureVerified=false because derivation alone verifies no signature; the outer result separately reports the fixture equation.

Used locked @noble/curves1.9.7 and @noble/hashes1.8.0, installed with lifecycle scripts disabled. Resource gates2GiBdisk/1GiBmemory,256MiBheap,45second check deadline. No full-suite or prior BLS regression rerun is claimed. Raw source licensing/provenance does not prove independent generator-build or release-signature verification.

## Reproduce

Install the existing isolated experiments/bls-g1 lock with scripts disabled. Run `node --max-old-space-size=256 experiments/bls-g1/check-consensus-signature.mjs evidence/consensus-signature-20261108/case.json`. This repeats the equation/negative checks on the extracted case; independently rederive the case from the preserved compressed bytes and bootstrap before claiming an independent extraction. The historical bounded extraction script and provenance remain in the private workflow.

Next: make extraction independently replayable in the repository with malformed-layout and partial-participation cases, then compose committee inclusion and explicit fork/period selection. Preserve the difference between fixture selection and independently justified checkpoint trust. README unchanged; token-proof acquisition remains blocked separately.
