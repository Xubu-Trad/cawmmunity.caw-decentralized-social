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

# Cases whose single transaction is a wallet-signed submission. The signed
# payload commits to the block timestamp, so the transaction hash is
# expected to differ between two runs even when every deterministic
# outcome (case fields, before/after snapshots, receipt status/gasUsed)
# is identical. A differing transaction hash in ANY other case is a
# failure, and in these cases the hash is the ONLY field allowed to
# differ (enforced by checks 2 and 5). This list is the recorded set
# from the retained-vs-independent comparison of 2026-11-04.
EXPECTED_TX_HASH_DIFF_CASES = frozenset({
    "initial_post",
    "duplicate_other_submitter",
    "underbacked_post",
    "old_epoch_after_wallet_transfer",
    "wallet_mode_0",
    "wallet_mode_1",
    "wallet_mode_2",
    "wallet_mode_3",
    "wallet_mode_4",
    "wallet_mode_5",
    "wallet_signature_bytes_0",
    "wallet_signature_bytes_4096",
    "wallet_signature_bytes_4097",
    "wallet_nested_1_caught",
    "wallet_nested_2_caught",
    "wallet_nested_3_caught",
    "wallet_nested_4_caught",
    "wallet_nested_5_caught",
    "wallet_nested_1_propagate",
    "wallet_nested_2_propagate",
    "wallet_nested_3_propagate",
    "wallet_nested_4_propagate",
    "wallet_nested_5_propagate",
    "wallet_registry_caught",
    "wallet_registry_propagate",
})

RECEIPT_METHOD = "eth_getTransactionReceipt"


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

    # 8. Transaction hash differences (bounded exception) ----------------------
    hash_diffs = [
        a["label"]
        for a, b in zip(ret["cases"], ind["cases"])
        if a["transaction_hash"] != b["transaction_hash"]
    ]
    unexplained_hash_diffs = [l for l in hash_diffs if l not in EXPECTED_TX_HASH_DIFF_CASES]
    if len(ret["cases"]) != len(ind["cases"]):
        hash_status = DIFFER
    elif unexplained_hash_diffs:
        hash_status = DIFFER
    elif hash_diffs:
        hash_status = EXPECTED_DIFFERENCE
    else:
        hash_status = MATCH
    record(
        "transaction_hash_differences",
        hash_status,
        f"{len(hash_diffs)}/{len(ret['cases'])} case transaction hashes differ; "
        f"all differing cases are within the bounded signed-submission set "
        f"({len(EXPECTED_TX_HASH_DIFF_CASES)} cases whose signed payload commits "
        f"to the block timestamp): {not unexplained_hash_diffs}; "
        f"unexplained differences: {unexplained_hash_diffs}; differing: {hash_diffs}",
    )

    # 9. RPC call counts (enforced allowlist) -------------------------------------
    def method_hist(trace):
        return Counter((c.get("request") or {}).get("method") for c in trace["local_calls"])

    def null_receipt_polls(trace):
        return [
            c for c in trace["local_calls"]
            if (c.get("request") or {}).get("method") == RECEIPT_METHOD
            and (c.get("response") or {}).get("result") is None
        ]

    def eventual_receipts_ok(trace):
        """Every transaction hash that was polled and returned null must
        also appear with a non-null receipt response in the same trace."""
        nonnull_hashes = {
            (c.get("request") or {}).get("params", [None])[0]
            for c in trace["local_calls"]
            if (c.get("request") or {}).get("method") == RECEIPT_METHOD
            and (c.get("response") or {}).get("result") is not None
        }
        return all(
            (c.get("request") or {}).get("params", [None])[0] in nonnull_hashes
            for c in null_receipt_polls(trace)
        )

    mr, mi = method_hist(ret), method_hist(ind)
    method_sets_equal = set(mr) == set(mi)
    other_method_diffs = {
        k: (mr.get(k, 0), mi.get(k, 0))
        for k in set(mr) | set(mi)
        if k != RECEIPT_METHOD and mr.get(k, 0) != mi.get(k, 0)
    }
    receipt_delta = mi.get(RECEIPT_METHOD, 0) - mr.get(RECEIPT_METHOD, 0)
    null_delta = len(null_receipt_polls(ind)) - len(null_receipt_polls(ret))
    eventual_ok = eventual_receipts_ok(ret) and eventual_receipts_ok(ind)
    rpc_problems = []
    if not method_sets_equal:
        rpc_problems.append(
            f"method sets differ (retained only: {sorted(set(mr) - set(mi))}, "
            f"independent only: {sorted(set(mi) - set(mr))})"
        )
    if other_method_diffs:
        rpc_problems.append(f"non-receipt method count differences: {other_method_diffs}")
    if receipt_delta != null_delta:
        rpc_problems.append(
            f"receipt-poll count difference ({receipt_delta}) is not fully explained "
            f"by the null-poll difference ({null_delta})"
        )
    if not eventual_ok:
        rpc_problems.append("a null receipt poll has no eventual non-null receipt in its trace")
    if rpc_problems:
        rpc_status = DIFFER
    elif receipt_delta == 0:
        rpc_status = MATCH
    else:
        rpc_status = EXPECTED_DIFFERENCE
    record(
        "rpc_call_counts",
        rpc_status,
        f"local calls retained={len(ret['local_calls'])} independent={len(ind['local_calls'])}; "
        f"method sets identical: {method_sets_equal}; "
        f"receipt-poll difference: {receipt_delta}; null receipt polls "
        f"retained={len(null_receipt_polls(ret))} independent={len(null_receipt_polls(ind))}; "
        f"every null-polled transaction has an eventual receipt: {eventual_ok}; "
        f"problems: {rpc_problems}",
    )

    # 10. Whole-file SHA-256 and the retained capture hash -------------------------
    ret_hash = sha256_file(args.retained_trace)
    ind_hash = sha256_file(args.independent_trace)
    record(
        "retained_capture_sha256",
        MATCH if ret_hash == summary["capture_sha256"] else DIFFER,
        f"sha256 of the retained trace file={ret_hash}; "
        f"summary capture_sha256={summary['capture_sha256']}; "
        f"equal: {ret_hash == summary['capture_sha256']}",
    )
    record(
        "trace_file_sha256",
        EXPECTED_DIFFERENCE,
        f"independent trace file sha256={ind_hash} "
        f"(differs from the retained file because the trace contains run timestamps)",
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
