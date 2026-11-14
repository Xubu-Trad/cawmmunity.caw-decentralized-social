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

Round 2 (R-01 HOLD follow-up, 2026-11-11):

  7. receipt gasUsed changed on a transaction       -> exit 1 (FAIL)
     outside the bounded set (receipts are flat;
     the values are really read now)
  8. receipt status flipped                         -> exit 1 (FAIL)
  9. required token-code readback replaced by an    -> exit 1 (FAIL)
     unrelated eth_getCode call (same method, same
     count, different address)
 10. null receipt poll appended AFTER that          -> exit 1 (FAIL)
     transaction's final receipt
 11. non-null receipt poll moved BEFORE its         -> exit 1 (FAIL)
     transaction's send
 12. an allowed transaction hash consistently       -> exit 1 (FAIL)
     rewritten across every related record (the
     pinned-pair values in the checker reject it)

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


def mutate_receipt_gas(trace):
    receipt = trace["transactions"][0]["receipt"]
    receipt["gasUsed"] = hex(int(receipt["gasUsed"], 16) + 1)


def mutate_receipt_status(trace):
    receipt = trace["transactions"][0]["receipt"]
    receipt["status"] = "0x0" if receipt["status"] == "0x1" else "0x1"


def mutate_token_code_readback(trace):
    for record in trace["local_calls"]:
        req = record.get("request") or {}
        if req.get("method") == "eth_getCode" and record.get("label") == "installed_token":
            req["params"][0] = "0x0000000000000000000000000000000000000001"
            return
    raise AssertionError("installed_token eth_getCode record not found")


def _first_receipted_hash(trace):
    for record in trace["local_calls"]:
        req = record.get("request") or {}
        if req.get("method") == "eth_getTransactionReceipt" and (
            record.get("response") or {}
        ).get("result") is not None:
            return req["params"][0]
    raise AssertionError("no receipted transaction found")


def mutate_late_null_poll(trace):
    tx_hash = _first_receipted_hash(trace)
    trace["local_calls"].append(call_record(
        "late.receipt99", "eth_getTransactionReceipt", [tx_hash], None))


def mutate_poll_before_send(trace):
    calls = trace["local_calls"]
    send_index = {}
    for i, record in enumerate(calls):
        req = record.get("request") or {}
        res = record.get("response") or {}
        if req.get("method") == "eth_sendTransaction" and isinstance(
            res.get("result"), str
        ):
            send_index.setdefault(res["result"], i)
    for i, record in enumerate(calls):
        req = record.get("request") or {}
        res = record.get("response") or {}
        if (
            req.get("method") == "eth_getTransactionReceipt"
            and res.get("result") is not None
        ):
            tx_hash = req["params"][0]
            if tx_hash in send_index and send_index[tx_hash] < i:
                poll = calls.pop(i)
                calls.insert(send_index[tx_hash], poll)
                return
    raise AssertionError("no movable receipt poll found")


def mutate_consistent_hash_rewrite(trace):
    old = None
    for case in trace["cases"]:
        if case["label"] == "initial_post":
            old = case["transaction_hash"]
            break
    if old is None:
        raise AssertionError("case initial_post not found")
    new = "0x" + "1" * 64

    def rewrite(obj):
        if isinstance(obj, str):
            return obj.replace(old, new)
        if isinstance(obj, list):
            return [rewrite(x) for x in obj]
        if isinstance(obj, dict):
            return {k: rewrite(v) for k, v in obj.items()}
        return obj

    trace.update(rewrite(trace))


def mutate_epoch_substitution(trace):
    epoch = next(c for c in trace["local_calls"] if c["label"] == "initial_post.epoch")
    pool = next(c for c in trace["local_calls"] if c["label"] == "initial_post.pool")
    for key in ("request", "response", "raw_response"):
        epoch[key] = copy.deepcopy(pool[key])


def mutate_epoch_response(trace):
    call = next(c for c in trace["local_calls"] if c["label"] == "initial_post.epoch")
    call["response"]["result"] = "0x" + "0" * 63 + "1"
    call["raw_response"] = json.dumps(call["response"])


def mutate_signed_dry_substitution(trace):
    dry = next(c for c in trace["local_calls"] if c["label"] == "initial_post.dry")
    pool = next(c for c in trace["local_calls"] if c["label"] == "initial_post.pool")
    for key in ("request", "response", "raw_response"):
        dry[key] = copy.deepcopy(pool[key])


def add_preterminal_null_poll(trace):
    for index, call in enumerate(trace["local_calls"]):
        if (call["request"]["method"] == "eth_getTransactionReceipt"
                and call["response"].get("result") is not None):
            extra = copy.deepcopy(call)
            extra["response"]["result"] = None
            extra["raw_response"] = json.dumps(extra["response"])
            trace["local_calls"].insert(index, extra)
            return
    raise AssertionError("no terminal receipt found")



