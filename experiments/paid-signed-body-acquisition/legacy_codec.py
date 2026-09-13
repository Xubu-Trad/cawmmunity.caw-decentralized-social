"""Bounded legacy EIP-155 envelope codec for the fixed local chain 31337.

No signing, keys, sender recovery, transport or execution-validity claim. RLP
encoding and Keccak reuse a hash-pinned existing Python construction primitive;
the strict flat nine-field decoder and local transaction checks are new.
"""
from functools import lru_cache
import hashlib
from pathlib import Path
import re


CHAIN_ID = 31337
GAS_PRICE = 100000000000
MAX_GAS = 4000000
MAX_RAW_BYTES = 16384
MAX_DATA_BYTES = 8192
SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
PRIMITIVE_SHA256 = "5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa"
HEX = re.compile(r"0x(?:[0-9a-f]{2})*\Z")


class LegacyCodecError(ValueError):
    def __init__(self, reason):
        self.code = "LEGACY_CODEC_" + reason
        super().__init__(self.code)


def _need(condition, reason):
    if not condition:
        raise LegacyCodecError(reason)


@lru_cache(maxsize=1)
def _primitives():
    path = Path(__file__).resolve().parents[2] / "reference/fixtures/generate-ethereum-proof-fixtures.py"
    try:
        with path.open("rb") as handle:
            source = handle.read(65537)
    except OSError:
        raise LegacyCodecError("SOURCE_READ") from None
    _need(len(source) <= 65536 and hashlib.sha256(source).hexdigest() == PRIMITIVE_SHA256, "SOURCE_PIN")
    scope = {"__name__": "legacy_codec_pinned_primitives", "__file__": str(path)}
    # The primitive's fixture-writing main function is never entered. Compiling
    # retained source directly also avoids creating a local bytecode-cache file.
    exec(compile(source, str(path), "exec"), scope)
    return scope["rlp"], scope["digest"], scope["integer"]


def _integer(value, minimum, maximum, reason):
    _need(type(value) is int and minimum <= value <= maximum, reason)
    return value


def _data(value, maximum, minimum=0):
    _need(type(value) is str and 2 + 2 * minimum <= len(value) <= 2 + 2 * maximum
          and HEX.fullmatch(value), "HEX")
    return bytes.fromhex(value[2:])


def _core(nonce, gas_price, gas_limit, to, value, data, chain_id):
    _integer(nonce, 0, (1 << 64) - 1, "NONCE")
    _integer(gas_price, GAS_PRICE, GAS_PRICE, "GAS_PRICE")
    _integer(gas_limit, 1, MAX_GAS, "GAS_LIMIT")
    _integer(value, 0, 0, "VALUE")
    _integer(chain_id, CHAIN_ID, CHAIN_ID, "CHAIN_ID")
    destination = b"" if to is None else _data(to, 20, 20)
    payload = _data(data, MAX_DATA_BYTES)
    _, _, uint = _primitives()
    return [uint(nonce), uint(gas_price), uint(gas_limit), destination, uint(value), payload]


def signing_payload(nonce, gas_price, gas_limit, to, value, data, chain_id=CHAIN_ID):
    """Canonical unsigned EIP-155 RLP bytes; all fixed-local limits still apply."""
    core = _core(nonce, gas_price, gas_limit, to, value, data, chain_id)
    rlp, _, uint = _primitives()
    return rlp(core + [uint(chain_id), b"", b""])


def _item(raw, start, limit):
    """Read one canonical RLP item without recursively accepting nested lists."""
    _need(start < limit, "RLP_TRUNCATED")
    prefix = raw[start]
    if prefix < 0x80:
        return raw[start:start + 1], start + 1, False
    is_list = prefix >= 0xc0
    base = 0xc0 if is_list else 0x80
    if prefix <= base + 55:
        size, begin = prefix - base, start + 1
    else:
        length_size = prefix - base - 55
        begin = start + 1 + length_size
        _need(begin <= limit, "RLP_TRUNCATED")
        length_raw = raw[start + 1:begin]
        _need(length_raw[0] != 0, "RLP_LENGTH")
        size = int.from_bytes(length_raw, "big")
        _need(size >= 56, "RLP_LENGTH")
    end = begin + size
    _need(end <= limit, "RLP_TRUNCATED")
    payload = raw[begin:end]
    _need(is_list or size != 1 or payload[0] >= 0x80, "RLP_SINGLE_BYTE")
    return payload, end, is_list


def _decoded_integer(raw, width=32):
    _need(len(raw) <= width and (not raw or raw[0] != 0), "RLP_INTEGER")
    return int.from_bytes(raw, "big")


def inspect_legacy(rawhex):
    """Decode a canonical local legacy envelope and derive its two byte hashes.

    Hashes are lowercase 0x-prefixed strings. Numeric fields are Python ints;
    ``to`` is None for creation or a lowercase address. Scalar bounds and low-s
    are structural restrictions, not a signature or recovered-sender proof.
    """
    raw = _data(rawhex, MAX_RAW_BYTES, 1)
    payload, end, is_list = _item(raw, 0, len(raw))
    _need(is_list and end == len(raw), "RLP_ENVELOPE")
    values, cursor = [], 0
    while cursor < len(payload):
        _need(len(values) < 9, "FIELD_COUNT")
        value, cursor, nested = _item(payload, cursor, len(payload))
        _need(not nested, "RLP_NESTED")
        values.append(value)
    _need(len(values) == 9, "FIELD_COUNT")
    rlp, digest, _ = _primitives()
    _need(rlp(values) == raw, "RLP_CANONICAL")
    nonce = _decoded_integer(values[0], 8)
    gas_price, gas_limit = map(_decoded_integer, values[1:3])
    _need(len(values[3]) in (0, 20), "TO")
    to = "0x" + values[3].hex() if values[3] else None
    value, v, r, s = map(_decoded_integer, (values[4], values[6], values[7], values[8]))
    parity = v - (2 * CHAIN_ID + 35)
    _integer(parity, 0, 1, "CHAIN_ID")
    _integer(r, 1, SECP256K1_N - 1, "R")
    _integer(s, 1, SECP256K1_N // 2, "S")
    data = "0x" + values[5].hex()
    unsigned = signing_payload(nonce, gas_price, gas_limit, to, value, data)
    return {"nonce": nonce, "gas_price": gas_price, "gas_limit": gas_limit,
        "to": to, "value": value, "data": data, "chain_id": CHAIN_ID,
        "parity": parity, "r": r, "s": s, "raw": rawhex,
        "hash": "0x" + digest(raw).hex(), "signing_hash": "0x" + digest(unsigned).hex()}


def encode_signed(nonce, to, data, r, s, parity, gas_limit=MAX_GAS):
    """Pack caller-supplied signature scalars; this function performs no signing."""
    core = _core(nonce, GAS_PRICE, gas_limit, to, 0, data, CHAIN_ID)
    _integer(r, 1, SECP256K1_N - 1, "R")
    _integer(s, 1, SECP256K1_N // 2, "S")
    _integer(parity, 0, 1, "PARITY")
    rlp, _, uint = _primitives()
    raw = rlp(core + [uint(2 * CHAIN_ID + 35 + parity), uint(r), uint(s)])
    _need(len(raw) <= MAX_RAW_BYTES, "RAW_BOUND")
    return inspect_legacy("0x" + raw.hex())
