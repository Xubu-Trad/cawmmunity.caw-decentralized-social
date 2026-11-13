# OI-01 / R-01: retained-source static recovery and replacement-host reproduction

**Status:** Bounded external reproduction receipt. **OI-01 remains OPEN.** This document records a completed experiment; it does not change or approve the application, verifier, protocol, or release policy.

## 1. Fixed review basis

- Repository: `Xubu-Trad/cawmmunity.caw-decentralized-social`
- Reviewed commit: `bd350c7be5004fd28382470a6a841be6e133c50f`
- Reviewed tree: `b6f20122aa1e564e9ca723f7a58140261bf7ba66`
- Selected SHA-256 of `SHA256SUMS.txt`, calculated from the 22 declared `public/` assets **before** the build: `c4916abc6e35579d89d367eb8368ddcb4d677830c35eed30584ea4da796d4374`
- Resulting deterministic static archive SHA-256: `d277ba5dc819324716e178b1623ade1cbd2e505be3b1576b218ec75d0619ad31`
- Related requirements: [OI-01](OPERATOR_INDEPENDENCE.md), [static recovery](STATIC_RECOVERY.md), and [BA-02](BUILDER_ABSENT_REHEARSAL.md).

The builder does not compile JavaScript. `scripts/build.mjs` copies and hashes 22 declared public assets, then adds the checksum manifest as a 23rd output. Its package command builds a deterministic tar from those bytes. This is an **alpha simulation frontend**, not the executable protocol deployment.

## 2. Observed results (fixed commit only)

A contributor-controlled Linux x86_64 environment ran Node.js **24.20.0** without installing project dependencies. The fresh checkout and the retained-source recovery ran under **one operator on one machine**. The recovery phase was executed in a restricted filesystem view with networking denied; the original checkout was unavailable in that view. The retained source was transferred by the same operator, not received from a separately operated source.

| Observation | Result |
| --- | --- |
| Commit/tree and source identity checks | 32/32 relevant source paths matched their Git blobs and SHA-256 values |
| Fresh and offline recovered builds | 23 files, 1,428,692 bytes; all output bytes identical |
| Separately retained manifest pin | Matched in both builds |
| Portable tar from each build | Byte-identical; SHA-256 as recorded above |
| Existing focused static suites | 16/16 passed in the fresh workspace and 16/16 in the recovered workspace |
| Replacement loopback HTTP host | 46 complete responses matched expected hashes and MIME types under two relocated prefixes |
| Browser smoke | Both alpha pages initialized in a disposable Chromium 131 headless profile |
| Independent machine or separate operator | **NOT RUN** |

The focused suites were rerun **after leaving the network-denied namespace** because the host suite needs a loopback listener. The build, static checker and tar packager did execute inside the network-denied phase. Browser page requests outside the fixture origin were intercepted; this is not a system-wide browser network-isolation guarantee.

The first isolation attempt failed because of environment socket/network-namespace restrictions; the method was corrected and rerun. Both the unsuccessful attempts and succeeding observations are retained in the review evidence. This is a bounded recovery rehearsal, not a simulated loss of the real GitHub account or public host.

## 3. Reproduction recipe for another builder

Use disposable directories and a trusted local toolchain. Do not use wallets, private keys, credentials, live chain endpoints, or production services. Use **Node 24.20.0**, Git and an isolated environment. No `npm install` is required for the project's static build. The review packet provides the pinned identities, expected manifest, actual commands, and negative-control examples.

### Phase A — obtain and verify the selected source (network permitted)

```sh
REV=bd350c7be5004fd28382470a6a841be6e133c50f
TREE=b6f20122aa1e564e9ca723f7a58140261bf7ba66
PIN=c4916abc6e35579d89d367eb8368ddcb4d677830c35eed30584ea4da796d4374

git clone https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social.git caw-oi01
cd caw-oi01
git checkout --detach "$REV"
test "$(git rev-parse HEAD)" = "$REV"
test "$(git rev-parse 'HEAD^{tree}')" = "$TREE"
node --version                 # expected: v24.20.0
node scripts/build.mjs
node scripts/check-static-dist.mjs dist "$PIN"
node scripts/package-static.mjs ../first-static.tar
node --test --test-reporter=tap \
  tests/static-recovery.test.mjs \
  tests/static-package.test.mjs \
  tests/static-host-recovery.test.mjs

git archive --format=tar "$REV" > ../retained-source.tar
cd ..
sha256sum retained-source.tar > retained-source.tar.sha256
sha256sum first-static.tar
```

Retain the source selection (`REV` and `TREE`), manifest pin, tar digest and the trust basis **separately from the received recovery package**. A digest supplied only by the same untrusted package does not authenticate its contents. Git commit identity alone does not authenticate the source publisher.

