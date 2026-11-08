# Stake proof Solidity cost experiment

2026-11-08; parent `341dbc5921fa76d944259f337e96eb49df1632be`.

**FACT:** the [pure Solidity verifier](../experiments/stake-commitment-evm/StakeProofResearch.sol)
compiled with solc 0.8.30 and passed 23 isolated EthereumJS EVM calls under explicit
Shanghai rules. These calls installed compiled runtime bytes directly in a fresh
in-memory state manager per case. There was no constructor/deployment transaction,
signed transaction, node RPC, chain receipt or public network interaction.

This ports the exact [Python commitment encoding](STAKE_COMMITMENT_RESEARCH.md).
The contract compares a proof against caller-supplied namespace, root and total.
It has no persistent state, authorized updater, custody or privileged root setter.
A passing result authenticates none of those supplied values. An absence proof
is not account admission. Economics, cancellation and signatures remain separate.

## Observed cost

Five positive calls use a deterministic four-account tree: present-zero key 0,
key 1, key 2^255, maximal uint256 key, and absent key 2. The Python kernel generates
each proof and checks it before Solidity executes it. This is same-author
cross-language checking, not outside review or an independent cryptographic audit.

| Positive case | EVM execution gas | Calldata bytes | Calculated Shanghai intrinsic gas |
| --- | ---: | ---: | ---: |
| Present zero | 356,051 | 16,580 | 185,948 |
| Key 1 | 356,062 | 16,580 | 185,960 |
| High-bit key | 356,062 | 16,580 | 185,984 |
| Maximal key | 358,867 | 16,580 | 186,332 |
| Absent key | 355,624 | 16,580 | 185,936 |

Execution gas includes the SHA-256 precompile calls. Intrinsic gas is separately
calculated as 21,000 + 4 per zero calldata byte + 16 per nonzero byte. It is not a
transaction receipt, a current-mainnet pricing model or a measurement of fees.
The 16,580 bytes comprise selector, six scalar words and 512 sibling words.
Compiled runtime is 1,325 bytes. Compiler optimization is enabled with 200 runs.
No state-update/storage gas, deployment gas or settlement gas was measured.

**INFERENCE:** a fixed number of tree operations does not imply a cheap on-chain
proof. These results warrant a numerical cost budget before adopting this format.
They establish no network throughput or affordable full-action result.

## Negative cases and boundary

Eighteen calls reverted as expected: changed namespace/root/key/total/stake,
presence toggled with nonzero stake, invalid ABI boolean, eight separate sibling
hash mutations at heights 0/1/31/63/127/191/254/255, one sibling-sum change, uint256
overflow and a truncated proof. The harness checks exact revert strings, panic
code 0x11, or empty ABI rejection as appropriate. Each mutation changes one field
from a positive vector. The earlier Python all-256-sibling experiment is separate;
this EVM experiment does not claim to repeat it.

The ABI has a fixed-size proof. Solidity ABI decoding is not a canonical wire
validator: trailing calldata may be accepted. This is unsupported as a signed
message format and no strict exact-length policy is claimed. Overflow rejects
before a successful return; there is no storage whose rollback was tested.

## Reproduction and evidence

From the repository root, choose unused output names:

```sh
npm ci --prefix experiments/stake-commitment-evm --ignore-scripts --no-audit --no-fund
python3 -I -B experiments/stake-commitment-evm/vectors.py experiments/paid-action/stake_commitment.py > NEW_VECTORS.json
node --max-old-space-size=512 experiments/stake-commitment-evm/run.mjs NEW_VECTORS.json NEW_OUTPUT_DIRECTORY
```

Do not reuse evidence paths. The runner refuses an existing output directory and
preserves compiler output and individual case results before assertion failures.
Use local resource limits appropriate to the machine. The internal run used
Node v24.22.1 and Python 3.12.14; it did not use the root application's declared
Node pin. A 512 MiB Node heap cap and pre-install 2 GiB free-disk check were applied;
no outer CPU/wall/address-space guard was installed on this run. The initial
dependency command was `npm install` with scripts/audit/funding disabled, producing
the retained lock. The `npm ci` command above is a reproduction instruction, not
an additional executed clean-install claim.

[Results](../evidence/stake-proof-evm-20261108/results.json), compiler input/output,
vectors, [runtime/dependency inventory](../evidence/stake-proof-evm-20261108/runtime.json)
and [provenance](../evidence/stake-proof-evm-20261108/provenance.json) retain exact
identities. Registry integrity hashes pin downloaded package bytes; they do not
independently authenticate a compiler build. Dependencies are isolated from the
root application, locked, unmodified, and retain their MIT/ISC/MPL-2.0 notices.
No third-party source is copied into this increment. Original code/docs are MIT.

**IDEA / next gate:** compare a separately specified compressed-proof representation
and an authorized accounting-to-root update design against an explicit gas/storage
budget. Do not silently change the existing format. Registration churn, root
authentication, scalable exact-floor payouts, C-001/C-007 decisions and a complete
independently reproduced action remain open. No full-suite rerun, production
integration, public deployment or hosted CI occurred.
