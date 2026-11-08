# Signing-domain derivation — bounded research checks

Status: 16 authored checks passed after cleanup restored the existing disk minimum. The earlier pre-start disk rejection remains in the pending evidence record; it is not a failed algorithm test.

This independent roadmap lane follows BLS_POP_AGGREGATE_20261108.md. It derives ForkData root, the32-byte domain and SigningData root from four explicit fixed-length hex inputs. No default network/fork, automatic fork schedule, signing operation, participant admission or checkpoint update is introduced. Existing fork fixture and BLS modules are unchanged. The input objectRoot is already a root; the helper does not hash an arbitrary SSZ object into that root.

Definitions reviewed from [Ethereum consensus-specs](https://github.com/ethereum/consensus-specs/blob/b5c3b619887c7850a8c1d3540b471092be73ad84/specs/phase0/beacon-chain.md#compute_domain), pinned commit `b5c3b619887c7850a8c1d3540b471092be73ad84` (v1.5.0). Domain type is concatenated with the first28bytes of ForkData root; SigningData consists of object root and domain. This domain is distinct from the BLS POP hash-to-curve ciphersuite tag. Reproducing the arithmetic cannot authenticate the supplied fork/genesis/committee or establish finality.

Executed validation: four authored Python hashlib comparison cases, four single-input mutations and eight malformed-length/type/argument cases, 16 total. These are authored comparisons, not external consensus conformance vectors. External corresponding vectors, declared-runtime execution, regression review and integration remain pending. All trust/acceptance fields remain false. Nothing is wired into production or recovery acceptance.

Next: acquire independent external conformance evidence before signature composition. Token account proof remains separately blocked by provider HTTP failures. README unchanged.


## Reproduce this bounded check

Run `node --max-old-space-size=256 experiments/signing-domain/test-signing-domain.mjs experiments/signing-domain/vectors.json`. No third-party package installation is needed. The run used v20.20.2, a 30-second process deadline, 2GiB free-disk and 1GiB available-memory startup gates. No full-suite, BLS regression or declared-runtime result is claimed. The exact helper/test bytes match the prior staged commit. Existing BLS and fork readers were not changed.


## External primitive follow-up

[Ten official ForkData/SigningData root matches](SIGNING_DOMAIN_EXTERNAL_CONFORMANCE.md),16negativecontrols and16authoredregressions now pass. This closes the scoped primitive-vector step, not an end-to-end consensus-domain or checkpoint gate.
