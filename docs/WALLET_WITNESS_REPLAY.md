> historical blocker: the separate [native-absence follow-up](WALLET_NATIVE_REPLAY.md) now reproduces both fixture outcomes; this original blocked harness and its evidence remain unchanged.

# wallet replay: rejected call reproduced, successful call blocked

FACT -- fresh local parent/child proofs were captured around both mined wallet post attempts. the rejected call now replays with the existing EthereumJS London executor and unchanged witness adapter. status0, gas82721, receipt bloom/logs, cumulative gas and selected child account balances/nonces/storage agree with the acquired evidence. removing the wallet mode witness causes WITNESS_STATE_MISSING_SLOT and permanently invalidates that replay environment.

the restored-success path is **not reproduced**. execution requests account0x0000000000000000000000000000000000000001 (native signature recovery). the retained proof verifies that account's absence at the selected parent. the code-bound dependency reader requires an existing account, and omission leads to WITNESS_STATE_MISSING_ACCOUNT. the final harness asserts this exact blocking outcome; a successful harness exit does not mean successful wallet replay.

## evidence and boundaries

the new capture wraps the pinned existing runner and mined-call helper. it acquires proofs and code at the exact selected block for the sender, fee recipient, wallet, registry, paid probe, synthetic token and native signature-precompile address. selected keys cover wallet slot0, registry owner/epoch maps, all13 paid-ledger keys and the synthetic token's probe balance key. headers are rechecked unchanged around each read set. the proof permission is consumed before transport and limited to the internal request in the original prefix phase. no general transport or resource guard was relaxed.

the owned synthetic node made18signed local submissions and335requests, with no upstream request or impersonation. it stopped after17.703seconds and released its listener. the compact capture retains the raw-record digest; the full request transcript stays private. this is not independently operated acquisition.

the replay verifies selected proofs/header linkage and uses the existing witness adapter and executor without disabling nonce or balance checks. it compares selected child values, not a recomputed complete child state root. native precompile semantics are supplied by the selected engine/fork; an account absence proof is not itself implementation of those semantics. no arbitrary-wallet compatibility, public chain authority, finality or production acceptance follows. receipt replay for one rejection is narrower than full ERC-1271 verification.

## retained failed attempts

1. including the absent native account in the existing code-bound dependency list failed with HEADER_STATE_ACCOUNT_ABSENT.
2. excluding that declaration allowed the rejected call to replay, but the restored call failed with WITNESS_STATE_MISSING_ACCOUNT.
3. a diagnostic attempted to replace a method on the frozen adapter and was refused. the final diagnostic uses a separate forwarding facade without modifying the adapter; it records the missing address and preserves the failure.

all three logs and earlier harness versions are retained. the final harness verifies the rejected replay, missing-wallet-slot refusal, native-account nonmembership and exact successful-path blocker. no full suite rerun or accepted production reader change is claimed.

## reproduce

with the already documented pinned execution-engine dependencies installed:

```text
node --max-old-space-size=256 experiments/execution-engine/wallet-witness-replay.mjs . experiments/paid-wallet-state/witnesses.json
```

[harness](../experiments/execution-engine/wallet-witness-replay.mjs), [capture](../experiments/paid-wallet-state/witnesses.json), [result and identities](../evidence/WALLET_WITNESS_REPLAY_RESULTS.json). an exit0 asserts the documented mixed outcome, including the blocker.

fresh Windows acquisition, using new filenames and the existing pinned environment:

```text
python -B experiments/paid-wallet-state/capture-witnesses.py --anvil <anvil.exe> --output <raw.json> --expected-input-sha256 9086b230b5b576bd8d02d1a17ca67509a9a1c18eb4ef92a6ddb86998eb7ea93c
python -B experiments/paid-wallet-state/compact-mined.py <raw.json> <witnesses.json>
```

UNRESOLVED -- design a narrow proven-absent-account representation separately from missing evidence. review fork-specific native precompile behavior, empty-account reads and unsupported account creation/writes before integrating it. missing proof must still reject. do not fabricate a present account or seed a balance to bypass this blocker. then rerun the retained success transaction and negative witness cases. no authority flag should be raised merely because this harness records the expected failure.
