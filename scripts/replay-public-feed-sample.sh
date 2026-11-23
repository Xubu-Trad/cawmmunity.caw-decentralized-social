#!/usr/bin/env bash
set -euo pipefail
# Linux x86-64, Bash, git, curl, tar, unzip, sha256sum and Node.js 20.20.2 with npm.
test "$(node --version)" = v20.20.2
root=$(git rev-parse --show-toplevel)
work=$(mktemp -d)
cd "$work"
repo=https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social
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
cd "$root"
b=integration/local-console/registration
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund
npm ci --prefix "$b" --ignore-scripts --no-audit --no-fund
cmp "$work/operator-deployment.json" "$b/operator-deployment.json"
export GETH="$work/$gethdir/geth"
bash "$b/replay-export.sh" "$work/sample.html" "$work/history.rlp" "$b/operator-deployment.json"