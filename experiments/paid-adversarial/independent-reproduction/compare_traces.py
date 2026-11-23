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
import re
import sys
from collections import Counter
from pathlib import Path

MATCH = "MATCH"
DIFFER = "DIFFER"
EXPECTED_DIFFERENCE = "EXPECTED_DIFFERENCE"
NOT_COMPARABLE = "NOT_COMPARABLE"

# Canonical signed-payload RPC record multisets of the packaged retained and
# independent captures, respectively. These bind permitted per-run differences
# without exempting arbitrary replacement content. Future evidence needs review.
PINNED_SIGNED_RPC_DIGESTS = (
    "b41a83a9b01db36afde940daf0baa45de21c688c1542e22cac3da22af3816f88",
    "28254ef52aa0bdf288d9c523101e8af665c003f99782bf168ac2238cb7359f40",
)

# Cases whose single transaction is a wallet-signed submission. The signed
# payload commits to the block timestamp, so the transaction hash is
# expected to differ between two runs even when every deterministic
# outcome (case fields, before/after snapshots, receipt status) is
# identical. Receipt gasUsed also differs slightly on a subset of
# these cases (check 5b enumerates the actual differences with both
# values; a gas difference on ANY other transaction is a failure).
# No cause for the gas differences is asserted anywhere in this
# package: the recorded fact is only that every one of them occurs on
# a transaction of this set, whose hash also differs. A differing transaction hash in ANY other
# case is a failure, and in these cases the hash is the ONLY case field
# allowed to differ (enforced by check 2). This list is the recorded set
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

