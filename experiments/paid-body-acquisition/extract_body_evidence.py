"""Extract bounded, replay-checked body captures from a retained local trace.

This offline CLI has no transport or node imports. It loads only the pinned
collector, replays recorded responses, and preserves the original trace in a
deterministic gzip stream. Transcript agreement is not cryptographic body
verification: the separate JavaScript verifier may still reject these captures.
Source paths in the supplied manifest resolve against this experiment directory,
as they did for the live runner. Output paths never enter retained JSON data.
"""

import argparse
from collections import Counter
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import types


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
COLLECTOR_SHA256 = "7b0fe6536ef1daf5c0c9ffd08999e2becd410d8516c5ab8b7d01ca25e31b52fb"
MAX_TRACE_BYTES = 8 * 1024 * 1024
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_SOURCE_TOTAL_BYTES = 32 * 1024 * 1024
MAX_REQUESTS = 1800
MAX_BLOCKS = 128
MAX_NODES = 250000
READ_METHODS = frozenset((
    "eth_chainId", "eth_getBlockByNumber", "eth_getBlockByHash",
    "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getLogs",
    "eth_getCode", "eth_call",
))
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
PRIVATE_PATH = re.compile(r"(?:[A-Za-z]:[\\/]|\\\\|file://|/(?:Users|home|mnt|private|tmp)/)")
TRUE_FLAGS = (
    "body_left_lease_retired_before_transport", "retired_left_lease_refused_before_transport",
    "ancestor_restored_exactly", "body_right_lease_closed_before_transport",
    "closed_right_lease_refused_before_transport", "source_pins_unchanged_after_run",
    "owned_listener_released",
)


class EvidenceError(ValueError):
    def __init__(self, reason):
        self.code = "BODY_EVIDENCE_" + reason
        super().__init__(self.code)


def need(condition, reason):
    if not condition:
        raise EvidenceError(reason)


def fields(value, required, optional=()):
    need(type(value) is dict and set(required) <= set(value)
         and set(value) <= set(required) | set(optional), "FIELDS")


def integer(value, minimum=0, maximum=(1 << 64) - 1):
    need(type(value) is int and minimum <= value <= maximum, "INTEGER")
    return value


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True,
                      separators=(",", ":"), allow_nan=False).encode("ascii")


def same(left, right):
    # Native Python equality conflates booleans, integers and integral floats.
    return encoded(left) == encoded(right)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_bounded(path, limit):
    with path.open("rb") as handle:
        raw = handle.read(limit + 1)
    need(0 < len(raw) <= limit, "FILE_BOUND")
    return raw


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, "DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def parse_integer(text):
    need(len(text) <= 79, "JSON_INTEGER_BOUND")
    return int(text)


def reject_constant(_text):
    raise EvidenceError("JSON_CONSTANT")


def parsed(raw, limit):
    need(type(raw) is bytes and 0 < len(raw) <= limit, "JSON_BOUND")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object,
                           parse_int=parse_integer, parse_constant=reject_constant)
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise EvidenceError("JSON") from None
    # The trace includes a finite wall_seconds float. Unlike collector inputs,
    # its decoded tree therefore permits finite floats solely as bounded data.
    pending = [(value, 0)]
    nodes = 0
    while pending:
        item, depth = pending.pop()
        nodes += 1
        need(nodes <= MAX_NODES and depth <= 32, "JSON_STRUCTURE_BOUND")
        kind = type(item)
        if kind is dict:
            need(len(item) <= 128 and all(type(key) is str and len(key) <= 128
                 and not any(0xd800 <= ord(char) <= 0xdfff for char in key)
                 for key in item), "JSON_KEYS")
            pending.extend((entry, depth + 1) for entry in item.values())
        elif kind is list:
            need(len(item) <= 4096, "JSON_ARRAY")
            pending.extend((entry, depth + 1) for entry in item)
        elif kind is str:
            need(len(item) <= MAX_RESPONSE_BYTES
                 and not any(0xd800 <= ord(char) <= 0xdfff for char in item), "JSON_STRING")
            need(PRIVATE_PATH.search(item) is None, "PRIVATE_PATH")
        elif kind is int:
            need(-(1 << 256) < item < (1 << 256), "JSON_INTEGER_BOUND")
        elif kind is float:
            need(math.isfinite(item), "JSON_FLOAT")
        else:
            need(item is None or kind is bool, "JSON_TYPE")
    return value


