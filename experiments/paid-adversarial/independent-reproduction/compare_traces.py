#!/usr/bin/env python3
"""Compare the retained alpha.21 adversarial-regression trace with an
independent re-run trace (Xubu-Trad/cawmmunity.caw-decentralized-social,
Issue #2).

Scope: this script compares two existing execution traces. It does NOT
execute an EVM, does NOT authenticate a chain, and does NOT re-run the
experiment. Internal accounting/receipt consistency of a single trace is
the job of the repository's offline checker
(reference/paid-adversarial-evidence.mjs, `validateEvidence`); this script
only checks that the independent trace agrees with the retained one on
every deterministic outcome, and classifies the remaining differences.

Usage:
  python3 compare_traces.py \
      --retained-trace retained/execution-trace.json \
      --retained-summary retained/execution-summary.json \
      --independent-trace independent-run.json \
      [--experiment-dir DIR]   # optional: verify input files against the
                               # SHA-256 values recorded in the traces
      [--out comparison-result.json]

Exit code: 0 when every deterministic check MATCHes and all differences
fall in the expected nondeterministic set; 1 otherwise.
Standard library only. Python 3.10+.
"""

import argparse
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

MATCH = "MATCH"
DIFFER = "DIFFER"
EXPECTED_DIFFERENCE = "EXPECTED_DIFFERENCE"
NOT_COMPARABLE = "NOT_COMPARABLE"


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def receipt_status_gas(tx):
    receipt = tx.get("receipt") or {}
    result = receipt.get("result") if isinstance(receipt, dict) else None
    if isinstance(result, dict):
        return (result.get("status"), result.get("gasUsed"))
    return (None, None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--retained-trace", required=True)
    ap.add_argument("--retained-summary", required=True)
    ap.add_argument("--independent-trace", required=True)
    ap.add_argument("--experiment-dir")
    ap.add_argument("--out")
    args = ap.parse_args()

    ret = json.loads(Path(args.retained_trace).read_text())
    ind = json.loads(Path(args.independent_trace).read_text())
    summary = json.loads(Path(args.retained_summary).read_text())

    checks = []

    def record(name, status, detail):
        checks.append({"check": name, "status": status, "detail": detail})

    # 1. Case PASS/FAIL agreement -------------------------------------------
    ret_pass = [c["pass"] for c in ret["cases"]]
    ind_pass = [c["pass"] for c in ind["cases"]]
    record(
        "case_pass_fail",
        MATCH if ret_pass == ind_pass and all(ind_pass) else DIFFER,
        f"cases retained={len(ret_pass)} independent={len(ind_pass)}; "
        f"all pass in both: {all(ret_pass) and all(ind_pass)}",
    )

    # 2. Case fields equality (transaction hash excluded: see check 8) -----
    def strip(case):
        return {k: v for k, v in case.items() if k != "transaction_hash"}

    field_diffs = [
        a["label"]
        for a, b in zip(ret["cases"], ind["cases"])
        if strip(a) != strip(b)
    ]
    record(
        "case_fields_excluding_tx_hash",
        MATCH if not field_diffs and len(ret["cases"]) == len(ind["cases"]) else DIFFER,
        f"cases differing in label/expected/effect/error/before/after: {field_diffs}",
    )

    # 3. Rejection state invariance -----------------------------------------
    def rejection_stats(trace):
        rejected = [c for c in trace["cases"] if not c["expected_success"]]
        unchanged = sum(1 for c in rejected if c["before"] == c["after"])
        return len(rejected), unchanged

    rr, ru = rejection_stats(ret)
    ir, iu = rejection_stats(ind)
    record(
        "rejections_state_invariant",
        MATCH if (rr, ru) == (ir, iu) and ir == iu else DIFFER,
        f"rejected cases retained={rr} (state unchanged {ru}), "
        f"independent={ir} (state unchanged {iu})",
    )

    # 4. Successful paid posts ----------------------------------------------
    def posts(trace):
        return sum(
            1
            for c in trace["cases"]
            if c["effect"] == "post" and c["expected_success"]
        )

    record(
        "successful_posts",
        MATCH if posts(ret) == posts(ind) == summary["successful_paid_posts"] else DIFFER,
        f"successful post cases retained={posts(ret)} independent={posts(ind)} "
        f"summary={summary['successful_paid_posts']}",
    )

    # 5. Transaction receipts (status + gasUsed) -----------------------------
    ret_rc = [receipt_status_gas(t) for t in ret["transactions"]]
    ind_rc = [receipt_status_gas(t) for t in ind["transactions"]]
    record(
        "transaction_receipts_status_gas",
        MATCH if ret_rc == ind_rc else DIFFER,
        f"transactions retained={len(ret_rc)} independent={len(ind_rc)}; "
        f"receipt (status, gasUsed) pairs identical: {ret_rc == ind_rc}",
    )

    # 6. Final snapshot -------------------------------------------------------
    snap_equal = ret["final_snapshot"] == ind["final_snapshot"]
    snap = ind["final_snapshot"]
    record(
        "final_snapshot_40_slots",
        MATCH if snap_equal and len(snap) == 40 else DIFFER,
        f"40 slots identical: {snap_equal}; totalCredits slot[18]={snap[18]}, "
        f"dust slot[19]={snap[19]}, vault(token balance of probe) slot[21]={snap[21]}; "
        f"summary final credits={summary['final_credit_base_units']}, "
        f"vault={summary['final_vault_base_units']}, dust={summary['final_dust_base_units']}",
    )

    # 7. Input manifest --------------------------------------------------------
    inputs_equal = ret["inputs"] == ind["inputs"]
    detail = f"input entries retained={len(ret['inputs'])} independent={len(ind['inputs'])}; identical: {inputs_equal}"
    status = MATCH if inputs_equal else DIFFER
    if args.experiment_dir:
        base = Path(args.experiment_dir)
        bad = []
        for name, expected in ind["inputs"].items():
            p = base / name
            if not p.is_file():
                bad.append(f"{name}: missing")
            elif sha256_file(p) != expected:
                bad.append(f"{name}: sha256 mismatch")
        detail += f"; on-disk files verified against manifest: {len(ind['inputs']) - len(bad)}/{len(ind['inputs'])} ok"
        if bad:
            status = DIFFER
            detail += f"; problems: {bad}"
    record("inputs_manifest_16_files", status, detail)

    # 8. Transaction hash differences (nondeterministic) -----------------------
    hash_diffs = [
        a["label"]
        for a, b in zip(ret["cases"], ind["cases"])
        if a["transaction_hash"] != b["transaction_hash"]
    ]
    record(
        "transaction_hash_differences",
        EXPECTED_DIFFERENCE,
        f"{len(hash_diffs)}/72 case transaction hashes differ "
        f"(signed content depends on block timestamps): {hash_diffs}",
    )

    # 9. RPC call counts (nondeterministic polling) -----------------------------
    def method_hist(trace):
        return Counter((c.get("request") or {}).get("method") for c in trace["local_calls"])

    def receipt0_nulls(trace):
        return sum(
            1
            for c in trace["local_calls"]
            if str(c.get("label", "")).endswith(".receipt0")
            and (c.get("response") or {}).get("result") is None
        )

    mr, mi = method_hist(ret), method_hist(ind)
    method_diffs = {
        k: (mr.get(k, 0), mi.get(k, 0))
        for k in set(mr) | set(mi)
        if mr.get(k, 0) != mi.get(k, 0)
    }
    record(
        "rpc_call_counts",
        EXPECTED_DIFFERENCE,
        f"local calls retained={len(ret['local_calls'])} independent={len(ind['local_calls'])}; "
        f"method count differences (retained, independent): {method_diffs}; "
        f"first receipt polls returning null: retained={receipt0_nulls(ret)} "
        f"independent={receipt0_nulls(ind)}",
    )

    # 10. Whole-file SHA-256 ------------------------------------------------------
    ret_hash = sha256_file(args.retained_trace)
    ind_hash = sha256_file(args.independent_trace)
    record(
        "trace_file_sha256",
        EXPECTED_DIFFERENCE,
        f"retained trace file sha256={ret_hash} "
        f"(summary capture_sha256={summary['capture_sha256']}, "
        f"consistent: {ret_hash == summary['capture_sha256']}); "
        f"independent trace file sha256={ind_hash} "
        f"(differs because the trace contains run timestamps)",
    )

    # 11. Node configuration vs performance counters --------------------------------
    config_keys = (
        "anvil_version",
        "anvil_sha256",
        "anvil_bytes",
        "local_chain_id",
        "hardfork",
        "host",
        "port",
    )
    config_equal = all(ret["node"].get(k) == ind["node"].get(k) for k in config_keys)
    perf_keys = ("wall_seconds", "peak_node_memory_bytes", "node_output_bytes", "local_request_count")
    perf = {k: (ret["node"].get(k), ind["node"].get(k)) for k in perf_keys}
    record(
        "node_configuration",
        MATCH if config_equal else DIFFER,
        f"anvil/chain config identical: {config_equal}; "
        f"performance counters (retained, independent): {perf}",
    )

    # 12. Run completeness flags ------------------------------------------------------
    flags_ok = all(
        t["complete"] is True and t.get("failure") is None
        and t["synthetic_only"] is True and t["real_wallet_used"] is False
        for t in (ret, ind)
    )
    record(
        "run_completeness_flags",
        MATCH if flags_ok else DIFFER,
        "both traces: complete=true, failure=null, synthetic_only=true, real_wallet_used=false",
    )

    failed = [c for c in checks if c["status"] == DIFFER]
    verdict = "PASS" if not failed else "FAIL"
    result = {
        "schema": "caw-paid-adversarial-comparison/1",
        "baseline_commit": ind["baseline_commit"],
        "verdict": verdict,
        "checks": checks,
    }
    for c in checks:
        print(f"[{c['status']}] {c['check']}: {c['detail']}")
    print(f"VERDICT: {verdict}")
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2) + "\n")
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
