"""Capture one explicitly selected London block body through read-only RPC.

``collect(read, config)`` accepts an injected synchronous reader returning
decoded JSON-RPC results. The reader owns endpoint authorization, timeouts,
wire-size limits and duplicate-JSON-key rejection. This module has no network,
file, node, wallet, retry or transaction-submission path.

Every raw transaction comes from eth_getRawTransactionByHash. RPC transaction
summaries are never re-encoded. Returned headers and receipts are copied in full;
their metadata is checked for consistency, not used as cryptographic evidence.
The separate alpha39 JavaScript reader must check header hashes, canonical raw
envelopes, both trie roots and their index/type association. This collector does
not verify signatures, senders, execution, endpoint authenticity, consensus,
finality or freshness. Rechecks establish only an unchanged observation of the
explicitly selected block during this finite acquisition.
"""

import json
import re


MAX_TRANSACTIONS = 256
MAX_RAW_TRANSACTION_BYTES = 16384
MAX_RAW_TOTAL_BYTES = 1048576
MAX_HEADER_BYTES = 65536
MAX_RECEIPT_BYTES = 1048576
MAX_RESPONSE_BYTES = 1048576
MAX_TOTAL_RESPONSE_BYTES = 4 * 1048576
MAX_OUTPUT_BYTES = 8 * 1048576
MAX_REQUESTS = 4 + 2 * MAX_TRANSACTIONS
MAX_RECEIPT_LOGS = 64
MAX_LOGS = 512
MAX_LOG_DATA_BYTES = 8192
MAX_NODES = 100000
MAX_DEPTH = 20
MAX_ARRAY = 2048
MAX_STRING = 262144

METHODS = frozenset((
    "eth_getBlockByNumber", "eth_getBlockByHash",
    "eth_getRawTransactionByHash", "eth_getTransactionReceipt",
))
HEADER_REQUIRED = frozenset((
    "hash", "parentHash", "sha3Uncles", "miner", "stateRoot",
    "transactionsRoot", "receiptsRoot", "logsBloom", "difficulty", "number",
    "gasLimit", "gasUsed", "timestamp", "extraData", "mixHash", "nonce",
    "baseFeePerGas", "transactions",
))
HEADER_OPTIONAL = frozenset(("totalDifficulty", "size", "uncles", "withdrawals"))
RECEIPT_REQUIRED = frozenset((
    "type", "status", "cumulativeGasUsed", "logsBloom", "logs",
    "transactionHash", "transactionIndex", "blockHash", "blockNumber",
))
RECEIPT_OPTIONAL = frozenset((
    "gasUsed", "effectiveGasPrice", "blobGasPrice", "blobGasUsed", "from",
    "to", "contractAddress", "blockTimestamp",
))
LOG_REQUIRED = frozenset(("address", "topics", "data"))
LOG_OPTIONAL = frozenset((
    "blockHash", "blockNumber", "blockTimestamp", "transactionHash",
    "transactionIndex", "logIndex", "removed",
))
HEX = re.compile(r"0x(?:[0-9a-f]{2})*\Z")
QUANTITY = re.compile(r"0x(?:0|[1-9a-f][0-9a-f]{0,63})\Z")


class AcquisitionError(ValueError):
    """An absent, malformed, changed, conflicting or over-bound observation."""

    def __init__(self, reason):
        self.code = "BODY_ACQUISITION_" + reason
        super().__init__(self.code)


def _need(condition, reason):
    if not condition:
        raise AcquisitionError(reason)


def _fields(value, required, optional=frozenset()):
    _need(type(value) is dict and required <= value.keys()
          and value.keys() <= required | optional, "FIELDS")


def _quantity(value, bits=256):
    _need(type(value) is str and len(value) <= 2 + bits // 4
          and QUANTITY.fullmatch(value), "QUANTITY")
    return int(value, 16)


def _hex(value, maximum, exact=None, minimum=0):
    _need(type(value) is str and 2 + minimum * 2 <= len(value) <= 2 + maximum * 2
          and HEX.fullmatch(value), "HEX")
    length = (len(value) - 2) // 2
    _need(exact is None or length == exact, "HEX_LENGTH")
    return length


def _hash(value):
    _hex(value, 32, exact=32)
    return value


def _address(value, nullable=False):
    if not (nullable and value is None):
        _hex(value, 20, exact=20)


def _timestamp(value, canonical, reason):
    # Anvil receipts use JSON integer seconds, while its logs use hex quantities.
    # Check either exact representation without replacing the captured value.
    _need((type(value) is int and value == _quantity(canonical))
          or (type(value) is str and value == canonical), reason)


