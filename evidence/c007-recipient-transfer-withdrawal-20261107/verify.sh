#!/usr/bin/env bash
set -Eeuo pipefail
export LC_ALL=C

PKT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="${1:?Supply the local pinned repository worktree path}"
L="$PKT/lanes"

cd "$PKT"
sha256sum -c manifest.sha256 > /dev/null

test "$(git -C "$ROOT" hash-object \
  experiments/paid-action/paid-build.json)" = \
  "dea79c8bee707235f42f595a9c6f927d144638c7"

test "$(git -C "$ROOT" hash-object \
  reference/fixtures/generate-ethereum-proof-fixtures.py)" = \
  "011e7dc31e35e7ad62a9785983071983db96b151"

python3 -I -B \
  "$L/COMMUNITY_C007_PAIRED_POST_OFFLINE_AUDIT_20261107_V1/audit.py" \
  "$ROOT" \
  "$L/COMMUNITY_C007_SIGNED_PAYER_BASELINE_20261107_V1/results.json" \
  "$L/COMMUNITY_C007_SIGNED_INTENT_20261107_V1/intent.json" \
  "$L/COMMUNITY_C007_PAIRED_POST_20261107_V1/results.json" \
  "$L/COMMUNITY_C007_PAIRED_POST_20261107_V1/comparison.json" \
  "$L/COMMUNITY_C007_PAIRED_POST_OFFLINE_AUDIT_20261107_V1/audit.json" \
  verify

python3 -I -B \
  "$L/COMMUNITY_C007_WITHDRAWAL_OFFLINE_AUDIT_20261107_V1/audit.py" \
  "$ROOT" \
  "$L/COMMUNITY_C007_SIGNED_PAYER_BASELINE_20261107_V1/results.json" \
  "$L/COMMUNITY_C007_SIGNED_INTENT_20261107_V1/intent.json" \
  "$L/COMMUNITY_C007_PAIRED_POST_20261107_V1/comparison.json" \
  "$L/COMMUNITY_C007_PAIRED_WITHDRAWAL_20261107_V2/results.json" \
  "$L/COMMUNITY_C007_WITHDRAWAL_OFFLINE_AUDIT_20261107_V1/audit.json" \
  verify

python3 -I -B "$PKT/receipt_consistency.py" "$PKT"

echo "REDUCED_PACKET_REPLAY=PASS"
echo "PUBLICATION=NOT_VERIFIED"
