# direct native-call acquisition control

FACT -- under pinned Anvil 1.8.1, London, chain 31337, a fresh local signed transaction calls the signature-recovery native address directly. no CAW contract is deployed and no token code is installed. two local gas balances are initialized; an ordinary signed self-transfer settles the setup before selecting the parent. the experiment then selects the parent and child headers and the native account proofs for one direct-call transaction. fixed inner signature input comes from the pinned earlier wallet fixture.

the parent proof establishes absence. the child proof establishes presence with zero balance and nonce. the receipt reports success and 25,664 gas. seven offline groups pass: local limits, header-bound native proofs, body/receipt/header-chain commitments and recovered transaction sender, fixed inner signature recovery, and rejection of swapped proof, altered receipt and altered raw envelope. [Results and source hashes](../evidence/DIRECT_NATIVE_RESULTS.json) and [compact synthetic fixture](../experiments/paid-wallet-state/direct-native.json) are retained.

the owned node handled 21 requests, two signed transactions including setup, zero upstream requests, and stopped after 1.109 seconds with its listener released. the raw record stays in the private evidence lane. the fixture's raw transaction comes from the writer; it is not independent network acquisition. a proof tied to a selected header does not authenticate consensus, finality or execution.

INFERENCE -- the presence transition is reproducible without the CAW wallet, posting, registry or token contracts. that narrows the earlier discrepancy to the local acquisition/native-call environment or its interpretation; it does not yet assign an engine defect. the earlier independent replay deletes the touched empty account during cleanup. this control has not itself been independently replayed and does not close that mismatch.

## retained negative results

the first capture stopped because the signing helper's simulation account lacked gas funds. a second capture completed, but its genesis parent included blob fields rejected by the strict London header schema. both original records and the failing check are preserved privately. the final control adds a signed setup transaction and selects a non-genesis parent. no verifier schema or cleanup rule was relaxed.

## reproduce the offline checks

```text
node --max-old-space-size=256 experiments/paid-wallet-state/check-direct-native.mjs experiments/paid-wallet-state/direct-native.json
```

fresh acquisition uses capture-direct-native.py with the existing pinned run_wallet_state.py, mined.json, Anvil binary and resource guards. compact-direct-native.py projects a successful raw record into a new output file; it refuses overwrite. no external credentials are needed.

NEXT -- independently replay this minimal direct-call interval with proof-backed sender, fee recipient and native-account dependencies. compare touched-account existence and receipt/gas without forcing agreement. keep the contract-mediated mismatch open, and obtain independent implementation evidence before assigning root cause. production and the public test candidate remain blocked.
