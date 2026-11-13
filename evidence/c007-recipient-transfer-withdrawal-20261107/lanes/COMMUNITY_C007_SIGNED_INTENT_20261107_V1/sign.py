#!/usr/bin/env python3
import hashlib
import hmac
import json
import sys
from pathlib import Path
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils

w, parent, output = map(Path, sys.argv[1:4])
mode = sys.argv[4] if len(sys.argv) == 5 else "create"
assert mode in ("create", "verify")

N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
SECRET = 0x1337ca200001  # Public test fixture only.
OWNER = "0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76"
FEE = 5000 * 10**18
TEXT = b"CAW. C007 recipient transfer test."
VALID_AFTER = 1700000000
DEADLINE = 2000000000

def sha(b):
    return hashlib.sha256(b).hexdigest()

def word(n):
    n = int(n, 16) if isinstance(n, str) else int(n)
    assert 0 <= n < 2**256
    return n.to_bytes(32, "big")

def blob(b):
    return word(len(b)) + b + bytes((-len(b)) % 32)

def mac(key, data):
    return hmac.new(key, data, hashlib.sha256).digest()

def deterministic_nonce(secret, digest):
    material = word(secret) + word(int.from_bytes(digest, "big") % N)
    k = bytes(32)
    v = bytes([1]) * 32
    k = mac(k, v + b"\x00" + material)
    v = mac(k, v)
    k = mac(k, v + b"\x01" + material)
    v = mac(k, v)

    while True:
        v = mac(k, v)
        candidate = int.from_bytes(v, "big")
        if 1 <= candidate < N:
            return candidate
        k = mac(k, v + b"\x00")
        v = mac(k, v)

oracle_path = w / "reference/fixtures/generate-ethereum-proof-fixtures.py"
namespace = {
    "__name__": "caw_pinned_keccak",
    "__file__": str(oracle_path)
}
exec(
    compile(oracle_path.read_bytes(), str(oracle_path), "exec"),
    namespace
)
keccak = namespace["digest"]

assert keccak(b"").hex() == (
    "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
)

baseline = json.loads(parent.read_bytes())
assert baseline["schema"] == "caw-c007-wsl-funding-staking/1"
assert baseline["local_transactions"] == 12
assert baseline["posts_executed"] is False
assert baseline["nft_transfers_executed"] is False
assert baseline["liabilities_exactly_backed"] is True
assert baseline["owners"] == {
    "1": OWNER, "2": OWNER, "3": "0x" + "2" * 40
}
assert baseline["post_staking"]["stakes"] == [
    str(10 * 10**18), str(10**18), str(2 * 10**18)
]
assert baseline["post_staking"]["nonces"] == ["0", "0", "0"]
assert baseline["post_staking"]["messageCount"] == "0"
assert int(baseline["post_staking"]["credits"][0]) >= FEE + 10**19

distribution = baseline["distributionHash"]
assert distribution == (
    "0x5c062200c9a871b5095dfd6a27e804f25d1c74bb09e203ee223d507792843988"
)

probe = baseline["probe"]
assert len(probe) == 42

reference = (w / "experiments/paid-action/run_paid_action.py").read_bytes()
assert sha(reference) == (
    "92b50402f8ad097839ec4e40e7e221647c89c8b9d0b3c915c4ce2400531130bf"
)
assert b"TEST_KEYS={1:0x1337ca200001,2:0x1337ca200002}" in reference

build = json.loads(
    (w / "experiments/paid-action/paid-build.json").read_bytes()
)
selectors = build["contracts"]["CawPaidActionProbe"]["methodIdentifiers"]

signer = ec.derive_private_key(SECRET, ec.SECP256K1())
public = signer.public_key().public_numbers()
derived = "0x" + keccak(word(public.x) + word(public.y))[-20:].hex()
assert derived == OWNER

domain_type = (
    b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
)
post_type = (
    b"Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,"
    b"uint256 deadline,bytes32 distributionHash,bytes32 textHash,uint256 fee,bytes32 profile)"
)
profile = b"CAW_PAID_ACTION_THREE_ID_POOL_LOCKED_STAKE_UTF8_SCALARS_V1"

