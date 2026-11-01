#!/usr/bin/env python3
"""Recompute the gas/payer tables in GAS_AND_PAYER_COMPARISON.md.

Usage: python3 scripts/recompute-gas-table.py .

Reads experiments/paid-action/execution-summary.json and
experiments/paid-action/execution-trace.json from the given checkout,
joins them by label, prints the document's tables, and asserts the
document's key claims. Exits non-zero on any mismatch, so a changed
record cannot silently pass.

Expected input: the retained local Anvil run (all listed transactions at
gas price 100 gwei, no real wallet, no public broadcast).

ETH figures are computed exactly from integer wei with Decimal
quantization; no binary floating-point arithmetic is used. Display
quantization is to 7 decimal places with ROUND_HALF_EVEN, named
explicitly in the code. The recomputed tables are also asserted
against the expected values printed in the document (the EXPECTED_*
constants below), so the script checks the document itself, not only
the records.
"""
import json
import sys
from decimal import Decimal, ROUND_HALF_EVEN
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

# Expected values printed in the document (section 2 table for gas,
# calldata, status, and error; section 3 table for ETH figures, shown
# at 7 decimal places). The script asserts that recomputation from the
# retained records reproduces these values exactly.
EXPECTED_GAS = {
    "first_relayer": 171170,
    "duplicate_other_relayer": 58275,
    "expired": 57945,
    "stale_pool": 64747,
    "unicode_419": 573303,
    "unicode_420": 963188,
    "composed": 102263,
}
EXPECTED_CALLDATA = {
    "first_relayer": 516,
    "duplicate_other_relayer": 516,
    "expired": 484,
    "stale_pool": 484,
    "unicode_419": 1316,
    "unicode_420": 2148,
    "composed": 484,
}
EXPECTED_STATUS = {
    "first_relayer": "0x1",
    "duplicate_other_relayer": "0x0",
    "expired": "0x0",
    "stale_pool": "0x0",
    "unicode_419": "0x1",
    "unicode_420": "0x1",
    "composed": "0x1",
}
EXPECTED_ERROR = {
    "duplicate_other_relayer": "0x756688fe",
    "expired": "0x392334ed",
    "stale_pool": "0x826243be",
}
EXPECTED_COSTS = {
    "first_relayer": ["0.0017117", "0.0085585", "0.0171170", "0.0342340"],
    "duplicate_other_relayer": ["0.0005828", "0.0029138", "0.0058275", "0.0116550"],
    "expired": ["0.0005794", "0.0028972", "0.0057945", "0.0115890"],
    "stale_pool": ["0.0006475", "0.0032374", "0.0064747", "0.0129494"],
    "unicode_420": ["0.0096319", "0.0481594", "0.0963188", "0.1926376"],
}
EXPECTED_OTHER_DELTAS = [1666666666666666666666, 3333333333333333333333]


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

    # The recomputed section 2 values must equal the document's table.
    for label in LABELS:
        r = rows[label]
        assert r["gas_used"] == EXPECTED_GAS[label], f"{label}: gas mismatch"
        assert r["calldata_bytes"] == EXPECTED_CALLDATA[label], f"{label}: calldata mismatch"
        assert r["status"] == EXPECTED_STATUS[label], f"{label}: status mismatch"
        if label in EXPECTED_ERROR:
            assert r["error"] == EXPECTED_ERROR[label], f"{label}: error mismatch"

    print("label | status | error | calldata_bytes | gas_used | state_unchanged")
    for label in LABELS:
        r = rows[label]
        print(f"{label} | {r['status']} | {r['error']} | "
              f"{r['calldata_bytes']} | {r['gas_used']} | {r['state_unchanged']}")

    print("\nlabel | gas_used | " + " | ".join(f"{p} gwei" for p in PRICES_GWEI))
    for label in LABELS:
        g = rows[label]["gas_used"]
        # Exact arithmetic only: integer wei, then Decimal displayed at
        # 7 places with ROUND_HALF_EVEN named explicitly. No binary
        # floating point is used anywhere in this script.
        values = [
            (Decimal(g * p * 10**9) / Decimal(10**18)).quantize(
                Decimal('0.0000001'), rounding=ROUND_HALF_EVEN)
            for p in PRICES_GWEI
        ]
        # The section 3 figures must equal the document's table exactly.
        if label in EXPECTED_COSTS:
            assert [str(v) for v in values] == EXPECTED_COSTS[label], \
                f"{label}: sensitivity figures differ from the document"
        print(f"{label} | {g} | " + " | ".join(f"{v} ETH" for v in values))

    # Revert cases must leave contract state unchanged.
    for label in ("duplicate_other_relayer", "expired", "stale_pool"):
        assert rows[label]["state_unchanged"], f"{label}: state changed on revert"
        assert rows[label]["status"] == "0x0", f"{label}: expected revert status"
    assert rows["first_relayer"]["status"] == "0x1", "first_relayer: expected success"

    # Fee accounting for the successful short post. The other accounts'
    # increases (not their final balances) and the conservation of the
    # fee are asserted: poster decrease == increases + dust added.
    first = next(r for r in summary["transactions"] if r["label"] == "first_relayer")
    before, after = first["before"], first["after"]
    poster_delta = int(after["credits"][0]) - int(before["credits"][0])
    assert poster_delta == -FEE_BASE_UNITS, f"poster delta {poster_delta}"
    other_deltas = [int(after["credits"][i]) - int(before["credits"][i]) for i in (1, 2)]
    assert other_deltas == EXPECTED_OTHER_DELTAS, f"other deltas {other_deltas}"
    dust_delta = int(after["poolDust"]) - int(before["poolDust"])
    assert dust_delta == 1, "dust delta != 1"
    assert -poster_delta == other_deltas[0] + other_deltas[1] + dust_delta, \
        "fee is not conserved: poster decrease != increases + dust"
    assert before["nonces"] == ["0", "0", "0"] and after["nonces"] == ["1", "0", "0"]
    assert before["messageCount"] == "0" and after["messageCount"] == "1"

    print("\nAll assertions passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
