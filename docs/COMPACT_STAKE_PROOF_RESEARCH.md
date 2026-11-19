# Compact stake-proof cost comparison

2026-11-08; parent `fb887e7e12f02f232690d2aa838855d62d3c03bd`.

**FACT:** [the comparison runner](../experiments/stake-commitment-evm/compact-run.mjs)
passed 31 isolated EVM calls: seven positive proofs through each of two Solidity
verifiers, plus seventeen compact-format rejection cases. The original verifier
is unchanged and its compiled runtime SHA-256 matches the preceding experiment.
No deployed transaction, contract storage update or settlement occurred.

## Proposed representation

The [compact verifier](../experiments/stake-commitment-evm/CompactStakeProofResearch.sol)
uses the same leaf, branch, sum and namespace-envelope hashes as the
[existing kernel](STAKE_COMMITMENT_RESEARCH.md). It changes the proof representation,
not the research root. This remains a proposal, not an accepted signed encoding.

A uint256 bitmap has bit h set exactly when the sibling at height h is explicitly
carried. Nodes are ordered by increasing height, starting at the leaf's parent.
Unset bits expand to the recursively hashed empty subtree at that height with sum
zero. The contract embeds the 256 default hashes in an 8,192-byte constant table.
The runner independently recomputes the table with Node SHA-256 and checks both
the generated vectors and Solidity source before compilation.

The array must contain exactly the bitmap's indicated nodes and at most 256 nodes.
Explicitly carrying a default `(hash, 0)` is rejected. A zero sum alone does not
mean empty: registered zero-stake accounts must remain distinguishable from absence.
All sums use checked uint256 arithmetic. No root is stored or authenticated.

The function takes a six-word static Query tuple, bitmap, and dynamic Node array.
For the ABI encoder used in the runner, calldata is `292 + 64 × explicitNodes`
bytes including the selector. Proof-level canonicality does not establish canonical
ABI byte encoding: trailing data or alternate ABI offsets are not ruled out by this
research verifier and must not be treated as an accepted signed message format.

## Measurements and tradeoff

**FACT:** solc 0.8.30, optimizer 200 runs, explicit Shanghai compiler/EVM targets,
Node v24.22.1. Each call starts with a fresh in-memory EVM and compiled runtime
installed directly. The same seven expanded proofs pass both verifiers. The Python
generator checks each proof with the retained kernel; the JS runner checks exact
compact-to-full expansion. These are same-author differential tests.

| Case | Full calldata | Compact calldata | Full execution gas | Compact execution gas | Full execution + calculated intrinsic | Compact execution + calculated intrinsic |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sparse, key 1 | 16,580 | 420 | 356,062 | 423,814 | 542,022 | 448,162 |
| Sparse, maximal key | 16,580 | 420 | 358,867 | 426,619 | 545,199 | 451,327 |
| Every sibling nondefault | 16,580 | 16,676 | 356,051 | 533,592 | 545,107 | 723,440 |
| Empty tree absence | 16,580 | 292 | 355,613 | 422,480 | 541,525 | 445,464 |

The sparse fixture has four registered accounts; the fully populated proof has
257 accounts, with key 0 and one account at each `1 << h`. This is an adversarially
chosen path, not a representative population estimate. The all-default case is
an empty tree. Five sparse cases include present zero, ordinary/high-bit/maximal
keys and absence. Complete rows are in [results](../evidence/compact-stake-proof-20261108/results.json).

Calculated intrinsic gas uses Shanghai's 21,000 plus 4 per zero calldata byte and
16 per nonzero byte. Adding it to execution is a comparison metric, **not** a
transaction receipt or a current-network fee estimate. Execution includes memory
allocation and SHA-256 precompiles. Contract runtime grows from 1,325 to 10,012 bytes;
both fit the tested 24,576-byte code-size bound, but deployment was not executed.
No storage/update/settlement cost is included.

**INFERENCE:** the compact representation reduces the sparse example's combined
metric by about 17%, despite increasing execution gas. When all siblings are
nondefault it increases the metric by about 33%. Therefore compact does not
dominate full proofs and this evidence does not justify universally replacing them.
No crossover threshold, production budget or affordable full action is established.

## Rejections

Seventeen negative calls reject changed namespace/root/account/total/stake,
presence with nonzero stake, invalid ABI boolean, added/removed bitmap bit,
changed sibling hash/sum, overflow, truncated calldata, reordered siblings,
explicit default, unused node and more than 256 nodes. Exact revert reasons or
overflow panic code are checked. Ordinary mutation cases change one field.
The explicit-default control is a representation test that necessarily adds a node
and its bitmap bit together, preserving the expanded proof; it is not counted as
a single-field mutation. No all-256-position EVM mutation sweep is claimed.

## Reproduction

Use the existing isolated dependency lock; no dependency changes were made:

```sh
npm ci --prefix experiments/stake-commitment-evm --ignore-scripts --no-audit --no-fund
python3 -I -B experiments/stake-commitment-evm/compact-vectors.py experiments/paid-action/stake_commitment.py > NEW_COMPACT_VECTORS.json
node --max-old-space-size=512 experiments/stake-commitment-evm/compact-run.mjs NEW_COMPACT_VECTORS.json NEW_OUTPUT_DIRECTORY
```

Use unused paths. The output directory must not exist; each compiler/case output
is written before its assertion. The deterministic generated vector file is
retained internally and identified by SHA-256/size in the runtime record; regenerate
it with the script above. Compiler inputs/outputs, results and the run log are
published in a new evidence directory. Original evidence remains unchanged.

The internal EVM process was limited to 60 CPU seconds, 90 wall seconds and a
512 MiB Node heap after checking 2 GiB free disk and 1 GiB available memory.
These are not total-process address-space bounds. Inputs were hashed before/after.
Python 3.12.14 generated the vectors. Existing installed dependencies were reused
and their recorded package metadata, compiler module and executable hashes checked;
no new clean install or independent compiler provenance is claimed. Node differs
from the root application's declared runtime. Dependency licenses remain unchanged;
original added code and documentation use the repository MIT license.

**IDEA / next gate:** retain both representations as research alternatives. Before
selecting either, specify a whole-action resource budget and an accounting-derived
root update boundary, then execute unauthorized/stale-proof/rollback cases against
that stateful prototype. Do not introduce an administrator root setter. Scalable
exact-floor rewards, accepted entitlement policy, C-001 registration, builder-absent
operation and root authority remain open. No full-suite rerun, economic adoption,
production integration, public deployment or hosted CI occurred.
