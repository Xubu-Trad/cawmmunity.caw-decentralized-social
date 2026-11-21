# Persistence interruption at different observed writes

Five fresh synthetic runs extend the [first MDBX-write experiment](ACTIVE_PERSISTENCE_INTERRUPTION.md). All keep Reth 2.10.1, threshold 14, buffer 0, state masking 0, a 100 ms pwrite64 exit delay, the same fixture, and the unchanged strict proof reader. Only the watcher selection changes. Failed and earlier evidence remains intact.

| Selection | Observed operation | Restart head | Replacement recovery | Strict proof |
|---|---|---|---|---|
| Write ordinal 2 | Account-change offsets, 16-byte write | 0 | 29 matching headers | 16 fields + 5 rejection controls |
| Write ordinal 3 | Account-change offsets, 16-byte write entry | 0 | 29 matching headers | 16 fields + 5 rejection controls |
| Write ordinal 4 | Account-change offsets, 16-byte write entry | 0 | 29 matching headers | 16 fields + 5 rejection controls |
| Header-file selector | Header static file, 5,522-byte write entry | 0 | 29 matching headers | 16 fields + 5 rejection controls |
| Receipt-file selector | Receipt static file, 1,020-byte write entry | 0 | 29 matching headers | 16 fields + 5 rejection controls |

FACT — each watcher observed its selected destination-file write after the exact block-15 persistence-start marker. It stopped the process group, checked that no matching completion marker was present, then killed it. Each restart retained the same node identity, had zero peers, matched the genesis hash/state root, had no target block 28, and reported SYNCING. With the original source stopped, a different Geth peer restored all 29 exact header hashes/state roots without receiver file import. Fresh storage proofs passed the unchanged reader and all five negative controls. All services stopped.

The ordinal repeats did **not** identify three distinct logical storage phases: concurrent thread ordering varied and all three selected the same account-change offsets family. For that reason, two further runs selected header and receipt files by path. Including the prior MDBX case, observed coverage spans MDBX, account-change offsets, headers and receipts. It is not exhaustive coverage of writes or commit stages.

Several strace entries say `unfinished`; that means the displayed entry had not yet been paired with its return in the observed trace. It does not prove that SIGKILL interrupted the syscall, that the write never completed, or that bytes were not on disk. Polling and scheduling allow intervening writes before the process group stops. The result is interruption during an observed persistence operation, not an exact instruction-level crash test. Absence of a completion log alone does not establish that no subsystem committed.

## Reproduction

Use the existing arguments and fresh-output procedure in [INDEPENDENT_PEER_REPRODUCTION.md](INDEPENDENT_PEER_REPRODUCTION.md), selecting `integration/peer-sync/run-write-2.py`, `run-write-3.py`, `run-write-4.py`, `run-write-headers.py` or `run-write-receipts.py`. Linux strace with syscall delay support is required. Then run the existing check-geth-header-proof.mjs on the new evidence.json and expected registry model. These are the exact executed drivers; resource guards and verification rules were retained. Cleanup now terminates process groups on failed assertions as well. Full original logs remain preserved; published results redact only the personal directory prefix in the selected trace line.

INFERENCE — these runs demonstrate consistent restart-to-genesis followed by strict peer recovery at additional observed storage operations. They do not establish retention of interrupted progress, universal database atomicity or durability. No verifier was relaxed to accept recovery.

UNRESOLVED — independent reproduction, separate hosts, uninstrumented timing, later commit/sync boundaries, filesystem or power failures, and public consensus/finality remain outside this evidence. These local results do not establish production readiness. Next useful work is an independent replay or a separately identified later commit/sync boundary, not treating ordinal counts as stable phases.