def load_collector(inputs_path, expected_input_sha256, trace):
    need(type(expected_input_sha256) is str and SHA256.fullmatch(expected_input_sha256), "MANIFEST_HASH")
    raw = read_bounded(inputs_path, 65536)
    need(sha(raw) == expected_input_sha256 == trace["input_manifest_sha256"], "MANIFEST_PIN")
    manifest = parsed(raw, 65536)
    fields(manifest, ("schema", "files"))
    need(manifest["schema"] == "caw-paid-reorg-inputs/1", "MANIFEST_SCHEMA")
    pins = manifest["files"]
    need(type(pins) is dict and 1 <= len(pins) <= 64, "SOURCE_COUNT")
    need(pins.get("collect_body.py") == COLLECTOR_SHA256, "COLLECTOR_PIN")
    total_bytes = 0
    seen_paths = set()
    collector_source = None
    for name, expected in pins.items():
        need(type(name) is str and re.fullmatch(r"[A-Za-z0-9_./-]+", name)
             and not name.startswith("/") and type(expected) is str
             and SHA256.fullmatch(expected), "SOURCE_NAME")
        source_path = (HERE / name).resolve()
        need(source_path.is_relative_to(ROOT) and source_path not in seen_paths, "SOURCE_PATH")
        seen_paths.add(source_path)
        source = read_bounded(source_path, MAX_TRACE_BYTES)
        total_bytes += len(source)
        need(total_bytes <= MAX_SOURCE_TOTAL_BYTES and sha(source) == expected, "SOURCE_PIN")
        if name == "collect_body.py":
            collector_source = source
    need(collector_source is not None, "COLLECTOR_PIN")
    # A fixed hash, not an untrusted trace-selected module, authorizes this load.
    module = types.ModuleType("body_evidence_pinned_collector")
    module.__file__ = str(HERE / "collect_body.py")
    exec(compile(collector_source, module.__file__, "exec"), module.__dict__)
    return module, manifest, raw


def check_trace(trace):
    fields(trace, ("schema", "created_utc", "input_manifest_sha256", "status", "branches",
        "selected_branch", "selection_policy", "independent_providers", "authenticates_consensus",
        "ancestor", "orphan_intent", "orphan_rejection", "node", "rpc", "phases", *TRUE_FLAGS))
    need(trace["schema"] == "caw-paid-body-acquisition-run/1" and trace["status"] == "pass", "TRACE_STATUS")
    need(all(trace[name] is True for name in TRUE_FLAGS), "LIFECYCLE_FLAGS")
    need(trace["independent_providers"] is False and trace["authenticates_consensus"] is False,
         "TRUST_FLAGS")
    need(trace["selected_branch"] == "right"
         and trace["selection_policy"] == "explicit local fixture checkpoint", "BRANCH_SELECTION")
    fields(trace["branches"], ("left", "right"))
    node = trace["node"]
    need(type(node) is dict and node.get("schema") == "caw-local-node/1"
         and node.get("mode") == "synthetic" and node.get("hardfork") == "london"
         and type(node.get("local_chain_id")) is int and node["local_chain_id"] == 31337
         and node.get("host") == "127.0.0.1" and type(node.get("port")) is int
         and node["port"] == 18545, "NODE_PROFILE")
    for name in ("remote_provider", "fork_block", "expected_fork_hash", "expected_state_root", "stop_reason"):
        need(name in node and node[name] is None, "NODE_FORWARDING")
    for name in ("wallet_used", "transaction_broadcast", "local_impersonation_is_ownership_proof",
                 "token_storage_overridden"):
        need(node.get(name) is False, "NODE_FLAGS")
    for name in ("proxy_request_count", "upstream_forwarded_count", "generated_accounts"):
        need(type(node.get(name)) is int and node[name] == 0, "NODE_FORWARDING")
    need(node.get("token_code_replaced") is True, "SYNTHETIC_TOKEN")
    need(type(node.get("anvil_sha256")) is str and SHA256.fullmatch(node["anvil_sha256"]), "NODE_BINARY_PIN")
    integer(node.get("anvil_bytes"), 1, 256 * 1024 * 1024)
    rpc = trace["rpc"]
    need(type(rpc) is list and 1 <= len(rpc) <= MAX_REQUESTS
         and integer(node.get("local_request_count"), 1, MAX_REQUESTS) == len(rpc), "REQUEST_COUNT")
    for request_id, row in enumerate(rpc, 1):
        fields(row, ("label", "request", "response", "raw_response"))
        need(type(row["label"]) is str and len(row["label"]) <= 128, "REQUEST_LABEL")
        request, response = row["request"], row["response"]
        fields(request, ("jsonrpc", "id", "method", "params"))
        need(request["jsonrpc"] == "2.0" and integer(request["id"], 1, MAX_REQUESTS) == request_id
             and type(request["method"]) is str and type(request["params"]) is list, "REQUEST_ENVELOPE")
        need(type(response) is dict and set(response) in (
            {"jsonrpc", "id", "result"}, {"jsonrpc", "id", "error"}), "RESPONSE_ENVELOPE")
        need(response["jsonrpc"] == "2.0" and integer(response["id"], 1, MAX_REQUESTS) == request_id,
             "RESPONSE_ID")
        need(type(row["raw_response"]) is str, "RAW_RESPONSE")
        raw = row["raw_response"].encode("utf-8")
        need(same(parsed(raw, MAX_RESPONSE_BYTES), response), "RAW_RESPONSE_MISMATCH")
    expected_phases = (("prefix", "write-left"), ("write-left", "read-left"),
        ("read-left", "switch-at-ancestor"), ("switch-at-ancestor", "write-right"),
        ("write-right", "read-right"), ("read-right", "closed"))
    phases = trace["phases"]
    need(type(phases) is list and len(phases) == len(expected_phases), "PHASES")
    previous = 0
    for phase, (source, target) in zip(phases, expected_phases):
        fields(phase, ("from", "to", "after_request_id"))
        need(phase["from"] == source and phase["to"] == target, "PHASES")
        previous = integer(phase["after_request_id"], previous + 1, len(rpc))
    need(previous == len(rpc), "FINAL_PHASE")
    return {"left": (phases[1]["after_request_id"] + 1, phases[2]["after_request_id"]),
            "right": (phases[4]["after_request_id"] + 1, phases[5]["after_request_id"])}


