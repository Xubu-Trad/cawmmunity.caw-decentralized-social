# Client archive signatures and independent reproduction status

## Verified binary provenance

Both preserved Linux-amd64 client archives verify under publisher keys whose full fingerprints were checked against official documentation. Each installed executable matches the unique corresponding regular-file entry inside its signed archive. Each detached signature rejects the other client's archive as a negative control. Verification used a new isolated GPG home/keyring; no personal keyring was changed and no client process was started.

| Client | Release | Publisher primary fingerprint | Installed executable SHA-256 |
|---|---|---|---|
| Geth | 1.17.10 / 1df30b18 | FDE5A1A044FA13D2F7ADA019A61A13569BA28146 | 45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea |
| Reth | 2.10.1 | 50FB7CC55B2E8AFA59FE03B7AA5ED56A7FBF253E | 227f6d0fc80dcb8851de04d0204eeb171645833eb0ab7a583378a5f2a78c18b9 |

Fingerprint references: [Geth downloads](https://geth.ethereum.org/downloads), [Reth binary installation](https://reth.rs/installation/binaries/). The archive hashes, source URLs and exact VALIDSIG records are retained in evidence/client-provenance-20261111/result.json. Trust in those official HTTPS fingerprint publications is explicit. A valid publisher signature does not prove source-to-binary reproducibility, absence of vulnerabilities, current patch suitability or public-chain correctness. The older acquisition records remain unchanged.

## Repeat the bounded check

```sh
python3 integration/peer-sync/verify-client-binaries.py --geth-dir "$GETH_RELEASE_DIR" --reth-dir "$RETH_RELEASE_DIR" --output "$FRESH_OUTPUT"
```

GETH_RELEASE_DIR must contain the preserved alltools.tar.gz and geth; RETH_RELEASE_DIR must contain client.tar.gz and reth. The script is scoped to the exact releases above. It fetches only signatures/public keys, checks primary fingerprints before verification, compares executable bytes against signed archives, and rejects signature/archive mismatches. GPG/gpgv and Python3 are required. Output must be fresh. No installation, build or node execution occurs.

## Independent attempt: environment blocked

[ahdmesh's R-04 report](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6812337526) uses execution snapshot54f872c and preflight revisiona263c4b. I verified the attached archive SHA-256 `296ec195fb907b7f6725f56af99c179394a5cd42180cb5368d9befda335b7af8` and all 124 manifest-listed file hashes without executing attached code.

The retained logs show PTRACE_TRACEME/PTRACE_SETOPTIONS denied with Operation not permitted, followed by NODE_EXIT before Reth readiness. Both recorded cleanup results say allStopped:true. The reviewer reports successful14-input verification and five preflight controls; the retained-proof output records16 fields/five rejection controls. These are independent setup/offline observations, not new peer-recovery proofs. No persistence interruption, restart-retention result, replacement-peer recovery or29-header check was obtained in that attempt.

The independent execution verdict remains BLOCKED by environment, not PASS and not an observed recovery failure. R-03 and PR-wide review boundaries remain unchanged. Reproduction needs a suitably authorized isolated Linux environment that permits this local-child tracing experiment. Do not bypass restrictions or remove tracing while calling it the same experiment. An early capability check before initializing Geth would make this limitation clearer; that improvement remains the next bounded task.

Publisher-signed executable identity and signed runtime package provenance now have separate evidence. Fresh source builds, complete loaded-dependency attestation, independently executed recovery, public-chain authentication/finality and production readiness remain unresolved.