def mutate_receipt_envelope(trace, kind):
    # Preserve the exact counterexample and update raw_response consistently.
    call = next(c for c in trace["local_calls"]
                if c["label"] == "deposit_2.receipt0")
    assert call["request"]["method"] == "eth_getTransactionReceipt"
    assert call["response"]["result"] is None
    response = call["response"]
    if kind != "error_with_null":
        response.pop("result")
    if kind.startswith("error"):
        response["error"] = {"code": -32000,
                             "message": "synthetic unavailable receipt service"}
    call["raw_response"] = json.dumps(response)


def mutate_nonreceipt_label(trace, label=None, method=None):
    for call in trace["local_calls"]:
        if ((label is not None and call["label"] == label)
                or (method is not None and call["request"]["method"] == method)):
            call["label"] += ".receipt999"
            return
    raise AssertionError("target non-receipt call not found")


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
    scenario("receipt gasUsed change outside the bounded set is rejected", 1,
             ind_mutator=mutate_receipt_gas)
    scenario("receipt status change is rejected", 1,
             ind_mutator=mutate_receipt_status)
    scenario("token-code readback replaced by unrelated call is rejected", 1,
             ind_mutator=mutate_token_code_readback)
    scenario("null receipt poll after the final receipt is rejected", 1,
             ind_mutator=mutate_late_null_poll)
    scenario("receipt poll before its transaction send is rejected", 1,
             ind_mutator=mutate_poll_before_send)
    scenario("consistently rewritten allowed tx hash is rejected", 1,
             ind_mutator=mutate_consistent_hash_rewrite)
    scenario("deterministic epoch read replaced by pool read is rejected", 1,
             ind_mutator=mutate_epoch_substitution)
    scenario("deterministic epoch response change is rejected", 1,
             ind_mutator=mutate_epoch_response)
    scenario("signed dry-call replacement is rejected by fixed-pair pin", 1,
             ind_mutator=mutate_signed_dry_substitution)
    scenario("legitimate preterminal null polling remains accepted", 0,
             ind_mutator=add_preterminal_null_poll)
    scenario("epoch eth_call receipt-like label suffix is rejected", 1,
             ind_mutator=lambda t: mutate_nonreceipt_label(t, label="initial_post.epoch"))
    scenario("signed digest receipt-like label suffix is rejected", 1,
             ind_mutator=lambda t: mutate_nonreceipt_label(t, label="initial_post.contract_digest"))
    scenario("eth_getCode receipt-like label suffix is rejected", 1,
             ind_mutator=lambda t: mutate_nonreceipt_label(t, method="eth_getCode"))

    scenario("receipt error without result is rejected", 1,
             ind_mutator=lambda t: mutate_receipt_envelope(t, "error_without_result"))
    scenario("receipt error plus null result is rejected", 1,
             ind_mutator=lambda t: mutate_receipt_envelope(t, "error_with_null"))
    scenario("receipt response missing result is rejected", 1,
             ind_mutator=lambda t: mutate_receipt_envelope(t, "missing_result"))

    # R-05: reject malformed response types before helpers inspect fields.
    # Exit 1 alone is insufficient: require structured FAIL and no traceback.
    retained = json.loads(RETAINED_TRACE.read_text())
    for side in ("retained", "independent"):
        for response_name, response in (("string", "malformed"),
                                        ("array", ["malformed"])):
            ret = copy.deepcopy(retained)
            ind = copy.deepcopy(independent)
            trace = ret if side == "retained" else ind
            call = next(c for c in trace["local_calls"]
                        if c["label"] == "deposit_2.receipt0")
            call["response"] = response
            call["raw_response"] = json.dumps(response)
            with tempfile.TemporaryDirectory() as tmp:
                ret_path = Path(tmp) / "retained.json"
                ind_path = Path(tmp) / "independent.json"
                out_path = Path(tmp) / "out.json"
                ret_path.write_text(json.dumps(ret))
                ind_path.write_text(json.dumps(ind))
                proc = subprocess.run(
                    [sys.executable, str(SCRIPT),
                     "--retained-trace", str(ret_path),
                     "--retained-summary", str(RETAINED_SUMMARY),
                     "--independent-trace", str(ind_path),
                     "--out", str(out_path)],
                    capture_output=True, text=True)
                try:
                    output = json.loads(out_path.read_text())
                except (OSError, ValueError):
                    output = {}
                checks = output.get("checks", [])
                ok = (proc.returncode == 1
                      and output.get("verdict") == "FAIL"
                      and any(c.get("check") == "receipt_response_envelopes"
                              and c.get("status") == "DIFFER"
                              and f"{side}: invalid receipt response envelope"
                              in c.get("detail", "") for c in checks)
                      and "invalid receipt response envelope" in proc.stdout
                      and "Traceback" not in proc.stderr)
            results.append(ok)
            print(f"{'PASS' if ok else 'FAIL'}: {side} {response_name} receipt "
                  "produces structured rejection without traceback")

    if all(results):
        print(f"All {len(results)} comparison regression tests passed.")
        return 0
    print(f"{results.count(False)} of {len(results)} tests FAILED.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
