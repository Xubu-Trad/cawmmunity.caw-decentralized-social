#!/usr/bin/env python3
"""Negative regression tests for compare_traces.py (Issue #2, PR #16).

Requested in review: the tightened acceptance rules of the cross-trace
comparison must be guarded by permanent rejection tests, not only by
the genuine pair passing. Each test below mutates a COPY of one of the
packaged traces (the packaged files themselves are never modified),
runs compare_traces.py with the same arguments used to produce
comparison-result.json, and asserts the exit code:

  1. genuine pair                                   -> exit 0 (PASS)
  2. unknown RPC method record appended             -> exit 1 (FAIL)
     (an `eth_unexpected` local call in the independent trace)
  3. retained summary capture_sha256 zeroed         -> exit 1 (FAIL)
  4. transaction hash changed outside the bounded   -> exit 1 (FAIL)
     signed-submission set (case deposit_token_mode_1)
  5. fake null receipt poll with no eventual        -> exit 1 (FAIL)
     receipt for that transaction
  6. duplicated non-receipt RPC record (eth_call)   -> exit 1 (FAIL)

Usage: python3 test_compare_traces.py
Exit code: 0 when every expectation holds; 1 otherwise.
Standard library only. Python 3.10+.
"""

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "compare_traces.py"
RETAINED_TRACE = HERE / "retained" / "execution-trace.json"
RETAINED_SUMMARY = HERE / "retained" / "execution-summary.json"
INDEPENDENT_TRACE = HERE / "independent-run.json"

ZERO64 = "0" * 64
FAKE_HASH = "0x" + "f" * 64


def run_checker(retained_summary_path, independent_trace_path, out_path):
    proc = subprocess.run(
        [sys.executable, str(SCRIPT),
         "--retained-trace", str(RETAINED_TRACE),
         "--retained-summary", str(retained_summary_path),
         "--independent-trace", str(independent_trace_path),
         "--out", str(out_path)],
        capture_output=True, text=True)
    return proc.returncode


def call_record(label, method, params, result):
    return {
        "label": label,
        "request": {"jsonrpc": "2.0", "id": 999999, "method": method,
                    "params": params},
        "response": {"jsonrpc": "2.0", "id": 999999, "result": result},
        "raw_response": json.dumps({"jsonrpc": "2.0", "id": 999999,
                                    "result": result}),
    }


def mutate_unknown_method(trace):
    trace["local_calls"].append(
        call_record("unexplained", "eth_unexpected", [], None))


def mutate_tx_hash(trace):
    for case in trace["cases"]:
        if case["label"] == "deposit_token_mode_1":
            case["transaction_hash"] = "0x" + "0" * 63 + "1"
            return
    raise AssertionError("case deposit_token_mode_1 not found")


def mutate_fake_null_poll(trace):
    trace["local_calls"].append(call_record(
        "fake.receipt0", "eth_getTransactionReceipt", [FAKE_HASH], None))


def mutate_duplicate_eth_call(trace):
    for record in trace["local_calls"]:
        if (record.get("request") or {}).get("method") == "eth_call":
            trace["local_calls"].append(copy.deepcopy(record))
            return
    raise AssertionError("no eth_call record found")


def main():
    independent = json.loads(INDEPENDENT_TRACE.read_text())
    summary = json.loads(RETAINED_SUMMARY.read_text())

    results = []

    def scenario(name, expected_exit, ind_mutator=None, summary_mutator=None):
        ind = copy.deepcopy(independent)
        summ = copy.deepcopy(summary)
        if ind_mutator is not None:
            ind_mutator(ind)
        if summary_mutator is not None:
            summary_mutator(summ)
        with tempfile.TemporaryDirectory() as tmp:
            ind_path = Path(tmp) / "independent-run.json"
            summ_path = Path(tmp) / "execution-summary.json"
            ind_path.write_text(json.dumps(ind))
            summ_path.write_text(json.dumps(summ))
            code = run_checker(summ_path, ind_path, Path(tmp) / "out.json")
        ok = code == expected_exit
        results.append(ok)
        print(f"{'PASS' if ok else 'FAIL'}: {name} "
              f"(checker exit {code}, expected {expected_exit})")

    scenario("genuine pair is accepted", 0)
    scenario("unknown RPC method is rejected", 1,
             ind_mutator=mutate_unknown_method)
    scenario("capture_sha256 mismatch is rejected", 1,
             summary_mutator=lambda s: s.update(capture_sha256=ZERO64))
    scenario("tx hash change outside the bounded set is rejected", 1,
             ind_mutator=mutate_tx_hash)
    scenario("null receipt poll without eventual receipt is rejected", 1,
             ind_mutator=mutate_fake_null_poll)
    scenario("duplicated non-receipt RPC record is rejected", 1,
             ind_mutator=mutate_duplicate_eth_call)

    if all(results):
        print(f"All {len(results)} comparison regression tests passed.")
        return 0
    print(f"{results.count(False)} of {len(results)} tests FAILED.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