# Pinned-pair binding (review round 2, 2026-11-11). The bounded exception
# above says WHICH transactions may carry a different hash in the
# independent trace; it does not say WHICH value that hash must have, so
# a trace whose allowed hashes were consistently rewritten everywhere
# would still pass. For THIS pinned evidence pair the expected
# independent values are therefore recorded here, keyed by transaction
# label: the 25 signed-submission cases plus their 3 companion payload
# transactions. These constants describe the 2026-11-04 independent run
# packaged here and nothing else: they are NOT a general acceptance rule
# for future runs, and a future run must replace them with its own
# recorded values before this script's verdict means anything for it.
PINNED_IND_TX_HASHES = {
    "initial_post": "0xc90b980e09b35c56ec0af676157b0832b75eee6f357f3490af5c66b3f1340d34",
    "duplicate_other_submitter": "0x30679e023899f4ea56882c7ee73a3b8da4fbb5b63de485e59ac7794f75d4aed2",
    "nested_payload": "0x079cdf8ce52819aefdd3cc8cf057f8d1a4248ec87ee886f44e3dc03fff26ede8",
    "underbacked_post": "0x1f2153b69bed7af630ad26e94d8cef5c6ad4cbdac3766b6fb0d6cb08055f5561",
    "old_epoch_after_wallet_transfer": "0xd2aa23f0ff197f2ac1b23264ff17178abb21d576302506ec52296b56ef5bb9fe",
    "wallet_mode_0": "0x3ecb55faa8a2edfec701060f58de776f5dadc30d607d9b6150aceda4eac77499",
    "wallet_mode_1": "0x9c2d4f29bd4b9fbcf3c0a4f8e41037b7b2274c244d893898e938bdb20a0133e1",
    "wallet_mode_2": "0xa0b8dab2a03ec1fb4c2859bd2bf8d4ea2837e4e6a28a513badb3e8ed41d587dc",
    "wallet_mode_3": "0x78ba9157edac80d8c3643ec017f066556f5b0065fb55051e433a66ab9aaac1fc",
    "wallet_mode_4": "0x6ebc15d4c5062d7d319154616798f7b09f967468b7640fe47c4827e8cf4ef845",
    "wallet_mode_5": "0xcc2c973958dcef191a7ffa135709aea0773122b5bdb10bf6c40ba884fa595f8b",
    "wallet_signature_bytes_0": "0x9068f17a55593a47aa58abf2b5b7c2e8c9d7494f451e36cade904bceba759f36",
    "wallet_signature_bytes_4096": "0x89f13d0a60e356be0188e479f38dbcfc396f53c84180f504f0a44a2dd2374ee1",
    "wallet_signature_bytes_4097": "0x6faddda3817f17190a64b81071fb0e7bc0ca2900f5129801b2ae9356a061b504",
    "wallet_nested_1_caught": "0x59ba53501e2bb2ee52cf9515302dbf42dc498d72fca8479c36aee71e4a87c0a2",
    "wallet_nested_2_caught": "0xe085c96b95b745ede3af89c79e18d4a43963dda12987b1b3182c3e9ffbe58279",
    "wallet_nested_3_caught": "0x237d399ef7c5532990bb3f53f7051f0654a3d78c1f1ee24819a4eaab3f5fbf4f",
    "wallet_nested_4_caught": "0x09b877a173173d9d5e4215158e5238fdc1b3de27c463e95324b4e0b69139ff36",
    "wallet_nested_5_caught": "0x0d44c2f7c80872518223250d075e1a6efdce2eef355a60776c731063fae0dbbb",
    "wallet_nested_5_caught.payload": "0x80e390ca2095f16a91c8dfb0424a068692d2399a3f3557dce02c710e73b33675",
    "wallet_nested_1_propagate": "0x2f548145d85175ef3042d58a230e1b74bff707c95b036ef75cf6072676c206a5",
    "wallet_nested_2_propagate": "0xeeca4b1e9aeacec9bd88b1ff021584b98f0bc71f536f5fab61b52c67c323224e",
    "wallet_nested_3_propagate": "0x1b856bb49334a4bac8c1ac9217e084e875164a3038d39fd1b1b3dbf013a17946",
    "wallet_nested_4_propagate": "0x4796dd58169276b5dc7ec60843dd88de4cdc3a1642b913e2e85be62af6ed3f17",
    "wallet_nested_5_propagate": "0x08b4b994f4882a12d82c0dbe0bf926c4ea7f64d5bf3157ecf10ae07844ac984d",
    "wallet_nested_5_propagate.payload": "0x3c4488d39e82d58abbb5ca2448a0dd262d5c69ef6a8781a581b59caa66087df3",
    "wallet_registry_caught": "0xcd86cdf8fba4c60dfed13b30bb9f6103f1408da41143e94b67055f7fbeb5c66c",
    "wallet_registry_propagate": "0x687adbfd9dc6d6dac5e34557caf3b3df07e30599296357ac9394d3612888e17f",
}