domain = keccak(
    keccak(domain_type)
    + keccak(b"CAW Paid Action Experiment")
    + keccak(b"1")
    + word(31337)
    + word(probe)
)

body = keccak(
    keccak(post_type)
    + word(1) + word(0) + word(0)
    + word(VALID_AFTER) + word(DEADLINE)
    + word(distribution)
    + keccak(TEXT)
    + word(FEE)
    + keccak(profile)
)

digest = keccak(b"\x19\x01" + domain + body)

k = deterministic_nonce(SECRET, digest)
point = ec.derive_private_key(k, ec.SECP256K1()).public_key().public_numbers()
assert point.x < N
r = point.x % N
s = (pow(k, -1, N) * (int.from_bytes(digest, "big") + r * SECRET)) % N
assert r != 0 and s != 0

parity = point.y & 1
if s > N // 2:
    s = N - s
    parity ^= 1
v = 27 + parity

signature = word(r) + word(s) + bytes([v])
assert len(signature) == 65
assert s <= N // 2

signer.public_key().verify(
    utils.encode_dss_signature(r, s),
    digest,
    ec.ECDSA(utils.Prehashed(hashes.SHA256()))
)

tuple_bytes = (
    word(1) + word(0) + word(0)
    + word(VALID_AFTER) + word(DEADLINE)
    + word(distribution) + word(224) + blob(TEXT)
)

post_digest_sig = (
    "postDigest((uint256,uint256,uint256,uint256,uint256,bytes32,bytes))"
)
post_sig = "post((uint256,uint256,uint256,uint256,uint256,bytes32,bytes),bytes)"

for signature_name in (post_digest_sig, post_sig):
    assert selectors[signature_name] == keccak(
        signature_name.encode()
    )[:4].hex()

digest_call = (
    bytes.fromhex(selectors[post_digest_sig])
    + word(32) + tuple_bytes
)
post_call = (
    bytes.fromhex(selectors[post_sig])
    + word(64) + word(64 + len(tuple_bytes))
    + tuple_bytes + blob(signature)
)

result = {
    "schema": "caw-c007-signed-intent/1",
    "parent_baseline_sha256": sha(parent.read_bytes()),
    "public_commit": "832e3eb88ca75694a55da0478c9106046b41ba56",
    "chain_id": 31337,
    "probe": probe,
    "signer": OWNER,
    "accountId": 1,
    "epoch": 0,
    "nonce": 0,
    "validAfter": VALID_AFTER,
    "deadline": DEADLINE,
    "distributionHash": distribution,
    "text_hex": TEXT.hex(),
    "fee": str(FEE),
    "digest": "0x" + digest.hex(),
    "signature": "0x" + signature.hex(),
    "postDigest_calldata": "0x" + digest_call.hex(),
    "post_calldata": "0x" + post_call.hex(),
    "signature_scheme": "deterministic RFC6979 secp256k1 low-s",
    "offchain_signature_verified": True,
    "onchain_digest_verified": False,
    "onchain_recovery_verified": False,
    "posts_executed": False,
    "recipient_transfer_executed": False,
    "synthetic_only": True,
    "c007": "OPEN"
}

encoded = (json.dumps(result, indent=2, sort_keys=True) + "\n").encode()

if mode == "create":
    with output.open("xb") as f:
        f.write(encoded)
else:
    assert output.read_bytes() == encoded, "NONDETERMINISTIC_INTENT"

print("SIGNER_ADDRESS_MATCH=PASS")
print("EIP712_DIGEST=0x" + digest.hex())
print("SIGNATURE_LOW_S=PASS")
print("OFFCHAIN_SIGNATURE=PASS")
print("CANONICAL_INTENT_SHA256=" + sha(encoded))
print("BYTE_REPLAY=" + ("PASS" if mode == "verify" else "NOT_YET_RUN"))
print("ONCHAIN_DIGEST=NOT_RUN")
print("POSTS=NOT_RUN")
print("C007=OPEN")
print("PASS: C007 deterministic signed intent " + mode)