### Phase B — recover without the original checkout (network denied)

Transfer `retained-source.tar` and its separately retained checksum to a **fresh disposable environment** with Node 24.20.0. Remove access to the source checkout and deny networking at the environment boundary. Confirm the denial rather than assuming a program's lack of requests proves it. Then, from the directory holding the transferred archive:

```sh
sha256sum -c retained-source.tar.sha256
mkdir recovered
tar -xf retained-source.tar -C recovered
cd recovered
node scripts/build.mjs
node scripts/check-static-dist.mjs dist \
  c4916abc6e35579d89d367eb8368ddcb4d677830c35eed30584ea4da796d4374
node scripts/package-static.mjs ../recovered-static.tar
cd ..
sha256sum recovered-static.tar
```

The recorded run produced `d277ba5dc819324716e178b1623ade1cbd2e505be3b1576b218ec75d0619ad31` for the recovered tar. Compare its bytes with the first tar if both are available; otherwise compare against the independently retained digest. If source, runtime, network denial or toolchain differs, report that deviation rather than inheriting this run's result.

### Phase C — verify responses from a replacement host (loopback permitted)

After the offline build, enable **loopback only**, not public deployment. The public reproduction packet contains `host.mjs`, `MANIFEST_PIN.txt` and `EXPECTED_MANIFEST.txt`. Extract it to `review-evidence/` and run from the parent of `recovered/`:

```sh
node review-evidence/host.mjs \
  recovered/dist \
  review-evidence/MANIFEST_PIN.txt \
  review-evidence/EXPECTED_MANIFEST.txt
```

This starts a new, loopback-only static test server; it does **not** reuse the application server. It checks all 23 expected responses under each of two prefixes, MIME types, HTML relative links, rejection of unknown paths, and altered/missing served files. An optional Chromium executable argument runs a bounded browser smoke test. **The recorded Chromium test used `--no-sandbox` and a disposable profile.** It must not be interpreted as browser-security validation and should only be repeated inside an appropriately isolated disposable environment.

## 4. Negative controls and interpretation

All mutations were performed on disposable copies, leaving the original manifest pin unchanged.

| ID | Mutation | Expected observation |
| --- | --- | --- |
| A | Missing asset | `STATIC_RECOVERY_ENTRY_SET` |
| B | Altered asset | `STATIC_RECOVERY_ASSET_HASH` |
| C | Extra asset | `STATIC_RECOVERY_ENTRY_SET` |
| D | Manifest-only substitution | `STATIC_RECOVERY_PIN_MISMATCH` |
| E | Altered asset **and** matching replacement manifest | Original pin rejects; attacker-supplied replacement pin permits **byte consistency only**, not origin authentication |
| F | Wrong separately retained pin | `STATIC_RECOVERY_PIN_MISMATCH` |
| G | Host serves modified script although local files verify | HTTP response-byte mismatch detected by the host harness |
| H | Required hosted script returns 404 | Missing HTTP response detected by the host harness |
| I | Required source asset removed from offline input | Build rejects with `ENOENT`; exit 1 |

These controls corroborate existing static checks as well as the new retained-source and browser workflow. A separate builder can reuse the packet's source inventory and test examples, but should independently select the source and expected digest instead of treating the packet as a trust root.

## 5. New evidence versus existing coverage

The existing static tests already covered **12 recovery**, **one archive**, and **three replacement-host** cases on the project author's environment. This contribution adds a recorded **network-denied retained-source rebuild with the original checkout hidden**, a missing-source failure under those conditions, and **browser initialization from the recovered files**. The two-prefix HTTP exercise extends, but substantially overlaps, the pre-existing replacement-host checks. No new checker, contract, frontend runtime or specification behavior was required.

## 6. Remaining limitations and verdict

**R-01: PASS_WITHIN_SCOPE** applies only to the selected static bytes, retained-source recovery, loopback response checks and limited browser initialization, as observed in this one-machine contributor execution.

**OI-01 remains OPEN.** There was no independently operated distribution, second-machine rebuild, proof of publisher authenticity, public-site continuity, independent protocol action, chain authentication, or production validation. In particular, a verified static UI cannot by itself reconstruct a protocol or authenticate an account's chain state. The recorded browser run also does not establish normal browser sandbox or real-wallet compatibility.

**Evidence packet (separate PR discussion attachment):** `CAWmmunity_OI01_R01_Evidence_8d34b320.zip`
SHA-256: `8d34b320dc5ab1dcd7dd20d2a436d558882c0d6e4eb080a28a5dde04705e76d9`.

The packet includes the source manifest, expected byte inventory, focused logs, offline and host checks, and negative-control records. Its commands were captured in the author's isolated runner and use its local workspace conventions; the self-contained phases above are intended to help the **next** builder reproduce the same bounded checks in their own disposable environment.
