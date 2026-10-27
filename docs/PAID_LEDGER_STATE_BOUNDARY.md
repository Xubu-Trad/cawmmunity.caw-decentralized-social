# paid ledger endpoint-state boundary

FACT -- the existing evidence has several distinct layers. the following inventory is pinned to e9d696783993fd0a41ec88e527bb5493cffe0b5a; [source identities and verification results](../evidence/PAID_LAYOUT_RESULTS.json) record the review.

| existing surface | what it checks | what it does not establish |
| --- | --- | --- |
| paid-action-reader.mjs | replays bounded history into owners, epochs, credits, stakes, nonces, totalCredits, poolDust, messageCount and tokenBalance; checks conservation/backing in that model and equality with supplied final values | equality with supplied final values is not a proof of deployed ledger storage |
| paid-acquisition-evidence.mjs | compares captured endpoint getter responses with replay output, at the requested endpoint tag | RPC-response agreement does not cryptographically authenticate those getter results |
| paid-registry-state-history.mjs | binds selected registry owner/epoch/approval/operator proofs to the history endpoint and compares the selected account with replay | no paid-contract credit/stake/nonce/aggregate storage proof is composed here |
| registry-bootstrap/binding-reader.mjs | verifies fixture paid-contract code/immutables and selected registry owner/epoch at one header | code binding does not prove paid ledger balances, token backing or a safe withdrawal |

INFERENCE -- the missing composition is a paid-ledger storage witness at the same selected header/address/code as the binding and history endpoint. adding another endpoint getter comparison would duplicate existing observations without closing that gap. no existing reader is replaced in this increment.

## compiler-derived fixed fixture layout

FACT -- pinned Solidity0.8.10 was rerun on the retained paid-action compile input. the only requested change was adding storageLayout to outputSelection. runtime bytes, creation bytes and ABI matched paid-build.json exactly. the [layout receipt](../experiments/paid-action/storage-layout.json) records full compiler types and hashes. four verification cases passed: actual output accepted; altered credits slot, runtime and ABI each rejected. this reproduces output from the retained compiler, not independent authentication of its publisher or correctness.

| field | root slot | value |
| --- | --- | --- |
| credits | 0 | mapping(uint256 => uint256) |
| stakes | 1 | mapping(uint256 => uint256) |
| nonces | 2 | mapping(uint256 => uint256) |
| totalCredits | 3 | uint256 |
| poolDust | 4 | uint256 |
| messageCount | 5 | uint256 |
| entered | 6 | bool at byte offset0 |

registry and registryCodeHash are code immutables, not storage slots. TOKEN/FEE and the other constants also do not supply ledger storage. a mapping root is not its account's concrete key: derive keccak256(abi.encode(accountId, rootSlot)).

## reproduce the compiler comparison

use the compiler SHA256 in the layout receipt and apply the existing resource guards. the helper prepares and verifies files; it does not download or launch a compiler.

```text
python scripts/paid-layout-reproduce.py input new-input.json
solc --standard-json < new-input.json > new-output.json
python scripts/paid-layout-reproduce.py verify new-output.json
```

the input helper refuses overwrite and checks parent/derived input identities. verification compares creation/runtime bytes, ABI and the complete layout with retained records. compiler output and negative-case mutations are preserved in the private evidence lane. no prior suite was rerun, and no production contract code changed.

## next bounded evidence

IDEA -- request13 exact witnesses: nine mapping values for fixture IDs1..3, slots3/4/5 and the entered slot6. require valid zero/absence proofs too. bind them to the paid-contract account commitment, fixed code profile and same selected history endpoint. compare decoded integers with independently reconstructed history, require stakes<=credits and sum(credits)==totalCredits, and preserve failure on wrong slots, forged values, absent witnesses or a different state. use nonzero state as well as zero-state controls; an empty-contract demonstration cannot establish funded accounting.

UNRESOLVED -- tokenBalance is state of the external token contract, not this ledger. proving totalCredits or a model's backing inequality alone does not establish actual token backing, transfer semantics or withdrawal execution. token code/layout/dependencies and successful/reverting withdrawal cases need separate evidence. a post-state entered=false flag is not a reentrancy proof. canonicality, current permission, production registration, source conflicts and independent reproduction remain open. no acceptance gate closes here.