def _capture(value, byte_limit):
    """Detach exact plain JSON types, rejecting hooks, cycles and large trees."""
    active = set()
    nodes = 0
    structural_bytes = 0

    def copy(item, depth):
        nonlocal nodes, structural_bytes
        nodes += 1
        structural_bytes += 8
        _need(nodes <= MAX_NODES and depth <= MAX_DEPTH
              and structural_bytes <= byte_limit, "DATA_BOUND")
        kind = type(item)
        if item is None or kind is bool:
            return item
        if kind is int:
            _need(0 <= item <= (1 << 53) - 1, "INTEGER")
            return item
        if kind is str:
            _need(len(item) <= MAX_STRING
                  and not any(0xd800 <= ord(char) <= 0xdfff for char in item), "STRING")
            structural_bytes += len(item.encode("utf-8"))
            _need(structural_bytes <= byte_limit, "DATA_BOUND")
            return item
        _need(kind in (dict, list), "PLAIN_DATA")
        identity = id(item)
        _need(identity not in active, "CYCLE")
        active.add(identity)
        if kind is list:
            _need(len(item) <= MAX_ARRAY, "ARRAY_BOUND")
            result = [copy(entry, depth + 1) for entry in item]
        else:
            _need(len(item) <= 64 and all(type(key) is str and len(key) <= 96
                  and not any(0xd800 <= ord(char) <= 0xdfff for char in key)
                  for key in item), "KEY_BOUND")
            result = {}
            for key, entry in item.items():
                structural_bytes += len(key.encode("utf-8"))
                _need(structural_bytes <= byte_limit, "DATA_BOUND")
                result[key] = copy(entry, depth + 1)
        active.remove(identity)
        return result

    captured = copy(value, 0)
    raw = json.dumps(captured, ensure_ascii=True, sort_keys=True,
                     separators=(",", ":"), allow_nan=False).encode("ascii")
    _need(len(raw) <= byte_limit, "DATA_BOUND")
    return captured, len(raw)


def _header(value, selection):
    _fields(value, HEADER_REQUIRED, HEADER_OPTIONAL)
    for name in ("hash", "parentHash", "sha3Uncles", "stateRoot",
                 "transactionsRoot", "receiptsRoot", "mixHash"):
        _hash(value[name])
    _need(value["hash"] == selection["block_hash"]
          and value["number"] == selection["block_number"], "HEADER_SELECTION")
    for name in ("number", "gasLimit", "gasUsed", "timestamp"):
        _quantity(value[name], 64)
    _need(_quantity(value["gasUsed"]) <= _quantity(value["gasLimit"]), "HEADER_GAS")
    for name in ("difficulty", "baseFeePerGas", "totalDifficulty", "size"):
        if name in value:
            _quantity(value[name])
    _address(value["miner"])
    _hex(value["logsBloom"], 256, exact=256)
    _hex(value["nonce"], 8, exact=8)
    _hex(value["extraData"], 32)
    transactions = value["transactions"]
    _need(type(transactions) is list and len(transactions) <= MAX_TRANSACTIONS,
          "TRANSACTION_BOUND")
    for transaction_hash in transactions:
        _hash(transaction_hash)
    _need(len(set(transactions)) == len(transactions), "DUPLICATE_TRANSACTION")
    if "uncles" in value:
        _need(type(value["uncles"]) is list and len(value["uncles"]) <= 2, "UNCLES")
        for uncle in value["uncles"]:
            _hash(uncle)
        _need(len(set(value["uncles"])) == len(value["uncles"]), "UNCLES")
    if "withdrawals" in value:
        _need(type(value["withdrawals"]) is list, "WITHDRAWALS")
    return value


def _receipt(value, header, transaction_hash, index, raw_type, cumulative, log_count):
    _fields(value, RECEIPT_REQUIRED, RECEIPT_OPTIONAL)
    _need(value["transactionHash"] == transaction_hash
          and value["transactionIndex"] == hex(index)
          and value["blockHash"] == header["hash"]
          and value["blockNumber"] == header["number"], "RECEIPT_ASSOCIATION")
    _need(value["type"] in ("0x0", "0x1", "0x2")
          and value["type"] == raw_type, "RECEIPT_TYPE")
    _need(value["status"] in ("0x0", "0x1"), "RECEIPT_STATUS")
    next_cumulative = _quantity(value["cumulativeGasUsed"])
    _need(cumulative < next_cumulative <= _quantity(header["gasUsed"]), "RECEIPT_GAS")
    for name in ("gasUsed", "effectiveGasPrice", "blobGasPrice", "blobGasUsed"):
        if name in value:
            _quantity(value[name])
    if "gasUsed" in value:
        _need(_quantity(value["gasUsed"]) == next_cumulative - cumulative, "RECEIPT_GAS")
    for name in ("from", "to", "contractAddress"):
        if name in value:
            _address(value[name], nullable=name != "from")
    if "blockTimestamp" in value:
        _timestamp(value["blockTimestamp"], header["timestamp"], "RECEIPT_TIMESTAMP")
    _hex(value["logsBloom"], 256, exact=256)
    logs = value["logs"]
    _need(type(logs) is list and len(logs) <= MAX_RECEIPT_LOGS
          and log_count + len(logs) <= MAX_LOGS, "LOG_BOUND")
    _need(value["status"] == "0x1" or not logs, "FAILED_RECEIPT_LOGS")
    for log in logs:
        _fields(log, LOG_REQUIRED, LOG_OPTIONAL)
        _address(log["address"])
        _hex(log["data"], MAX_LOG_DATA_BYTES)
        _need(type(log["topics"]) is list and len(log["topics"]) <= 4, "TOPICS")
        for topic in log["topics"]:
            _hash(topic)
        expected = {
            "blockHash": header["hash"], "blockNumber": header["number"],
            "transactionHash": transaction_hash,
            "transactionIndex": hex(index), "logIndex": hex(log_count),
        }
        for name, association in expected.items():
            if name in log:
                _need(log[name] == association, "LOG_ASSOCIATION")
        if "blockTimestamp" in log:
            _timestamp(log["blockTimestamp"], header["timestamp"], "LOG_TIMESTAMP")
        if "removed" in log:
            _need(log["removed"] is False, "LOG_REMOVED")
        log_count += 1
    return next_cumulative, log_count


