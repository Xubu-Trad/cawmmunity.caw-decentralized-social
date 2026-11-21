# Signing primitives: external SSZ conformance

FACT — Five ForkData and five SigningData root cases from ethereum/consensus-spec-tests match exactly. Source commit: `bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908`, paths `tests/mainnet/phase0/ssz_static/{ForkData,SigningData}/ssz_random/case_0` through `case_4`. Each original value.yaml and roots.yaml is retained with its SHA-256/size in the inventory and the repository's unchanged MIT notice. Commit pinning and hashes establish retained byte identity, not independent release-signature or generator-build verification.

The helper now exposes deriveForkDataRoot and deriveSigningRoot, and the existing deriveSigningContext composes those same primitives. The latter accepts an already-derived object root. This refactor permits comparison against official SigningData vectors with arbitrary domains without pretending to recover a matching fork/genesis preimage.

Execution on Node v20.20.2: ten official root matches, ten single-input mutation controls and six malformed-argument controls; separately all16 earlier authored regression checks passed. Tests verify each retained YAML file hash/size, require exact simple field layouts and compare against the published root rather than deriving the expected value from our implementation. The tests do not install packages or alter BLS/fork readers. Existing2GiBdisk/1GiBmemory startup limits,256MiBheap and30second process deadlines retained. Full suite and declared-runtime tests were not run.

## Exact conformance boundary

These are external tests of the ForkData and SigningData SSZ roots. They are not external end-to-end compute_domain vectors, sync-committee signature/update vectors, or live-network validation. The domain prefix/truncation composition still has the authored comparisons and reviewed specification definition. Participant membership/possession, fork scheduling, checkpoint provenance, object-root derivation, signature verification and finality remain independent gates. No application accepts an update as a result of this experiment.

## Reproduce

Run `node --max-old-space-size=256 experiments/signing-domain/test-external-signing.mjs evidence/signing-domain-external-20261108`, then `node --max-old-space-size=256 experiments/signing-domain/test-signing-domain.mjs experiments/signing-domain/vectors.json`. No package installation is needed. Preserve new run outputs separately.

Next: obtain a corresponding external consensus signature/signing-root case with explicitly evidenced fork, genesis, object and domain inputs before connecting the aggregate-signature experiment. Do not substitute a caller's assertion of trusted membership or a passing aggregate equation for enrollment/authentication evidence. Token proof remains blocked separately. README edits remain paused.
