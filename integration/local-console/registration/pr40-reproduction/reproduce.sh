#!/usr/bin/env bash
set -euo pipefail
packet=$(cd "$(dirname "$0")" && pwd)
root=$(git -C "$packet" rev-parse --show-toplevel)
source_commit=44cd8d854d1ffe37de6a2c2289107945897e1bdb
(cd "$packet" && sha256sum -c SHA256SUMS)
git -C "$root" cat-file -e "$source_commit^{commit}"
out=$(mktemp -d "${TMPDIR:-/tmp}/caw40-authority.XXXXXXXX")
echo "Operator evidence: $out"
{
  git --version
  node --version
  npm --version
  anvil --version
  echo "Source commit: $source_commit"
} > "$out/versions.txt"
mkdir "$out/source"
git -C "$root" archive "$source_commit" | tar -x -C "$out/source"
cd "$out/source"
b=integration/local-console/registration
npm ci --prefix integration/local-console --ignore-scripts --no-audit --no-fund >"$out/install-console.log" 2>&1
npm ci --prefix "$b" --ignore-scripts --no-audit --no-fund >"$out/install-registration.log" 2>&1
status=0
node "$b/test-caw-runtime.mjs" >"$out/execution.log" 2>&1 || status=$?
echo "$status" > "$out/fixture.exit"
if ((status)); then tail -20 "$out/execution.log" >&2; exit "$status"; fi
python3 - "$out" "$packet/reference.json" <<'PY'
import json
import sys
from pathlib import Path

out = Path(sys.argv[1])
reference = json.loads(Path(sys.argv[2]).read_text())
reports = []
for line in (out / 'execution.log').read_text().splitlines():
    if line.startswith('{'):
        record = json.loads(line)
        if 'runtimeVerification' in record:
            reports.append(record['runtimeVerification'])
if len(reports) != 1:
    sys.exit('Expected one completed runtime verification report')
actual = reports[0]
(out / 'authority.json').write_text(json.dumps(actual, indent=2) + '\n')
for field in ('block', 'contracts', 'authority'):
    if actual[field] != reference[field]:
        sys.exit('Authority comparison failed for ' + field)
print('Matched block height, seven contracts and every reported authority field.')
print('Local checkpoint:', actual['checkpoint'])
PY
(cd "$out" && sha256sum versions.txt install-console.log install-registration.log execution.log fixture.exit authority.json > SHA256SUMS)
echo "Pass. Local evidence and checksums: $out"