def request_slice(trace, record):
    first = integer(record["first_request_id"], 1, len(trace["rpc"]))
    last = integer(record["last_request_id"], first, len(trace["rpc"]))
    return first, last, trace["rpc"][first - 1:last]


def extract_branch(trace, name, bounds, collector):
    branch = trace["branches"][name]
    fields(branch, ("config", "handoff", "collectors", "body_unknown_hash_refused_before_transport", "body_captures"))
    need(branch["body_unknown_hash_refused_before_transport"] is True, "RAW_SCOPE_FLAG")
    handoff = branch["handoff"]
    fields(handoff, ("writer_deleted", "writer_trace_read_by_collectors", "frontend_started",
        "indexer_started", "writes_sealed_for_phase", "first_read_only_request_id", "direct_write_refused_before_transport"))
    for key in ("writer_deleted", "writes_sealed_for_phase", "direct_write_refused_before_transport"):
        need(handoff[key] is True, "HANDOFF")
    for key in ("writer_trace_read_by_collectors", "frontend_started", "indexer_started"):
        need(handoff[key] is False, "HANDOFF")
    need(integer(handoff["first_read_only_request_id"], 1, len(trace["rpc"])) == bounds[0], "HANDOFF_RANGE")
    config = branch["config"]
    fields(config, ("chain_id", "addresses", "start_block_number", "start_block_hash",
        "end_block_number", "end_block_hash", "registry_runtime_sha256", "probe_runtime_sha256"))
    need(type(config["chain_id"]) is int and config["chain_id"] == 31337, "CHAIN_ID")
    start = integer(config["start_block_number"])
    end = integer(config["end_block_number"], start + 1, start + MAX_BLOCKS)
    old = branch["collectors"]
    fields(old, ("number", "hash"))
    need(same(old["number"]["history"], old["hash"]["history"])
         and same(old["number"]["manifest"], old["hash"]["manifest"]), "OLD_COLLECTOR_AGREEMENT")
    old_ranges = {}
    next_id = bounds[0]
    for route in ("number", "hash"):
        record = old[route]
        fields(record, ("history", "manifest", "acquisition", "request_count", "first_request_id", "last_request_id"))
        first, last, rows = request_slice(trace, record)
        need(first == next_id and integer(record["request_count"], 1, MAX_REQUESTS) == len(rows), "OLD_COLLECTOR_RANGE")
        for ordinal, row in enumerate(rows):
            need(row["label"] == "collector." + name + "." + route + "." + str(ordinal)
                 and row["request"]["method"] in READ_METHODS
                 and "result" in row["response"], "OLD_COLLECTOR_REQUEST")
        old_ranges[route] = {"first_request_id": first, "last_request_id": last, "request_count": len(rows)}
        next_id = last + 1
    history = old["number"]["history"]
    need(history.get("schema") == "caw-paid-history/1" and history.get("chain_id") == 31337
         and same(history["addresses"], config["addresses"]), "HISTORY_PROFILE")
    for endpoint, height in (("start", start), ("end", end)):
        header = history[endpoint + "_block"]
        need(header["number"] == hex(height) and header["hash"] == config[endpoint + "_block_hash"], "HISTORY_ENDPOINT")
    manifest = old["number"]["manifest"]
    need(all(same(manifest[key], config[key]) for key in (
        "chain_id", "addresses", "start_block_hash", "end_block_hash", "registry_runtime_sha256", "probe_runtime_sha256")), "HISTORY_MANIFEST")
    blocks, retained = history["blocks"], branch["body_captures"]
    need(type(blocks) is list and type(retained) is list and len(blocks) == len(retained) == end - start,
         "CAPTURE_COUNT")
    captures, provenance = [], []
    previous_hash = config["start_block_hash"]
    body_ordinal = 0
    for offset, record in enumerate(retained):
        fields(record, ("capture", "first_request_id", "last_request_id"))
        capture, _ = collector._capture(record["capture"], collector.MAX_OUTPUT_BYTES)
        header = capture["header"]
        need(header["number"] == hex(start + offset + 1) and header["parentHash"] == previous_hash,
             "HEADER_CHAIN")
        previous_hash = header["hash"]
        for route in ("number", "hash"):
            need(same(header, old[route]["history"]["blocks"][offset]["header"]), "OLD_HEADER_MISMATCH")
        first, last, rows = request_slice(trace, record)
        need(first == next_id and len(rows) == 4 + 2 * len(header["transactions"]), "BODY_RANGE")
        cursor = 0
        method_counts = Counter()

        def replay(method, params):
            nonlocal cursor, body_ordinal
            need(cursor < len(rows), "BODY_REQUEST_EXHAUSTED")
            row = rows[cursor]
            need(row["label"] == "collector." + name + ".body." + str(body_ordinal), "BODY_LABEL")
            need(row["request"]["method"] == method and same(row["request"]["params"], params), "BODY_REQUEST_MISMATCH")
            need("result" in row["response"], "BODY_RESPONSE_ERROR")
            cursor += 1
            body_ordinal += 1
            method_counts[method] += 1
            return row["response"]["result"]

        replayed = collector.collect(replay, {"block_number": header["number"], "block_hash": header["hash"]})
        need(cursor == len(rows) and same(replayed, capture), "BODY_REPLAY_MISMATCH")
        captures.append(replayed)
        provenance.append({"selection": replayed["selection"], "first_request_id": first,
            "last_request_id": last, "request_count": len(rows), "method_counts": dict(method_counts),
            "transaction_count": len(replayed["raw_transactions"]), "receipt_count": len(replayed["receipts"]),
            "raw_transaction_bytes": sum((len(raw) - 2) // 2 for raw in replayed["raw_transactions"]),
            "raw_response_bytes": sum(len(row["raw_response"].encode("utf-8")) for row in rows),
            "capture_sha256": sha(encoded(replayed))})
        next_id = last + 1
    need(next_id == bounds[1] + 1 and previous_hash == config["end_block_hash"]
         and same(captures[-1]["header"], history["end_block"]), "BODY_TIP")
    return captures, {"selected_interval": {"start_number": hex(start), "start_hash": config["start_block_hash"],
        "end_number": hex(end), "end_hash": config["end_block_hash"]}, "old_collectors": old_ranges,
        "capture_count": len(captures), "body_request_count": body_ordinal,
        "transaction_count": sum(item["transaction_count"] for item in provenance),
        "receipt_count": sum(item["receipt_count"] for item in provenance), "captures": provenance}


def extract_evidence(trace_path, inputs_path, expected_input_sha256):
    raw_trace = read_bounded(trace_path, MAX_TRACE_BYTES)
    trace = parsed(raw_trace, MAX_TRACE_BYTES)
    bounds = check_trace(trace)
    collector, manifest, manifest_raw = load_collector(inputs_path, expected_input_sha256, trace)
    branches, branch_provenance = {}, {}
    for name in ("left", "right"):
        branches[name], branch_provenance[name] = extract_branch(trace, name, bounds[name], collector)
    left_config, right_config = (trace["branches"][name]["config"] for name in ("left", "right"))
    need(same({key: value for key, value in left_config.items() if not key.startswith("end_")},
              {key: value for key, value in right_config.items() if not key.startswith("end_")}), "BRANCH_COMMON_CONFIG")
    need(left_config["end_block_number"] == right_config["end_block_number"]
         and left_config["end_block_hash"] != right_config["end_block_hash"], "DISTINCT_TIPS")
    ancestor = trace["ancestor"]["header"]
    ancestor_number = collector._quantity(ancestor["number"], 64)
    need(left_config["start_block_number"] < ancestor_number < left_config["end_block_number"], "ANCESTOR")
    for left, right in zip(branches["left"], branches["right"]):
        number = collector._quantity(left["header"]["number"], 64)
        if number <= ancestor_number:
            need(same(left, right), "COMMON_PREFIX")
        else:
            need(left["header"]["hash"] != right["header"]["hash"], "BRANCH_SUFFIX")
        if number == ancestor_number:
            need(same(left["header"], ancestor), "ANCESTOR_HEADER")
    captures = {"schema": "caw-local-body-captures/1", "synthetic_chain": True,
                "independent_providers": False, "branches": branches}
    compressed_buffer = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=compressed_buffer, compresslevel=9, mtime=0) as handle:
        handle.write(raw_trace)
    compressed = compressed_buffer.getvalue()
    need(len(compressed) <= MAX_TRACE_BYTES and gzip.decompress(compressed) == raw_trace, "GZIP")
    node = trace["node"]
    provenance = {"schema": "caw-local-body-provenance/1", "synthetic_chain": True,
        "independent_providers": False, "selected_branch": trace["selected_branch"],
        "selection_policy": trace["selection_policy"], "created_utc": trace["created_utc"],
        "execution_trace": {"sha256": sha(raw_trace), "bytes": len(raw_trace),
            "compressed_file": "execution-trace.json.gz", "compressed_sha256": sha(compressed),
            "compressed_bytes": len(compressed)},
        "input_manifest_sha256": sha(manifest_raw), "source_inputs": manifest["files"],
        "collector_sha256": COLLECTOR_SHA256,
        "endpoint": {key: node[key] for key in ("schema", "mode", "anvil_version", "anvil_sha256",
            "anvil_bytes", "local_chain_id", "hardfork", "host", "port", "remote_provider",
            "fork_block", "wallet_used", "transaction_broadcast", "generated_accounts",
            "local_impersonation_is_ownership_proof", "token_storage_overridden", "token_code_replaced",
            "local_request_count", "proxy_request_count", "upstream_forwarded_count")},
        "lifecycle": {key: trace[key] for key in TRUE_FLAGS},
        "counts": {"rpc_requests": len(trace["rpc"]), "body_requests": sum(item["body_request_count"] for item in branch_provenance.values()),
            "captures": sum(item["capture_count"] for item in branch_provenance.values()),
            "transactions": sum(item["transaction_count"] for item in branch_provenance.values()),
            "receipts": sum(item["receipt_count"] for item in branch_provenance.values())},
        "branches": branch_provenance, "rawResponseJsonMatched": True,
        "collectorReplayMatched": True, "oldCollectorHeadersMatched": True, "sourceInputsMatched": True,
        "verification_flags": {key: False for key in ("rpcTransactionHashesVerified", "headerHashVerified",
            "transactionCommitmentVerified", "receiptCommitmentVerified", "transactionAssociationVerified",
            "signaturesVerified", "senderVerified", "executionVerified", "endpointAuthenticated",
            "consensusVerified", "finalityVerified", "freshnessVerified", "recoveryVerified")}}
    capture_raw = encoded(captures) + b"\n"
    provenance_raw = encoded(provenance) + b"\n"
    need(len(capture_raw) <= MAX_TRACE_BYTES and len(provenance_raw) <= MAX_RESPONSE_BYTES, "OUTPUT_BOUND")
    return {"body-captures.json": capture_raw, "provenance.json": provenance_raw,
            "execution-trace.json.gz": compressed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--expected-input-sha256", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        need(args.output_dir.parent.is_dir() and not args.output_dir.exists(), "NEW_OUTPUT_DIRECTORY")
        artifacts = extract_evidence(args.trace, args.inputs, args.expected_input_sha256)
        args.output_dir.mkdir()
        for name, raw in artifacts.items():
            with (args.output_dir / name).open("xb") as handle:
                handle.write(raw)
    except EvidenceError as error:
        print(error.code, file=sys.stderr)
        raise SystemExit(1) from None
    except (OSError, KeyError, TypeError, ValueError, RecursionError):
        print("BODY_EVIDENCE_REJECTED", file=sys.stderr)
        raise SystemExit(1) from None
    print(json.dumps({"schema": "caw-body-evidence-extraction/1", "status": "pass",
        "files": {name: {"sha256": sha(raw), "bytes": len(raw)} for name, raw in artifacts.items()}}, sort_keys=True))


if __name__ == "__main__":
    main()
