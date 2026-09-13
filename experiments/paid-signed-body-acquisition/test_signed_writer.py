"""Offline tests for the real signing adapter with an in-memory transport.

The recovery fixture uses only the two published test scalars d to derive
k = (z + r*d)/s mod n, then obtains R = kG through cryptography and selects its
y parity. It returns only the known-key match, not a general recovered address.
These tests do not execute a node, precompile, network or transaction;
live evidence must separately establish the actual precompile/submission path.
The unittest harness uses the adapter's required cryptography dependency for
actual signing and public-key signature checks, not mocked signature bytes.
"""
import copy
import hashlib
from pathlib import Path
import sys
import types
import unittest
from unittest import mock


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent


def load(name, path, expected=None):
    source = path.read_bytes()
    if expected is not None and hashlib.sha256(source).hexdigest() != expected:
        raise AssertionError("SIGNED_WRITER_TEST_SOURCE_PIN")
    module = types.ModuleType(name)
    module.__file__ = str(path)
    exec(compile(source, str(path), "exec"), module.__dict__)
    return module


class InMemoryTransport:
    """Explicit test fixture; every would-be node operation stays in memory."""

    def __init__(self, base, codec, adapter):
        self.base, self.codec, self.adapter = base, codec, adapter
        self.calls, self.submissions = [], []
        self.nonces = iter(("0x0", "0x1", "0x2"))
        self.dry_response = {"result": "0x"}
        self.receipt_status = "0x1"
        self.receipt_changes = {}
        self.receipt_responses = None
        self.submitted_hash = None
        self.recovery_mode = "known_public_key_parity"
        self.current_sender = None
        self.receipt = None
        self.parities = {}
        self.public_keys = {address: adapter.ec.derive_private_key(base.TEST_KEYS[owner],
            adapter.ec.SECP256K1()).public_key() for owner, address in ((1, base.A), (2, base.B))}

    def record(self, route, label, method, params):
        self.calls.append({"route": route, "label": label, "method": method,
                           "params": copy.deepcopy(params)})

    def rpc_raw(self, label, method, params):
        self.record("rpc_raw", label, method, params)
        if method == "eth_call":
            if not label.endswith(".dry") or params[1] != "latest":
                raise AssertionError("UNEXPECTED_DRY_CALL")
            self.current_sender = params[0]["from"]
            return copy.deepcopy(self.dry_response)
        if method == "eth_getTransactionReceipt":
            if self.receipt_responses is not None:
                return copy.deepcopy(next(self.receipt_responses))
            return {"result": copy.deepcopy(self.receipt)}
        raise AssertionError("UNEXPECTED_RAW_METHOD")

    def rpc(self, label, method, params):
        self.record("rpc", label, method, params)
        if method == "eth_getTransactionCount":
            if params != [self.current_sender, "latest"]:
                raise AssertionError("NONCE_IDENTITY")
            return next(self.nonces)
        if method == "anvil_setBalance":
            return None
        if method != "eth_call" or params[0].get("to") != "0x" + "00" * 19 + "01":
            raise AssertionError("UNEXPECTED_RECOVERY_METHOD")
        raw = bytes.fromhex(params[0]["data"][2:])
        if len(raw) != 128:
            raise AssertionError("RECOVERY_INPUT_LENGTH")
        digest = raw[:32]
        candidate, r, s = (int.from_bytes(raw[index:index + 32], "big") for index in (32, 64, 96))
        candidate -= 27
        if self.recovery_mode == "none":
            return "0x"
        if self.recovery_mode == "both":
            return "0x" + self.base.word(self.current_sender).hex()
        identity = (self.current_sender, digest, r, s)
        if identity not in self.parities:
            order = self.codec.SECP256K1_N
            test_scalar = self.base.TEST_KEYS[1 if self.current_sender == self.base.A else 2]
            ephemeral = ((int.from_bytes(digest, "big") + r * test_scalar) * pow(s, -1, order)) % order
            if ephemeral == 0:
                raise AssertionError("FIXTURE_ECDSA_POINT")
            point = self.adapter.ec.derive_private_key(ephemeral,
                self.adapter.ec.SECP256K1()).public_key().public_numbers()
            if point.x % order != r:
                raise AssertionError("FIXTURE_ECDSA_POINT")
            self.parities[identity] = point.y & 1
        matches = candidate == self.parities[identity]
        return "0x" + self.base.word(self.current_sender).hex() if matches else "0x"

    def submit_signed(self, label, raw):
        self.record("submit_signed", label, "eth_sendRawTransaction", [raw])
        envelope = self.codec.inspect_legacy(raw)
        # Check the packed envelope's digest/scalars against the known public
        # key directly; this does not trust the adapter's evidence booleans.
        self.public_keys[self.current_sender].verify(
            self.adapter.utils.encode_dss_signature(envelope["r"], envelope["s"]),
            bytes.fromhex(envelope["signing_hash"][2:]),
            self.adapter.ec.ECDSA(self.adapter.utils.Prehashed(self.adapter.hashes.SHA256())))
        identity = (self.current_sender, bytes.fromhex(envelope["signing_hash"][2:]), envelope["r"], envelope["s"])
        if envelope["parity"] != self.parities[identity]:
            raise AssertionError("PACKED_PARITY")
        self.submissions.append(envelope)
        self.receipt = {"transactionHash": envelope["hash"], "status": self.receipt_status,
            "from": self.current_sender, "to": envelope["to"], "gasUsed": "0x5208", "logs": [],
            "blockHash": "0x" + "ab" * 32, "blockNumber": hex(len(self.submissions)),
            "contractAddress": "0x" + "cd" * 20 if envelope["to"] is None else None}
        self.receipt.update(copy.deepcopy(self.receipt_changes))
        return self.submitted_hash or envelope["hash"]


class SignedWriterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = load("signed_writer_test_base", HERE / "../paid-action/run_paid_action.py",
            "92b50402f8ad097839ec4e40e7e221647c89c8b9d0b3c915c4ce2400531130bf")
        cls.k = load("signed_writer_test_keccak", HERE / "../../reference/fixtures/generate-ethereum-proof-fixtures.py",
            "5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa")
        cls.codec = load("signed_writer_test_codec", HERE / "legacy_codec.py",
            "c0ccfddea2edeb2f974d1c2b26d66dacbe557534e8a0465f39f6e755d3d81007")
        cls.adapter = load("signed_writer_test_adapter", HERE / "signed_writer.py")
        cls.Writer = cls.adapter.make_writer(cls.base, cls.codec)

    def setUp(self):
        self.node = InMemoryTransport(self.base, self.codec, self.adapter)
        self.writer = self.Writer(self.node, self.k, {})

    def send(self, caller=None, **kwargs):
        return self.writer.send("case", self.base.D if caller is None else caller,
                                self.base.TOKEN, "0x1234", **kwargs)

    def assert_rejected(self, code, caller=None, **kwargs):
        with self.assertRaisesRegex(RuntimeError, "^" + code + r"(?::case)?$"):
            self.send(caller, **kwargs)
        self.assertEqual(self.writer.rows, [])
        self.assertEqual(self.writer.signed_submissions, [])

    def test_deployer_is_a_before_dry_nonce_and_submission(self):
        row = self.send()
        self.assertEqual(self.node.calls[0]["params"][0]["from"], self.base.A)
        self.assertEqual(self.node.calls[1]["params"], [self.base.A, "latest"])
        self.assertEqual(row["transaction"]["from"], self.base.A)
        self.assertEqual(row["receipt"]["from"], self.base.A)
        self.assertEqual([call["method"] for call in self.node.calls],
            ["eth_call", "eth_getTransactionCount", "eth_call", "eth_call",
             "eth_sendRawTransaction", "eth_getTransactionReceipt"])
        envelope = self.node.submissions[0]
        self.assertEqual(envelope["hash"], row["receipt"]["transactionHash"])
        self.assertEqual(envelope["chain_id"], 31337)
        self.assertLessEqual(envelope["s"], self.codec.SECP256K1_N // 2)
        self.assertFalse(self.writer.signed_submissions[0]["generic_sender_verifier"])

    def test_second_published_identity_signs_as_b(self):
        row = self.send(self.base.B)
        self.assertEqual(row["receipt"]["from"], self.base.B)
        self.assertEqual(self.writer.signed_submissions[0]["test_sender"], self.base.B)

    def test_creation_uses_a_and_preserves_none_destination(self):
        row = self.writer.send("create", self.base.D, None, "0x6000")
        self.assertNotIn("to", row["transaction"])
        self.assertIsNone(self.node.submissions[0]["to"])
        self.assertIsNone(row["receipt"]["to"])

    def test_nonce_is_read_afresh_per_call(self):
        self.node.nonces = iter(("0x2", "0x9"))
        self.send()
        self.send()
        self.assertEqual([item["nonce"] for item in self.node.submissions], [2, 9])
        self.assertEqual(sum(call["method"] == "eth_getTransactionCount" for call in self.node.calls), 2)

    def test_unknown_signer_is_refused_before_any_transport(self):
        self.assert_rejected("LOCAL_TEST_SIGNER_ONLY", "0x" + "ef" * 20)
        self.assertEqual(self.node.calls, [])

    def test_mismatched_test_key_is_refused_before_transport(self):
        with mock.patch.dict(self.base.TEST_KEYS, {1: self.base.TEST_KEYS[1] + 1}):
            with self.assertRaisesRegex(RuntimeError, "^TEST_PUBLIC_KEY$"):
                self.Writer(self.node, self.k, {})
        self.assertEqual(self.node.calls, [])

    def test_dry_status_and_result_fail_before_nonce_or_signing(self):
        for response, code in (({"error": {"data": "0x"}}, "DRY_STATUS"),
                               ({"result": "0xff"}, "DRY_RETURN")):
            with self.subTest(code=code):
                self.setUp()
                self.node.dry_response = response
                self.assert_rejected(code)
                self.assertEqual(len(self.node.calls), 1)
                self.assertEqual(self.node.submissions, [])

    def test_expected_revert_still_has_real_signed_envelope(self):
        self.node.dry_response = {"error": {"data": self.writer.data("InvalidSignature()")}}
        self.node.receipt_status = "0x0"
        row = self.send(success=False, error="InvalidSignature()")
        self.assertEqual(row["receipt"]["status"], "0x0")
        self.assertEqual(len(self.node.submissions), 1)

    def test_wrong_revert_data_fails_before_nonce(self):
        self.node.dry_response = {"error": {"data": "0xdeadbeef"}}
        self.assert_rejected("DRY_REVERT", success=False, error="InvalidSignature()")
        self.assertEqual(len(self.node.calls), 1)

    def test_malformed_nonce_fails_before_recovery_and_submit(self):
        for nonce in (None, True, 1, "0x00", "0xA", "0x10000000000000000"):
            with self.subTest(nonce=nonce):
                self.setUp()
                self.node.nonces = iter((nonce,))
                self.assert_rejected("TX_NONCE")
                self.assertEqual(len(self.node.calls), 2)

    def test_missing_or_ambiguous_recovery_fails_before_submit(self):
        for mode, code in (("none", "TX_RECOVERY"), ("both", "AMBIGUOUS_RECOVERY")):
            with self.subTest(mode=mode):
                self.setUp()
                self.node.recovery_mode = mode
                self.assert_rejected(code)
                self.assertEqual(self.node.submissions, [])

    def test_changed_unsigned_digest_is_refused_before_submit(self):
        original = self.codec.encode_signed
        def changed(*args, **kwargs):
            result = original(*args, **kwargs)
            result["signing_hash"] = "0x" + "00" * 32
            return result
        with mock.patch.object(self.codec, "encode_signed", changed):
            self.assert_rejected("TX_SIGNING_DIGEST")
        self.assertEqual(self.node.submissions, [])

    def test_submitted_hash_mismatch_is_not_recorded_as_success(self):
        self.node.submitted_hash = "0x" + "ff" * 32
        self.assert_rejected("SUBMITTED_RAW_HASH")
        self.assertEqual(len(self.node.submissions), 1)
        self.assertFalse(any(call["method"] == "eth_getTransactionReceipt" for call in self.node.calls))

    def test_mismatched_receipt_hash_status_sender_or_destination_is_rejected(self):
        cases = (("transactionHash", "0x" + "ff" * 32, "RECEIPT_STATUS"),
                 ("status", "0x0", "RECEIPT_STATUS"), ("from", self.base.B, "RECEIPT_SENDER_METADATA"),
                 ("to", None, "RECEIPT_SENDER_METADATA"))
        for key, value, code in cases:
            with self.subTest(field=key):
                self.setUp()
                self.node.receipt_changes = {key: value}
                self.assert_rejected(code)

    def test_receipt_error_or_absence_never_records_success(self):
        self.node.receipt_responses = iter(({"error": {"code": -1}},))
        self.assert_rejected("RECEIPT_ERROR")
        self.setUp()
        self.node.receipt_responses = iter([{"result": None}] * 10)
        with mock.patch.object(self.adapter.time, "sleep") as sleep:
            self.assert_rejected("RECEIPT_STATUS")
        self.assertEqual(sleep.call_count, 10)

    def test_over_limit_gas_and_failed_receipt_logs_are_rejected(self):
        self.node.receipt_changes = {"gasUsed": hex(self.codec.MAX_GAS + 1)}
        self.assert_rejected("RECEIPT_EFFECTS")
        self.setUp()
        self.node.dry_response = {"error": {"data": self.writer.data("InvalidSignature()")}}
        self.node.receipt_status = "0x0"
        self.node.receipt_changes = {"logs": [{"data": "0x"}]}
        self.assert_rejected("RECEIPT_EFFECTS", success=False, error="InvalidSignature()")

    def test_receipt_gas_must_be_positive_canonical_hex(self):
        for gas_used in ("0x0", "-0x1", "0x05208", "0xA", "0x", 21000, True, None):
            with self.subTest(gas_used=gas_used):
                self.setUp()
                self.node.receipt_changes = {"gasUsed": gas_used}
                self.assert_rejected("RECEIPT_GAS")

    def test_retirement_erases_signers_and_blocks_later_transport(self):
        self.send()
        self.writer.intents.append({"fixture": True})
        self.writer.deployments.append({"fixture": True})
        self.writer.retire()
        self.assertEqual(self.writer.signers, {})
        self.assertEqual(self.writer.rows, [])
        self.assertEqual(self.writer.intents, [])
        self.assertEqual(self.writer.deployments, [])
        before = len(self.node.calls)
        with self.assertRaisesRegex(RuntimeError, "^LOCAL_TEST_SIGNER_ONLY$"):
            self.send()
        self.assertEqual(len(self.node.calls), before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
