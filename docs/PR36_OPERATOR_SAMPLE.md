# Verify the published PR #36 sample

This is the disposable-chain feed for `portal1795395428` at block 70. You can run the public sample without the publisher’s machine, credentials or running services. [Download the release assets](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/releases/tag/operator-sample-pr36-v1).

Use Linux x86-64 with Bash, Node.js 20.20.2 and npm, git, curl, tar, unzip and sha256sum. Leave loopback ports 34735, 34736, 34738–34742 and 34899 free. Run the block below in a shell. It creates a new working directory, checks the source revision, verifies the downloads, installs from both locks, and replays into an empty Geth database.

```bash
set -euo pipefail
# Linux x86-64, Bash, git, curl, tar, unzip, sha256sum and Node.js 20.20.2 with npm.
test "$(node --version)" = v20.20.2
work=$(mktemp -d)
cd "$work"
repo=https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social
git clone --depth 1 --branch operator-sample-pr36-v1 "$repo.git" portal
test "$(git -C portal rev-parse HEAD)" = ffe18ddce84479fd2611cf5209f7b3fd21e619ed
release="$repo/releases/download/operator-sample-pr36-v1"
curl -fsSL "$release/community-caw-operator-sample.zip" -o community-caw-operator-sample.zip
curl -fsSL "$release/SHA256SUMS" -o SHA256SUMS
echo 'bb4774cb4420f5b6f36cc6a73b978c2a50febeff6abd4e99f800246d83ee8737  community-caw-operator-sample.zip' | sha256sum -c -
unzip -q community-caw-operator-sample.zip
sha256sum -c SHA256SUMS
gethdir=geth-linux-amd64-1.17.10-1df30b18
curl -fsSL "https://gethstore.blob.core.windows.net/builds/$gethdir.tar.gz" -o geth.tar.gz
echo 'e016aca8cc391c8d5d14dc17c9af589488d99c37ed71d892213c80757935ba64  geth.tar.gz' | sha256sum -c -
tar -xzf geth.tar.gz
echo "45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea  $gethdir/geth" | sha256sum -c -
cd portal
b=integration/local-console/registration
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
npm ci --prefix "$b" --ignore-scripts --no-audit --no-fund
cmp "$work/operator-deployment.json" "$b/operator-deployment.json"
export GETH="$work/$gethdir/geth"
bash "$b/replay-export.sh" "$work/sample.html" "$work/history.rlp" "$b/operator-deployment.json"
```

Expected last line:

```text
MATCH 5f24dd8ecf92a81f6223a05dad7445cab415db290c099e264c8ce578f11261ee portal1795395428 70 0xd5d515de74ec31b3704fc8e378257a74f63736b792b5e95223aeadcb61b8e730
```

### Sample SHA-256

```text
bb4774cb4420f5b6f36cc6a73b978c2a50febeff6abd4e99f800246d83ee8737  community-caw-operator-sample.zip
77e14cd827b665efcadf29c0b24905741e73ac161ad35ff6cf95a3a99c8b7d95  history.rlp
5f24dd8ecf92a81f6223a05dad7445cab415db290c099e264c8ce578f11261ee  sample.html
a18f649b4b546a3d796e1eb319c1a294b9223a7085e552b6f8c8f0a839bc1fd1  operator-deployment.json
```

To report an independent run, add your OS, Node and Geth versions, source commit, the final output or first failing step, and whether you used the released history or a separately maintained node to [PR #36](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/36). Re-execution checks that the feed is reproducible from these bytes. Independently establishing that this was the historical branch requires separately sourced evidence.

From an already checked-out candidate revision, run `bash scripts/replay-public-feed-sample.sh` to exercise that working tree against the same pinned sample.
