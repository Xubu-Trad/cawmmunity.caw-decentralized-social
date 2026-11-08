# Signing-domain derivation — untested research

Status: implementation staged; execution pending. The resource guard stopped before tests at approximately1.99GiB free disk, below the existing2GiB minimum. No passing checks or generated reference vectors are claimed.

This independent roadmap lane follows BLS_POP_AGGREGATE_20261108.md. It derives ForkData root, the32-byte domain and SigningData root from four explicit fixed-length hex inputs. No default network/fork, automatic fork schedule, signing operation, participant admission or checkpoint update is introduced. Existing fork fixture and BLS modules are unchanged. The input objectRoot is already a root; the helper does not hash an arbitrary SSZ object into that root.

Definitions reviewed from [Ethereum consensus-specs](https://github.com/ethereum/consensus-specs/blob/b5c3b619887c7850a8c1d3540b471092be73ad84/specs/phase0/beacon-chain.md#compute_domain), pinned commit `b5c3b619887c7850a8c1d3540b471092be73ad84` (v1.5.0). Domain type is concatenated with the first28bytes of ForkData root; SigningData consists of object root and domain. This domain is distinct from the BLS POP hash-to-curve ciphersuite tag. Reproducing the arithmetic cannot authenticate the supplied fork/genesis/committee or establish finality.

Prepared validation: four authored Python hashlib comparison cases, four single-input mutations and malformed-length/type/argument cases. These are authored comparisons, not external consensus conformance vectors. External corresponding vectors, declared-runtime execution, regression review and integration remain pending. All trust/acceptance fields remain false. Nothing is wired into production or recovery acceptance.

Next: run the guarded experiment once resources meet the existing limits, retain exact logs and vectors with provenance, then acquire independent external conformance evidence before signature composition. Token account proof remains separately blocked by provider HTTP failures. README unchanged.
