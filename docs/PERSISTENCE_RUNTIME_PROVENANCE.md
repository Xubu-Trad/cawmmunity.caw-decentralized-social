# Runtime package provenance for persistence reproduction

FACT — the preserved libc6, libgcc-s1 and libstdc++6 packages used by the experimental Reth runtime now have a verified metadata chain: Ubuntu noble InRelease signature → SHA-256 and size of Packages.xz → package version and SHA-256 → preserved .deb bytes → 292 extracted regular files. The current retrieved index is byte-identical to the preserved index fingerprint. gpgv accepted the original signed metadata and rejected an altered Origin field. The portable command repeated the same checks in a fresh evidence directory.

Signer fingerprint: `F6ECB3762474EDA9D21B7022871920D1991BC93C`. The installed Ubuntu archive keyring is the trust anchor; its hash is recorded. This does not independently establish that keyring's authenticity. The original acquisition's signatureVerified:false record remains intact; this follow-up adds evidence rather than rewriting history.

## Reproduction command

```sh
python3 integration/peer-sync/verify-runtime-provenance.py --runtime "$PRESERVED_RUNTIME" --output "$FRESH_OUTPUT" --keyring /usr/share/keyrings/ubuntu-archive-keyring.gpg
```

PRESERVED_RUNTIME contains the existing provenance.json, libc6.deb, libgcc-s1.deb, libstdc++6.deb and extracted root/ tree from the documented runtime preparation. Python3, gpgv and dpkg-deb are required. The output must be new. The script downloads only repository metadata; it does not install packages, change the runtime, execute package scripts or start nodes. It fails if the index differs from the preserved fingerprint, package versions/hashes differ, extracted regular files differ, or altered signed metadata is accepted. Preserve a failure if upstream metadata changes; do not bypass the mismatch to claim reproduction.

## Exact scope

The versions are libc6 2.39-0ubuntu8 and libgcc-s1/libstdc++6 14-20240412-0ubuntu1. These are historical base-release packages. A valid repository signature is not proof that they are currently patched or appropriate for production. No security-update assessment was performed and no recommendation to deploy these versions is made.

The check does not attest all loaded libraries, symlinks, kernel/filesystem, compiler provenance, or source-to-binary reproducibility. Geth/Reth executable provenance remains a separate task. Raw metadata and negative-test logs are preserved; the public result includes fingerprints and scope, not private filesystem paths. This closes a specific runtime provenance gap without changing recovery verification or upgrading the scope of earlier tests.

Independent operator reproduction, fresh client/toolchain validation and public-chain authentication/finality remain pending. Use [the preflight](PERSISTENCE_PREFLIGHT.md) and [combined strict recovery command](PERSISTENCE_SYNC_REPRODUCTION.md) separately; metadata verification is not a recovery test or production approval.
