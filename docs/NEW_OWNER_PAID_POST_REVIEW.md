# Paid settlement after contract-wallet transfer

The earlier two-wallet regression validated a new owner's signature without executing another paid action. This separate experiment closes that specific test gap: walletB receives mock tokens, approves and deposits exactly the5000token research fee at epoch1, then signs and executes the second paid post through the relayer. A signature from the former controller is rejected after funding; replay of the accepted action is rejected with NONCE. Both rejected attempts preserve observed account state.

The local call lifecycle and a38transaction signed capture pass. Transaction replay matches27successes,11expected reverts, logs and gas10814253. The bounded accounting model independently recovers the current wallet controller's signature for both successful posts and reconstructs both distributions. Twenty-two storage values and four native balances verify against reconstructed root `0xe3b8d6dcdea415fa491181888bcdf2774fe22345eae8bcba6f0b9a4e11a31399`. Seven existing transaction/proof controls pass.

Final action nonce is2. Ownership returns to walletA at epoch2. Account1credit/stake remain998tokens each; each wallet has withdrawn1token. Vault token backing is11018tokens, equal to liabilities plus2base units of rounding dust. The5000token fee and fixed pool remain experimental policy, not adopted manifesto economics. Minting is performed by the explicit mock token, not a claim of real funding or production token compatibility.

Both contract sources are unchanged. Earlier packages remain preserved. This sequence has not yet received its own full-block/Geth comparison or downloadable raw-input package. The original Anvil-root mismatch remains unresolved. EIP-7702, production NFT integration, wallet recovery and external review are not established.

Code is in `experiments/c007-new-owner-post/`; local lifecycle uses its pinned Node dependencies and `node run-lifecycle.mjs /absolute/path/to/new-output`. Signed capture additionally needs ethers6.16.0 and the established loopback Anvil31337Shanghai setup. The replay uses constructor VM dependencies and acquired-history/compiler-output/genesis inputs. No clean install or full-suite result is claimed. Next: second-post-specific negative controls, then block/second-engine reproduction. README remains paused.


## Additional controls and dependency review

Eleven semantic negative controls now pass, including second-post previous-controller, stale-epoch and reused-nonce rejection. Nine history corruption checks also pass. See [third-party failure gates](THIRD_PARTY_FAILURE_GATES.md) for the scoped dependency inventory, six selection controls and inert source-comment homage. No clean-build/CVE or production guarantee is implied.

## Two-engine reproduction package

All38constructed synthetic blocks replay from a fresh state. Geth and EthereumJS match every transition, transaction root, receipt root and four final native balances:27successes and11reverts. Seven block controls, six Geth controls and eight input-integrity checks pass. Both engines reach `0xe3b8d6dcdea415fa491181888bcdf2774fe22345eae8bcba6f0b9a4e11a31399`.

The four frozen inputs (644153bytes) are published at `evidence/c007-new-owner-replay-20261108/`; exact hashes are pinned by the comparison runner. Data scans found no path/credential-pattern matches and all senders are known synthetic actors. Prior packages are preserved. Follow [pinned Geth tool instructions](WALLET_REPLAY_REPRODUCTION.md), then from the checkout root:

```sh
python3 experiments/c007-new-owner-post/check-replay-inputs.py experiments/c007-new-owner-post/compare-geth-transition.py evidence/c007-new-owner-replay-20261108 evidence/c007-new-owner-replay-20261108/blocks.json /absolute/path/to/new-check-output
python3 experiments/c007-new-owner-post/compare-geth-transition.py evidence/c007-new-owner-replay-20261108 evidence/c007-new-owner-replay-20261108/blocks.json /absolute/path/to/evm /absolute/path/to/new-replay-output
```

Synthetic genesis fee1142857142 and37timestamp adjustments define this constructed chain. It does not repair the original Anvil root discrepancy or authenticate consensus/finality. This is not an independent human audit, production token compatibility or proof of general wallet support. The next dependency gate is explicit failing-token withdrawal/deposit behavior and rollback; passing replay of the cooperative mock token does not establish that. README remains paused.