def collect(read, config):
    """Return a detached ``caw-block-body-capture/1`` plain-data object.

    Config has exactly ``block_number`` (canonical hex quantity, uint64) and
    ``block_hash`` (lowercase 32-byte hex). No tags, automatic latest selection,
    fallback raw encoding, missing records or unresolved partial result exists.
    Calls are number/hash headers, raw/receipt pairs in transaction order, then
    number/hash headers again. Any changed field in either readback rejects.
    The request limit is 516; raw bytes total at most 1 MiB; observed decoded
    JSON totals at most 4 MiB. Transport limits apply before decoding as well.
    """
    selection, _ = _capture(config, 4096)
    _fields(selection, frozenset(("block_number", "block_hash")))
    _quantity(selection["block_number"], 64)
    _hash(selection["block_hash"])
    _need(callable(read), "READER")
    requests = 0
    observed_bytes = 0

    def request(method, params, limit=MAX_RESPONSE_BYTES):
        nonlocal requests, observed_bytes
        _need(method in METHODS and requests < MAX_REQUESTS, "REQUEST_BOUND")
        copied_params, _ = _capture(params, 4096)
        requests += 1
        try:
            result = read(method, copied_params)
        except Exception:
            raise AcquisitionError("RPC_FAILED_" + method) from None
        _need(result is not None, "MISSING_" + method)
        captured, byte_count = _capture(result, min(limit, MAX_RESPONSE_BYTES))
        observed_bytes += byte_count
        _need(observed_bytes <= MAX_TOTAL_RESPONSE_BYTES, "RESPONSE_TOTAL_BOUND")
        return captured

    def selected_header(method):
        key = "block_number" if method == "eth_getBlockByNumber" else "block_hash"
        return _header(request(method, [selection[key], False], MAX_HEADER_BYTES), selection)

    header = selected_header("eth_getBlockByNumber")
    _need(selected_header("eth_getBlockByHash") == header, "HEADER_DISAGREEMENT")
    raw_transactions = []
    raw_seen = set()
    receipts = []
    raw_bytes = 0
    cumulative = 0
    log_count = 0
    for index, transaction_hash in enumerate(header["transactions"]):
        raw = request("eth_getRawTransactionByHash", [transaction_hash])
        length = _hex(raw, MAX_RAW_TRANSACTION_BYTES, minimum=1)
        raw_bytes += length
        _need(raw_bytes <= MAX_RAW_TOTAL_BYTES, "RAW_TOTAL_BOUND")
        _need(raw not in raw_seen, "DUPLICATE_RAW")
        raw_seen.add(raw)
        first_byte = int(raw[2:4], 16)
        _need(first_byte in (1, 2) or first_byte >= 0xc0, "RAW_TYPE")
        raw_type = hex(first_byte) if first_byte in (1, 2) else "0x0"
        receipt = request("eth_getTransactionReceipt", [transaction_hash], MAX_RECEIPT_BYTES)
        cumulative, log_count = _receipt(receipt, header, transaction_hash, index,
                                        raw_type, cumulative, log_count)
        raw_transactions.append(raw)
        receipts.append(receipt)
    _need(cumulative == _quantity(header["gasUsed"]), "BLOCK_GAS")
    _need(selected_header("eth_getBlockByNumber") == header, "HEADER_CHANGED")
    _need(selected_header("eth_getBlockByHash") == header, "HEADER_CHANGED")
    result = {
        "schema": "caw-block-body-capture/1", "selection": selection,
        "header": header, "raw_transactions": raw_transactions, "receipts": receipts,
    }
    captured, _ = _capture(result, MAX_OUTPUT_BYTES)
    return captured
