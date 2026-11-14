# C-007 — Funded account-credit lifecycle experiment

RESEARCH_NOT_ADOPTED. This separate experiment joins funded admissions to proof-checked account credits. The prior funded fixture and frozen protocol baseline remain unchanged. No withdrawal or NFT-beneficiary authority is introduced.

## Behavior

Two successful fee5 mock-token admissions create two funded records. A caller may submit a claim for a snapshot account, but cannot select a payment wallet or redirect its credit. The contract verifies the payer and recipient's256-level SHA-256 sum-tree proofs against the constructor root and total10. It excludes payer account1 and uses the previously proposed prefix allocation. For each record, accounts2/3/4 receive1/4/0 respectively. Numeric account order affects rounding; this remains an unresolved policy choice, not an adopted rule.

A record/account marker prevents repeated claims, including repeated zero-value claims. Each successful claim reduces its record budget and increases the proven account's credit. No token call occurs during claim. All token movement remains in admission.

`unclaimedLiability`, inherited in name from the admission experiment, represents total **unpaid** liability here, including credited amounts. It remains10. `creditedLiability` grows to10 as record budgets fall to0; credits2/8/0 sum to10, backed by the10 mock tokens held. Naming should be reconciled before broader integration; crediting does not discharge a liability or release collateral.

## Snapshot distinction

This experiment adds an explicit zero-weight account4 to test zero-value claims. The older admission snapshot contained accounts1/2/3 only. An absent leaf and an explicit zero-weight leaf have different hashes. The new root, deployments, signed bytes and record IDs are therefore new evidence, not a replay of the old15 transactions. Initial preparation detected that distinction and stopped before execution; no old evidence was rewritten.

The constructor root is a supplied fixture assumption. Proof correctness does not establish that a public staking process produced it. There is no root-update administrator, but neither is there a permissionless staking/root-production implementation in this experiment.

## Executed results

The local EthereumJS run executed29 signed transactions: the15-step admission scenario, six successful claims and eight failed claims. The original six admission rejection cases still pass. Claim failures cover unknown/unfunded nonce, payer claim, incorrect weight, altered recipient proof, altered payer proof, short proof, duplicate positive claim and duplicate zero claim. Each tested failure preserves queried token balances, allowance, protocol nonce, total liability, credits, budgets and claim markers, and emits no logs. Native transaction nonce and gas charges still advance.

Claims on the second record use a different order. Both records give the same account allocation. A different wallet submits every claim; credits remain tied to the proved account. Final token balances: payer1, vault10, other wallet89. Final credits: account2=2, account3=8, account4=0; both record budgets0; total unpaid liability10.

V1 failed compilation with stack-too-deep. A private state-update helper fixes it without changing compiler settings. V2 exposed concurrent checkpoint reads in the harness: they interfered with the shared VM. V3 reads sequentially and retains the state-root restoration assertion. Both failed output lanes are preserved privately. The final run is one engine; the earlier two-engine admission result must not be attributed to this new claim implementation.

## Reproduce

With Node20.20.2, ethers6.16.0, solc0.8.30 and EthereumJS10.1.3 installed as in the earlier local experiment:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-funded-claims.mjs   integration/core-baseline-v1/FundedClaimResearch.sol /new/execution/directory   evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

The Solidity compiler input retains the historical source key `FundedAdmissionResearch.sol` and contract name `FundedAdmissionResearch`; the separate filename prevents replacing the original source. Compare the saved compiler input to the supplied file. The proof fixture uses the existing Python prefix-tree builder with `{1:2,2:3,3:5,4:0}`. No dependency download or network service is required by the harness. The local wrapper enforced2GiB free disk and1GiB available memory, a256MiB Node heap and120second run timeout.

## Open gates

This is a bounded fixed-fee, fixed-payer allocation experiment. No arbitrary-fee overflow proof, live stake authentication, original CAW compatibility, NFT ownership/withdrawal semantics, second-engine claim replay, public-chain authentication or production readiness is claimed. Do not fund it. Next reconstruct these new claim credits from the signed operations and existing event readers, then compare independent execution before expanding custody or beneficiary behavior. README unchanged; hosted CI deferred.


## Reconstruction follow-up

[Separate history reconstruction](C007_FUNDED_CLAIM_RECONSTRUCTION.md) now matches all29 operations and account credits, with a Python allocation cross-check. It does not add authenticated receipts or second-engine claim execution.
