#!/usr/bin/env python3
import csv
import hashlib
import json
import sys
from fractions import Fraction
from pathlib import Path

w, o, commit = sys.argv[1:]
w, o = Path(w), Path(o)

source_path = w / "experiments/paid-action/CawPaidActionProbe.sol"
source = source_path.read_text(encoding="utf-8")

assert "uint256 public constant FEE = 5000 * 10 ** 18;" in source
assert "if (id != payer) eligible += stakes[id];" in source
assert "uint256 amount = FEE * stakes[id] / eligible;" in source
assert "dust = FEE - paid;" in source

UNIT = 10**18
FEE = 5000 * UNIT

accounts = [
    {"id": 1, "owner": "A", "stake": 10 * UNIT},
    {"id": 2, "owner": "A", "stake": 1 * UNIT},
    {"id": 3, "owner": "B", "stake": 2 * UNIT},
]
payer = accounts[0]

def calculate(mode):
    if mode == "exclude_payer_account":
        eligible = [
            a for a in accounts
            if a["id"] != payer["id"]
        ]
    elif mode == "exclude_payer_wallet":
        eligible = [
            a for a in accounts
            if a["owner"] != payer["owner"]
        ]
    else:
        raise ValueError("unsupported policy")

    denominator = sum(a["stake"] for a in eligible)
    assert denominator > 0

    eligible_ids = {a["id"] for a in eligible}
    amounts = {}

    for a in accounts:
        if a["id"] in eligible_ids:
            amount = FEE * a["stake"] // denominator

            oracle = int(Fraction(
                FEE * a["stake"], denominator
            ))
            assert amount == oracle
        else:
            amount = 0

        amounts[a["id"]] = amount

    dust = FEE - sum(amounts.values())

    assert dust >= 0
    assert sum(amounts.values()) + dust == FEE
    assert amounts[1] == 0

    return {
        "mode": mode,
        "eligible_ids": sorted(eligible_ids),
        "eligible_stake_base_units": str(denominator),
        "allocations": {
            str(k): str(v) for k, v in amounts.items()
        },
        "dust_base_units": str(dust),
        "conservation": True,
    }

account = calculate("exclude_payer_account")
wallet = calculate("exclude_payer_wallet")

assert calculate("exclude_payer_account") == account
assert calculate("exclude_payer_wallet") == wallet

assert account["eligible_ids"] == [2, 3]
assert wallet["eligible_ids"] == [3]

assert int(account["allocations"]["2"]) == FEE // 3
assert int(account["allocations"]["3"]) == 2 * FEE // 3
assert account["dust_base_units"] == "1"

assert wallet["allocations"]["2"] == "0"
assert wallet["allocations"]["3"] == str(FEE)
assert wallet["dust_base_units"] == "0"

result = {
    "schema": "caw-c007-exclusion-comparison/1",
    "parent_commit": commit,
    "source_path": str(source_path.relative_to(w)),
    "source_sha256": hashlib.sha256(
        source_path.read_bytes()
    ).hexdigest(),
    "variable": "payer exclusion: NFT account versus wallet owner",
    "fee_base_units": str(FEE),
    "stake_unit": "18-decimal synthetic model units",
    "payer_account": 1,
    "accounts": accounts,
    "account_exclusion": account,
    "wallet_exclusion": wallet,
    "solidity_execution": False,
    "real_token_execution": False,
    "community_policy_adopted": False,
    "c001_registration": "BLOCKED",
    "c007_decision": "OPEN",
}

with (o / "results.json").open("x", encoding="utf-8") as f:
    json.dump(result, f, indent=2, sort_keys=True)
    f.write("\n")

with (o / "allocations.tsv").open(
    "x", encoding="utf-8", newline=""
) as f:
    writer = csv.writer(f, delimiter="\t")
    writer.writerow([
        "NFT", "OWNER", "STAKE_BASE_UNITS",
        "ACCOUNT_EXCLUSION_BASE_UNITS",
        "WALLET_EXCLUSION_BASE_UNITS",
    ])
    for a in accounts:
        k = str(a["id"])
        writer.writerow([
            k, a["owner"], a["stake"],
            account["allocations"][k],
            wallet["allocations"][k],
        ])

print("SOURCE_RULE=ACCOUNT_ID_EXCLUSION")
print("ACCOUNT_EXCLUSION=PASS")
print("WALLET_EXCLUSION=PASS")
print("CONSERVATION_BOTH=PASS")
print("RATIONAL_ORACLE_BOTH=PASS")
print("ACCOUNT_DUST_BASE_UNITS=1")
print("WALLET_DUST_BASE_UNITS=0")
print("SPEC_DECISION=OPEN")
print("PASS: C007 exclusion comparison reproduced")
