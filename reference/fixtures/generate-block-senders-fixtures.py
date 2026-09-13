"""Native-ECDSA sender fixtures under bounded, synthetic London body roots.

Public fixture scalars 1, 2 and the published EIP-155 example are used, plus
one explicitly derived parity-flip alternative whose scalar is never emitted.
Cryptography signs/verifies the Keccak signing digest with Prehashed and obtains
the public points. For these known fixture scalars only, k=(z+r*d)/s mod n gives
the normalized signature's recovery parity via cryptography's kG public point.
There is no generic sender-recovery implementation, node, network or wallet.

Keccak/RLP/trie and header assembly reuse pinned existing Python generators;
they are not additional independent implementations of those primitives. The
new JavaScript sender implementation is never imported. All generated headers
commit to the exact supplied raw bytes, including deliberately invalid scalars.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

import cryptography
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
MAX_SOURCE_BYTES = 1024 * 1024
MAX_OUTPUT_BYTES = 512 * 1024
MAX_PARITY_ATTEMPTS = 64
N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
P = (1 << 256) - (1 << 32) - 977
EXAMPLE_SCALAR = int("46" * 32, 16)
EXAMPLE_SENDER = "0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f"
EXAMPLE_SIGNING_HASH = "0xdaf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53"
EXAMPLE_RAW = (
    "0xf86c098504a817c800825208943535353535353535353535353535353535353535"
    "880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276"
    "a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83"
)
PINS = {
    "generate-ethereum-proof-fixtures.py": "5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa",
    "generate-block-receipts-fixtures.py": "bade4d20fa0fd49d0990745b0dd4c0a4163cc7634d537358225e7c49dedaca77",
    "generate-block-transactions-fixtures.py": "d5ff964fa006119c4978701af7ecede4f6bf158a99188589264fcb9adde04da1",
}


def need(condition, reason):
    if not condition:
        raise ValueError("BLOCK_SENDERS_FIXTURE_" + reason)


def hx(raw):
    return "0x" + raw.hex()


def pinned(name):
    path = HERE / name
    with path.open("rb") as handle:
        source = handle.read(MAX_SOURCE_BYTES + 1)
    need(len(source) <= MAX_SOURCE_BYTES and hashlib.sha256(source).hexdigest() == PINS[name], "SOURCE_PIN")
    scope = {"__name__": "block_senders_pinned_" + name.replace("-", "_"), "__file__": str(path)}
    # Execute the captured, checked bytes once with all fixture-writing entry
    # points disabled; no re-read through runpy or bytecode-cache writes occur.
    exec(compile(source, str(path), "exec"), scope)
    return scope


class Generator:
    def __init__(self):
        need(cryptography.__version__ == "50.0.1", "CRYPTOGRAPHY_VERSION")
        self.primitive = pinned("generate-ethereum-proof-fixtures.py")
        self.receipts = pinned("generate-block-receipts-fixtures.py")
        self.transactions = pinned("generate-block-transactions-fixtures.py")
        self.digest = self.primitive["digest"]
        self.rlp = self.primitive["rlp"]
        self.uint = self.primitive["integer"]
        self.signature_calls = 0
        self.positive = []
        self.negative = []
        need(hx(self.digest(b"")) == "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", "KECCAK_ANCHOR")

    def unsigned(self, item, chain_id):
        values = self.transactions["fields"](item, self.primitive)
        tx_type = int(item["type"], 16)
        if tx_type == 0:
            unsigned = values[:6]
            if chain_id is not None:
                unsigned += [self.uint(chain_id), b"", b""]
            return self.rlp(unsigned)
        need(chain_id == int(item["chainId"], 16), "TYPED_CHAIN")
        return bytes([tx_type]) + self.rlp(values[:-3])

    def public_identity(self, scalar):
        need(scalar in (1, 2, EXAMPLE_SCALAR), "PUBLIC_FIXTURE_SCALAR")
        key = ec.derive_private_key(scalar, ec.SECP256K1())
        public = key.public_key().public_numbers()
        coordinates = public.x.to_bytes(32, "big") + public.y.to_bytes(32, "big")
        return key, hx(b"\x04" + coordinates), hx(self.digest(coordinates)[-20:])

    def expectation(self, item, chain_id, scalar):
        key, public_key, sender = self.public_identity(scalar)
        unsigned = self.unsigned(item, chain_id)
        signing_digest = self.digest(unsigned)
        r, s = int(item["r"], 16), int(item["s"], 16)
        need(1 <= r < N and 1 <= s <= N // 2, "NATIVE_SCALAR_BOUNDS")
        key.public_key().verify(utils.encode_dss_signature(r, s), signing_digest,
                                ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        # Known public fixture scalars only: this supplies an independent
        # native point/parity expectation, not a generic recovery algorithm.
        ephemeral = (int.from_bytes(signing_digest, "big") + r * scalar) * pow(s, -1, N) % N
        need(ephemeral != 0, "NATIVE_EPHEMERAL")
        point = ec.derive_private_key(ephemeral, ec.SECP256K1()).public_key().public_numbers()
        need(point.x == r, "NATIVE_EPHEMERAL_POINT")
        parity = point.y & 1
        encoded = self.transactions["encode"](item, self.primitive)
        tx_type = int(item["type"], 16)
        encoded_parity = (int(item["v"], 16) - (27 if chain_id is None else 2 * chain_id + 35)
                          if tx_type == 0 else int(item["yParity"], 16))
        need(parity == encoded_parity, "NATIVE_PARITY")
        result = {"type": item["type"], "sender": sender, "publicKey": public_key,
            "signingHash": hx(signing_digest), "transactionHash": hx(self.digest(encoded)),
            "chainId": None if chain_id is None else hex(chain_id),
            "replayProtected": chain_id is not None, "parity": hex(parity)}
        for name in ("nonce", "gasLimit", "to", "value", "data", "gasPrice",
                     "maxPriorityFeePerGas", "maxFeePerGas", "accessList"):
            if name in item:
                result[name] = copy.deepcopy(item[name])
        return result

    def sign(self, tx_type, chain_id, scalar=1, parity=None, **updates):
        need(tx_type in (0, 1, 2) and (chain_id is None or chain_id in (0, 1, 31337)), "SIGNING_PROFILE")
        need(tx_type == 0 or chain_id is not None, "SIGNING_PROFILE")
        need(parity in (None, 0, 1), "PARITY_TARGET")
        item = self.transactions["transaction"](tx_type, **updates)
        if tx_type:
            item["chainId"] = hex(chain_id)
        initial_nonce = int(item["nonce"], 16)
        key, _, _ = self.public_identity(scalar)
        for attempt in range(MAX_PARITY_ATTEMPTS):
            item["nonce"] = hex(initial_nonce + attempt)
            digest = self.digest(self.unsigned(item, chain_id))
            signature = key.sign(digest, ec.ECDSA(utils.Prehashed(hashes.SHA256()), deterministic_signing=True))
            self.signature_calls += 1
            need(self.signature_calls <= 1024, "SIGNING_CALL_BOUND")
            r, s = utils.decode_dss_signature(signature)
            s = min(s, N - s)
            ephemeral = (int.from_bytes(digest, "big") + r * scalar) * pow(s, -1, N) % N
            need(ephemeral != 0, "NATIVE_EPHEMERAL")
            point = ec.derive_private_key(ephemeral, ec.SECP256K1()).public_key().public_numbers()
            need(point.x % N == r, "NATIVE_EPHEMERAL_POINT")
            # Ethereum's one parity bit cannot encode the rare x=r+n case.
            if point.x != r:
                continue
            actual_parity = point.y & 1
            if parity is not None and actual_parity != parity:
                continue
            item.update(r=hex(r), s=hex(s))
            if tx_type == 0:
                item["v"] = hex((27 if chain_id is None else 2 * chain_id + 35) + actual_parity)
            else:
                item["yParity"] = hex(actual_parity)
            return item, self.expectation(item, chain_id, scalar)
        raise ValueError("BLOCK_SENDERS_FIXTURE_PARITY_SEARCH_BOUND")

    def body(self, name, items, chain_id, allow_unprotected=False, expected=None, error=None, note=None):
        need(0 <= len(items) <= 256, "TRANSACTION_BOUND")
        encoded = [self.transactions["encode"](item, self.primitive) for item in items]
        need(all(0 < len(value) <= 16384 for value in encoded) and sum(map(len, encoded)) <= 1048576, "RAW_BOUND")
        receipts = self.transactions["associated_receipts"]([int(item["type"], 16) for item in items], self.primitive, self.receipts)
        header = self.transactions["body_header"](encoded, receipts, self.primitive, self.receipts)[0]
        header["transactions"] = [hx(self.digest(value)) for value in encoded]
        case = {"name": name, "header": header, "rawTransactions": list(map(hx, encoded)),
            "selection": {"schema": "caw-block-senders-selection/1", "profile": "london-16",
                "hash": header["hash"], "chainId": hex(chain_id), "allowUnprotectedLegacy": allow_unprotected}}
        if error is None:
            need(expected is not None and len(expected) == len(items), "EXPECTED_COUNT")
            case["expected"] = [{"index": index, **copy.deepcopy(row)} for index, row in enumerate(expected)]
            self.positive.append(case)
        else:
            case["expected_error"] = "TRANSACTION_SENDER_" + error
            self.negative.append(case)
        if note is not None:
            case["note"] = note
        return case

    def official_example(self):
        item = self.transactions["transaction"](0, nonce="0x9", gasPrice=hex(20000000000),
            gasLimit=hex(21000), to="0x" + "35" * 20, value=hex(10 ** 18), data="0x", v="0x25",
            r="0x28ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276",
            s="0x67cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83")
        need(hx(self.transactions["encode"](item, self.primitive)) == EXAMPLE_RAW, "EIP155_RAW")
        expected = self.expectation(item, 1, EXAMPLE_SCALAR)
        need(expected["sender"] == EXAMPLE_SENDER and expected["signingHash"] == EXAMPLE_SIGNING_HASH, "EIP155_IDENTITY")
        self.body("official-eip155-example", [item], 1, expected=[expected],
                  note="Published EIP-155 bytes and public example scalar; native signature/public-key checks derive the expected sender from that scalar.")
        return item, expected

    def generate(self):
        access = [self.transactions["access_entry"](17, [0, 1, 1]), self.transactions["access_entry"](17, [0])]
        examples = {}
        recipes = (
            ("unprotected-legacy-parity-zero", 0, None, 1, 0, {"data": "0x00017f80"}),
            ("unprotected-legacy-parity-one-creation", 0, None, 2, 1, {"to": "0x", "data": "0x60006000"}),
            ("protected-legacy-chain-zero", 0, 0, 1, 0, {"value": "0x1234"}),
            ("protected-legacy-chain-31337-parity-one", 0, 31337, 2, 1, {"nonce": "0x80", "data": "0xabcd"}),
            ("type-one-chain-zero-parity-zero", 1, 0, 1, 0, {"accessList": access, "data": "0x0000ff"}),
            ("type-one-chain-one-parity-one", 1, 1, 2, 1, {"to": "0x", "accessList": access, "data": "0x6001"}),
            ("type-one-chain-31337", 1, 31337, 1, 0, {"accessList": access}),
            ("type-two-chain-one-parity-zero", 2, 1, 1, 0, {"data": hx(bytes(range(56))), "accessList": access}),
            ("type-two-chain-31337-parity-one", 2, 31337, 2, 1, {"to": "0x", "data": "0x60006001", "accessList": access}),
        )
        for name, tx_type, chain_id, scalar, parity, updates in recipes:
            item, expected = self.sign(tx_type, chain_id, scalar, parity, **updates)
            examples[name] = (item, expected)
            self.body(name, [item], 31337 if chain_id is None else chain_id,
                      chain_id is None, expected=[expected])
        official, official_expected = self.official_example()
        # Flip R to -R while retaining the exact signing payload and r/s. Since
        # sR=zG+rdG, the alternative key is (-d-2z/r)G. This local fixture-only
        # derivation does not broaden public_identity's fixed scalar allowlist.
        flipped = copy.deepcopy(official)
        flipped_parity = int(official_expected["parity"], 16) ^ 1
        flipped["v"] = hex(2 * 1 + 35 + flipped_parity)
        unsigned = self.unsigned(flipped, 1)
        need(unsigned == self.unsigned(official, 1), "FLIPPED_SIGNING_PAYLOAD")
        signing_digest = self.digest(unsigned)
        r, s = int(flipped["r"], 16), int(flipped["s"], 16)
        alternate_scalar = (-EXAMPLE_SCALAR - 2 * int.from_bytes(signing_digest, "big") * pow(r, -1, N)) % N
        need(0 < alternate_scalar < N and alternate_scalar != EXAMPLE_SCALAR, "FLIPPED_ALTERNATE_SCALAR")
        alternate_key = ec.derive_private_key(alternate_scalar, ec.SECP256K1()).public_key()
        alternate_key.verify(utils.encode_dss_signature(r, s), signing_digest,
                             ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        public = alternate_key.public_numbers()
        coordinates = public.x.to_bytes(32, "big") + public.y.to_bytes(32, "big")
        alternate_expected = copy.deepcopy(official_expected)
        alternate_expected.update(sender=hx(self.digest(coordinates)[-20:]),
            publicKey=hx(b"\x04" + coordinates), parity=hex(flipped_parity),
            transactionHash=hx(self.digest(self.transactions["encode"](flipped, self.primitive))))
        need(alternate_expected["sender"] != EXAMPLE_SENDER, "FLIPPED_DIFFERENT_SENDER")
        self.body("official-eip155-flipped-parity-different-sender", [flipped], 1,
            expected=[alternate_expected], note="Only the original signature parity is flipped; the signing payload and r/s are unchanged. Native verification succeeds for an explicitly derived fixture public key, not the original signer. No new signing operation or arbitrary/private input key is used, and the derived scalar is not published.")
        self.body("empty-block-chain-zero", [], 0, expected=[])
        mixed_names = ("unprotected-legacy-parity-zero", "protected-legacy-chain-31337-parity-one",
                       "type-one-chain-31337", "type-two-chain-31337-parity-one")
        mixed = [examples[name] for name in mixed_names]
        self.body("mixed-types-chain-31337", [item for item, _ in mixed], 31337, True,
                  expected=[row for _, row in mixed])
        repeated, repeated_expected = examples["type-two-chain-31337-parity-one"]
        maximum = self.body("maximum-256-transactions", [repeated] * 256, 31337,
            expected=[repeated_expected] * 256,
            note="Repeated identical signed bytes exercise the reader count bound. No claim that duplicate nonce/hash entries form an execution-valid block.")
        maximum["rawTransactionsRecipe"] = {"count": 256, "rawTransaction": maximum.pop("rawTransactions")[0]}
        maximum["expectedRecipe"] = {"count": 256, "transaction": copy.deepcopy(repeated_expected)}
        del maximum["expected"]

        base, _ = examples["protected-legacy-chain-31337-parity-one"]
        for field, value, reason in (("r", 0, "R"), ("r", N, "R"), ("r", N + 1, "R"),
                                    ("s", 0, "S"), ("s", N, "S"), ("s", N + 1, "S"),
                                    ("s", N - int(base["s"], 16), "HIGH_S")):
            item = copy.deepcopy(base)
            item[field] = hex(value)
            label = "zero" if value == 0 else "order" if value == N else "over-order" if value == N + 1 else "high"
            self.body("legacy-" + field + "-" + label, [item], 31337, error=reason)
        for tx_type, case_name in ((1, "type-one-chain-31337"), (2, "type-two-chain-31337-parity-one")):
            item = copy.deepcopy(examples[case_name][0])
            item["r"] = "0x0"
            self.body("typed-" + str(tx_type) + "-zero-r", [item], 31337, error="R")
        nonsquare = next((x for x in range(1, 257) if pow((x * x * x + 7) % P, (P - 1) // 2, P) == P - 1), None)
        need(nonsquare is not None, "NONRESIDUE_SEARCH_BOUND")
        item = copy.deepcopy(base)
        item["r"] = hex(nonsquare)
        self.body("recovery-x-is-nonresidue", [item], 31337, error="RECOVERY_POINT",
                  note="A bounded Legendre-symbol check establishes that x=r has no secp256k1 y coordinate.")
        # R=+/-G, r=G.x and s=+/-z give sR=zG, hence Q=r^-1(sR-zG)
        # is infinity. Choosing the sign keeps s low without implementing ECC.
        generator = ec.derive_private_key(1, ec.SECP256K1()).public_key().public_numbers()
        item = copy.deepcopy(base)
        z = int.from_bytes(self.digest(self.unsigned(item, 31337)), "big") % N
        need(z != 0, "INFINITY_Z")
        s = min(z, N - z)
        parity = (generator.y & 1) ^ (0 if s == z else 1)
        item.update(r=hex(generator.x), s=hex(s), v=hex(2 * 31337 + 35 + parity))
        self.body("recovered-public-key-is-infinity", [item], 31337, error="PUBLIC_KEY",
                  note="Constructed with R=+/-G and sR=zG; low-s and scalar bounds pass, but the recovered public key is infinity.")
        unprotected, _ = examples["unprotected-legacy-parity-zero"]
        self.body("unprotected-legacy-policy-refused", [unprotected], 31337, False, error="UNPROTECTED_LEGACY")
        self.body("protected-legacy-chain-mismatch", [official], 31337, True, error="CHAIN_MISMATCH")
        for case_name, selected_chain in (("protected-legacy-chain-zero", 1),
                                          ("type-one-chain-zero-parity-zero", 1),
                                          ("type-two-chain-31337-parity-one", 0)):
            self.body(case_name + "-wrong-selection", [examples[case_name][0]], selected_chain, error="CHAIN_MISMATCH")
        parities = {tx_type: {row["parity"] for case in self.positive for row in case.get("expected", [])
                             if row["type"] == hex(tx_type)} for tx_type in (0, 1, 2)}
        need(all(values == {"0x0", "0x1"} for values in parities.values()), "PARITY_COVERAGE")
        return {"schema": "caw-block-senders-fixtures/1", "synthetic": True,
            "provenance": {"cryptography_version": cryptography.__version__, "deterministic_signing": True,
                "native_signature_calls": self.signature_calls, "public_fixture_scalars": ["0x1", "0x2", hex(EXAMPLE_SCALAR)],
                "eip155_example": "https://eips.ethereum.org/EIPS/eip-155#example",
                "sources": {"reference/fixtures/" + name: pin for name, pin in PINS.items()},
                "signature_oracle": "Native cryptography ECDSA signs and verifies Keccak digests using Prehashed; fixture-known scalars and native public points establish recovery parity and expected public keys.",
                "shared_primitives": "Keccak/RLP/trie and synthetic London header/receipt assembly reuse the pinned Python generators. This is independent of JavaScript sender code, not independent reimplementations of those reused primitives.",
                "boundary": "Public synthetic fixtures only. No generic Python recovery, wallet, endpoint, transaction execution, consensus, finality or freshness claim."},
            "bounds": {"output_bytes": MAX_OUTPUT_BYTES, "transactions": 256, "raw_transaction_bytes": 16384,
                       "aggregate_raw_transaction_bytes": 1048576, "native_signing_calls": 1024,
                       "parity_attempts_per_signature": MAX_PARITY_ATTEMPTS},
            "recipe_expansion": "Only maximum-256-transactions uses recipes: repeat rawTransactionsRecipe.rawTransaction count times; clone expectedRecipe.transaction count times and add each contiguous zero-based index. The retained header commits to the fully expanded 256-element array.",
            "positive": self.positive, "negative": self.negative}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    need(args.output.parent.is_dir() and not args.output.exists(), "NEW_OUTPUT")
    result = Generator().generate()
    raw = (json.dumps(result, indent=2, sort_keys=True) + "\n").encode("utf-8")
    need(len(raw) <= MAX_OUTPUT_BYTES, "OUTPUT_BOUND")
    with args.output.open("xb") as handle:
        handle.write(raw)
    print(json.dumps({"status": "pass", "positive": len(result["positive"]), "negative": len(result["negative"]),
                      "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}, sort_keys=True))


if __name__ == "__main__":
    main()
