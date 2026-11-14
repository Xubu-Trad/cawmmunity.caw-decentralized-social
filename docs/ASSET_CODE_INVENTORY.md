# Asset code inventory — review aid, not asset approval

FACT — C-001 in sources/SPEC_CONFLICTS.md remains open. It requires original deployment/current bytecode evidence, transfer/burn behavior, source matching and an explicit resolution of incompatible requirements. No real token is selected or certified by this change.

The offline inventory binds supplied code to an independently supplied expected chain ID, block number/hash, address and Keccak code hash. It rejects malformed or mismatched inputs and code larger than 1 MiB. A legacy linear scan skips PUSH data and flags CALL, CALLCODE, DELEGATECALL, STATICCALL and SELFDESTRUCT. Delegation designators identify a target; other EF-prefixed formats are marked unsupported. Truncated PUSH data is flagged. These are inspection clues, not executable-path or proxy proofs. Metadata and unreachable bytes may produce false positives. No flags does not prove no external authority.

Every output is REVIEW_REQUIRED with productionAccepted=false. A matching caller-supplied hash is not authenticated chain state. The tool does not verify account proofs, canonicality, compiler output, proxy storage, target code, token semantics, upgrade authority or economic backing. Never label its output a completed token audit.

## Reproduce

Use the existing pinned ethers 6.16.0 environment from the signed-history experiments (no new install was tested). Run `node --max-old-space-size=256 test.mjs`. For an inventory run `node inventory.mjs record.json expected.json`. Both JSON inputs require string chainId/blockNumber, full hex blockHash/address/codeHash; record additionally requires hex code. The expected context must come from a separately reviewed source, not be copied from an untrusted provider and described as independent verification.

21 synthetic checks cover context mismatches, malformed/empty/hash-mismatched/oversized code, embedded opcode bytes in PUSH data, external-call flags, truncated PUSH and delegation/unsupported formats. The first local test run failed because its selected dependency directory lacked ethers; that run is retained, and the corrected pinned-dependency run passed. No chain access or real-asset review occurred.

## Next evidence gate

Acquire a justified asset address and pinned block through the existing verified readers; authenticate the account/code hash; reproduce source-to-bytecode matching; resolve proxy/delegation/external targets and controlling storage at that same block. Review current and future modification paths, and reproduce actual transfer/burn behavior. Record provenance, disagreement and missing evidence. Immutable vault token selection does not make a mutable token immutable. No developer rescue key is proposed. Historical C-001 conflicts remain unresolved; README updates remain paused.
