#!/usr/bin/env python3
"""Recompute the gas/payer tables in GAS_AND_PAYER_COMPARISON_DRAFT.md.

Usage: python3 recompute_gas_table.py <repo-root>

Reads experiments/paid-action/execution-summary.json and
experiments/paid-action/execution-trace.json from the given checkout,
joins them by label, prints the document's tables, and asserts the
document's key claims. Exits non-zero on any mismatch, so a changed
record cannot silently pass.

Expected input: the retained local Anvil run (all listed transactions at
gas price 100 gwei, no real wallet, no public broadcast).

ETH figures are computed exactly from integer wei with Decimal
quantization; no binary floating-point arithmetic is used.
"""
import json
import sys
from decimal import Decimal
from pathlib import Path

LABELS = [
    "first_relayer",
    "duplicate_other_relayer",
    "expired",
    "stale_pool",
    "unicode_419",
    "unicode_420",
    "composed",
]
PRICES_GWEI = [10, 50, 100, 200]
FEE_BASE_UNITS = 5_000 * 10**18


def main() -> int:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    base = root / "experiments" / "paid-action"
    summary = json.loads((base / "execution-summary.json").read_text())
    trace = json.loads((base / "execution-trace.json").read_text())
    by_label = {tx["label"]: tx for tx in trace["transactions"]}
    rows = {}
    for row in summary["transactions"]:
        label = row["label"]
        if label not in LABELS:
            continue
        tx = by_label[label]
        gas_used = int(tx["receipt"]["gasUsed"], 16)
        gas_price = int(tx["transaction"]["gasPrice"], 16)
        assert gas_price == 100 * 10**9, f"{label}: gas price is not 100 gwei"
        rows[label] = {
            "status": row["status"],
            "error": row.get("errorData"),
            "gas_used": gas_used,
            "calldata_bytes": (len(tx["transaction"]["data"]) - 2) // 2,
            "state_unchanged": row.get("before") == row.get("after"),
            "from": tx["transaction"]["from"],
        }

    print("label | status | error | calldata_bytes | gas_used | state_unchanged")
    for label in LABELS:
        r = rows[label]
        print(f"{label} | {r['status']} | {r['error']} | "
              f"{r['calldata_bytes']} | {r['gas_used']} | {r['state_unchanged']}")

    print("\nlabel | gas_used | " + " | ".join(f"{p} gwei" for p in PRICES_GWEI))
    for label in LABELS:
        g = rows[label]["gas_used"]
        # Exact arithmetic only: integer wei, then Decimal at 7 places.
        # No binary floating point is used anywhere in this script.
        costs = " | ".join(
            f"{(Decimal(g * p * 10**9) / Decimal(10**18)).quantize(Decimal('0.0000001'))} ETH"
            for p in PRICES_GWEI
        )
        print(f"{label} | {g} | {costs}")

    # Revert cases must leave contract state unchanged.
    for label in ("duplicate_other_relayer", "expired", "stale_pool"):
        assert rows[label]["state_unchanged"], f"{label}: state changed on revert"
        assert rows[label]["status"] == "0x0", f"{label}: expected revert status"
    assert rows["first_relayer"]["status"] == "0x1", "first_relayer: expected success"

    # Fee accounting for the successful short post.
    first = next(r for r in summary["transactions"] if r["label"] == "first_relayer")
    before, after = first["before"], first["after"]
    poster_delta = int(after["credits"][0]) - int(before["credits"][0])
    assert poster_delta == -FEE_BASE_UNITS, f"poster delta {poster_delta}"
    assert int(after["poolDust"]) - int(before["poolDust"]) == 1, "dust delta != 1"
    assert before["nonces"] == ["0", "0", "0"] and after["nonces"] == ["1", "0", "0"]
    assert before["messageCount"] == "0" and after["messageCount"] == "1"

    print("\nAll assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
