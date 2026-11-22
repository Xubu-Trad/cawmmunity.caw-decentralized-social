#!/usr/bin/env bash
# Run from a checkout of the revision being reviewed.
set -euo pipefail
umask 077
root=$(git rev-parse --show-toplevel)
commit=$(git -C "$root" rev-parse HEAD)
output=${1:?Supply a new output directory}
mkdir -- "$output"
output=$(cd "$output" && pwd)
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
exec > >(tee "$output/run.log") 2>&1
echo "Reviewing $commit"
echo "$commit" > "$output/commit.txt"
node --version
[[ "$(node --version)" == v20.20.2 ]]
export CHROME_BIN=${CHROME_BIN:-$(command -v chromium || command -v google-chrome || true)}
git -C "$root" archive "$commit" -- integration/local-console public reference evidence/console-withdrawal-20261116 | tar -xf - -C "$scratch"
cd "$scratch/integration/local-console"
sha256sum package-lock.json
npm ci --ignore-scripts --no-audit --no-fund
fixture="$scratch/evidence/console-withdrawal-20261116"
node --experimental-websocket test-receipt-history-browser.mjs "$fixture" "$output/browser"
"$CHROME_BIN" --version
shopt -s nullglob
downloads=("$output"/browser/caw-withdrawal-proofs-*.json)
[[ ${#downloads[@]} -eq 1 ]]
file=${downloads[0]}
# The R-09 independent review reported this digest for the retained transaction.
expected=debeefdb655c13669044a69f732e67d33e45bfdefcdb53320e5a1a48f731ceed
printf '%s  %s\n' "$expected" "$file" | sha256sum --check
[[ $(wc -c < "$file") -eq 28866 ]]
node verify-withdrawal-package.mjs "$file" "$fixture/withdrawal-selection.json" > "$output/offline-replay.json"
printf '%s\n' "$expected" > "$output/download.sha256"
echo "PASS: native download matched the R-09 bytes and passed offline replay."