RECEIPT_METHOD = "eth_getTransactionReceipt"
SEND_METHOD = "eth_sendTransaction"


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def receipt_status_gas(tx):
    """Receipts in both traces are FLAT receipt objects: status and
    gasUsed are top-level fields of the receipt itself. (Review round 2:
    an earlier version of this helper read a nested receipt["result"]
    that never exists in these traces, so every pair compared as
    (None, None) and the check passed vacuously.)"""
    receipt = tx.get("receipt") or {}
    if isinstance(receipt, dict):
        return (receipt.get("status"), receipt.get("gasUsed"))
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

    # Reject receipt envelope types before helpers access response fields.
    # This validates parsed receipts only, not raw_response equivalence.
    bad = []
    for trace_name, trace in [("retained", ret), ("independent", ind)]:
        for call in trace["local_calls"]:
            if (call.get("request") or {}).get("method") != RECEIPT_METHOD:
                continue
            response = call.get("response")
            if not isinstance(response, dict) or "error" in response or "result" not in response:
                bad.append(f"{trace_name}: invalid receipt response envelope")
    if bad:
        result = {"schema": "caw-paid-adversarial-comparison/1",
                  "baseline_commit": ind["baseline_commit"], "verdict": "FAIL",
                  "checks": [{"check": "receipt_response_envelopes", "status": DIFFER,
                              "detail": "; ".join(bad)}]}
        if args.out:
            Path(args.out).write_text(json.dumps(result, indent=2) + "\n")
        print("[DIFFER] " + "; ".join(bad))
        print("VERDICT: FAIL")
        return 1

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

    # 5. Transaction receipts: status (exact) and gasUsed (bounded) ----------
    tx_labels_equal = [t["label"] for t in ret["transactions"]] == [
        t["label"] for t in ind["transactions"]
    ]
    ret_status = [receipt_status_gas(t)[0] for t in ret["transactions"]]
    ind_status = [receipt_status_gas(t)[0] for t in ind["transactions"]]
    record(
        "transaction_receipt_status",
        MATCH if tx_labels_equal and ret_status == ind_status else DIFFER,
        f"transactions retained={len(ret_status)} independent={len(ind_status)}; "
        f"transaction labels identical and in the same order: {tx_labels_equal}; "
        f"receipt status identical for every transaction: {ret_status == ind_status}",
    )
    gas_diffs = [
        (a["label"], receipt_status_gas(a)[1], receipt_status_gas(b)[1])
        for a, b in zip(ret["transactions"], ind["transactions"])
        if receipt_status_gas(a)[1] != receipt_status_gas(b)[1]
    ]
    gas_unexplained = [l for l, _, _ in gas_diffs if l not in EXPECTED_TX_HASH_DIFF_CASES]
    if not tx_labels_equal or gas_unexplained:
        gas_status = DIFFER
    elif gas_diffs:
        gas_status = EXPECTED_DIFFERENCE
    else:
        gas_status = MATCH
    record(
        "transaction_receipt_gas_used",
        gas_status,
        f"receipt gasUsed differences: {len(gas_diffs)} "
        f"(label, retained, independent): {gas_diffs}; "
        f"all differing transactions are within the bounded signed-submission "
        f"set (the set whose transaction hashes also differ; no cause for "
        f"the gas differences is asserted): "
        f"{not gas_unexplained}; unexplained differences: {gas_unexplained}",
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

    # 8b. Pinned-pair transaction hashes (review round 2) ---------------------
    # Every independent transaction hash is fully determined: it either
    # equals the retained hash, or its label is in PINNED_IND_TX_HASHES
    # and it equals the recorded value for this pinned pair. Within each
    # trace, a case's transaction_hash must also equal the receipt hash
    # of the transaction with the same label, so the pinned values bind
    # the case records as well as the transaction records.
    def case_receipt_consistency(trace):
        by_label = {t["label"]: t["receipt"].get("transactionHash") for t in trace["transactions"]}
        return [
            c["label"]
            for c in trace["cases"]
            if by_label.get(c["label"]) != c["transaction_hash"]
        ]

    pin_problems = []
    problem_labels = set()
    if not tx_labels_equal:
        pin_problems.append("transaction label sequences differ")
    pinned_used = []
    for a, b in zip(ret["transactions"], ind["transactions"]):
        ra = a["receipt"].get("transactionHash")
        rb = b["receipt"].get("transactionHash")
        if rb == ra:
            continue
        if PINNED_IND_TX_HASHES.get(b["label"]) == rb:
            pinned_used.append(b["label"])
        else:
            problem_labels.add(b["label"])
            pin_problems.append(
                f"{b['label']}: independent hash {rb} is neither the retained "
                f"hash nor the value pinned for this evidence pair"
            )
    for label in PINNED_IND_TX_HASHES:
        if label not in pinned_used and label not in problem_labels:
            pin_problems.append(f"{label}: pinned transaction missing or hash not differing as recorded")
    consistency_bad = case_receipt_consistency(ret) + case_receipt_consistency(ind)
    if consistency_bad:
        pin_problems.append(f"case hash != same-label receipt hash for: {consistency_bad}")
    record(
        "pinned_pair_transaction_hashes",
        DIFFER if pin_problems else EXPECTED_DIFFERENCE,
        f"independent transactions whose hash differs from the retained hash "
        f"and equals the value recorded for this pinned pair: {len(pinned_used)} "
        f"of {len(PINNED_IND_TX_HASHES)} pinned; every other independent "
        f"transaction hash equals the retained hash; case/receipt hash "
        f"consistency holds in both traces: {not consistency_bad}; "
        f"problems: {pin_problems}",
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
    # Xubu-Trad's receipt-envelope review: service errors are not pending polls.
    for trace_name, trace in [("retained", ret), ("independent", ind)]:
        for call in trace["local_calls"]:
            if (call.get("request") or {}).get("method") != RECEIPT_METHOD:
                continue
            response = call.get("response")
            if (not isinstance(response, dict) or "error" in response
                    or "result" not in response):
                rpc_problems.append(f"{trace_name}: invalid receipt response envelope")
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

    # 9b. RPC request identity (review round 2) --------------------------------
    # Check 9 compares method COUNTS only, so replacing a required call
    # with an unrelated call of the same method passed. Here the calls
    # themselves are compared as a multiset of (label, method, params,
    # result), with each trace's own transaction hashes first replaced
    # by their transaction labels so the two traces are comparable.
    # Bounded exemptions, all forced by the recorded evidence:
    # - receipt polls: covered by checks 9 and 9c (their results embed
    #   per-run block hashes and are not comparable verbatim);
    # - eth_getBlockByNumber results: block objects embed the block
    #   hash and timestamp (params are still compared);
    # - signed-payload eth_call phases and eth_sendTransaction only:
    #   calldata commits to timestamps. Deterministic reads such as
    #   .epoch and .pool remain content-compared even under these owners.
    #   Exempt records are additionally bound to this fixed evidence pair
    #   by their canonical content digests below, not accepted by count alone.
    # Call labels are "<owner>.<phase>". The owners whose eth_call /
    # eth_sendTransaction traffic embeds timestamp-committed signed
    # material are the signed-submission cases, plus the recorded
    # helper phases that prepare or submit their signed payloads:
    # "before_wallet_transfer" (payload for
    # old_epoch_after_wallet_transfer), "nested_post" and
    # "nested_payload" (the shared nested-payload submission used by
    # the wallet_nested_* cases; nested_payload is also one of the
    # pinned transactions in check 8b).
    signed_call_owners = EXPECTED_TX_HASH_DIFF_CASES | {
        "before_wallet_transfer",
        "nested_post",
        "nested_payload",
    }

    def signed_owner(label):
        base = label or ""
        for owner in signed_call_owners:
            if base == owner or base.startswith(owner + "."):
                return owner
        return None

    def signed_payload_call(base, method, owner):
        if owner is None:
            return False
        if method == SEND_METHOD:
            return True
        if method != "eth_call":
            return False
        return base in {
            owner + ".contract_digest", owner + ".recover27",
            owner + ".recover28", owner + ".dry", owner + ".payload.dry",
        }

    def hash_to_label(trace):
        mapping = {}
        for t in trace["transactions"]:
            mapping[t["receipt"].get("transactionHash")] = t["label"]
        for c in trace["cases"]:
            mapping[c["transaction_hash"]] = c["label"]
        return mapping

    def normalized(obj, mapping):
        if isinstance(obj, str):
            return f"<tx:{mapping[obj]}>" if obj in mapping else obj
        if isinstance(obj, list):
            return [normalized(x, mapping) for x in obj]
        if isinstance(obj, dict):
            return {k: normalized(v, mapping) for k, v in obj.items()}
        return obj

    def call_multisets(trace):
        mapping = hash_to_label(trace)
        checked = Counter()
        exempt_counts = Counter()
        exempt_records = []
        for call in trace["local_calls"]:
            req = call.get("request") or {}
            method = req.get("method")
            if method == RECEIPT_METHOD:
                continue
            # Receipt methods were handled above. Every other method keeps
            # its exact recorded label, including any receipt-like suffix.
            base = call.get("label")
            owner = signed_owner(call.get("label"))
            if signed_payload_call(base, method, owner):
                exempt_counts[(base, method)] += 1
                exempt_records.append([
                    base, method, req.get("params"),
                    (call.get("response") or {}).get("result"),
                ])
                continue
            params = json.dumps(normalized(req.get("params"), mapping), sort_keys=True)
            if method == "eth_getBlockByNumber":
                result = None
            else:
                result = json.dumps(
                    normalized((call.get("response") or {}).get("result"), mapping),
                    sort_keys=True,
                )
            checked[(base, method, params, result)] += 1
        encoded = sorted(json.dumps(x, sort_keys=True, separators=(",", ":"))
                         for x in exempt_records)
        digest = hashlib.sha256(json.dumps(encoded, separators=(",", ":")).encode()).hexdigest()
        return checked, exempt_counts, digest

    ret_checked, ret_exempt, ret_digest = call_multisets(ret)
    ind_checked, ind_exempt, ind_digest = call_multisets(ind)
    identity_problems = []
    # Exact per-run exceptions for the packaged pair, not future-run policy.
    if (ret_digest, ind_digest) != PINNED_SIGNED_RPC_DIGESTS:
        identity_problems.append("signed-payload RPC content differs from pinned pair")
    if ret_checked != ind_checked:
        only_ret = ret_checked - ind_checked
        only_ind = ind_checked - ret_checked
        identity_problems.append(
            f"call content differs (retained-only: {sorted((k[0], k[1]) for k in only_ret.elements())[:5]}, "
            f"independent-only: {sorted((k[0], k[1]) for k in only_ind.elements())[:5]})"
        )
    if ret_exempt != ind_exempt:
        identity_problems.append(
            f"signed-submission helper call counts differ: "
            f"{(ret_exempt - ind_exempt) + (ind_exempt - ret_exempt)}"
        )
    record(
        "rpc_request_identity",
        DIFFER if identity_problems else MATCH,
        f"non-poll local calls compared by (label, method, params, result) "
        f"with transaction hashes normalized to labels: retained={sum(ret_checked.values())} "
        f"independent={sum(ind_checked.values())}; identical multisets: "
        f"{ret_checked == ind_checked}; signed-submission helper groups "
        f"label/method-count and fixed-pair-content pinned: {sum(ret_exempt.values())} calls; "
        f"problems: {identity_problems}",
    )

    # 9c. Receipt poll ordering within each trace (review round 2) -------------
    # A null receipt poll is legitimate only while the transaction is
    # still pending: it must come after that transaction's send and
    # before its first non-null receipt in the same trace.
    def ordering_problems(trace):
        send_pos = {}
        first_nonnull = {}
        for i, call in enumerate(trace["local_calls"]):
            req = call.get("request") or {}
            res = call.get("response") or {}
            if req.get("method") == SEND_METHOD and isinstance(res.get("result"), str):
                send_pos.setdefault(res["result"], i)
            elif req.get("method") == RECEIPT_METHOD and res.get("result") is not None:
                h = (req.get("params") or [None])[0]
                if h not in first_nonnull:
                    first_nonnull[h] = i
        problems = []
        for i, call in enumerate(trace["local_calls"]):
            req = call.get("request") or {}
            res = call.get("response") or {}
            if req.get("method") != RECEIPT_METHOD:
                continue
            h = (req.get("params") or [None])[0]
            if h not in send_pos or send_pos[h] > i:
                problems.append(f"receipt poll before its transaction send: {call.get('label')}")
            if res.get("result") is None and h in first_nonnull and first_nonnull[h] < i:
                problems.append(f"null receipt poll after the final receipt: {call.get('label')}")
        return problems

    ord_problems = [f"retained: {p}" for p in ordering_problems(ret)] + [
        f"independent: {p}" for p in ordering_problems(ind)
    ]
    record(
        "receipt_poll_ordering",
        DIFFER if ord_problems else MATCH,
        f"every receipt poll follows its transaction's send and every null "
        f"poll precedes that transaction's first non-null receipt, in both "
        f"traces: {not ord_problems}; problems: {ord_problems}",
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
