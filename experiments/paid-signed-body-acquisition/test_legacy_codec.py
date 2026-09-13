"""Offline tests for the fixed-local legacy codec; no RPC or writer is loaded.

Exact EIP-155 published bytes anchor the signing-payload convention. Local
field construction reuses the same pinned Python RLP/Keccak primitive as the
codec and is not represented as an independent cryptographic implementation.
Malformed RLP cases explicitly alter bytes that the canonical encoder cannot
produce. One positive ECDSA test uses the public test scalar 1 and the already
installed cryptography library; no secret key, wallet or network is involved.
"""

import hashlib
import importlib.util
from pathlib import Path
import sys
import unittest


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CHAIN_ID, GAS_PRICE, MAX_GAS = 31337, 100000000000, 4000000
N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
ADDRESS = '0x' + '35' * 20
PRIMITIVE_PATH = ROOT / 'reference' / 'fixtures' / 'generate-ethereum-proof-fixtures.py'
PRIMITIVE_SHA256 = '5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa'


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


codec = load(HERE / 'legacy_codec.py', 'local_legacy_codec_under_test')
primitive_source = PRIMITIVE_PATH.read_bytes()
if len(primitive_source) > 65536 or hashlib.sha256(primitive_source).hexdigest() != PRIMITIVE_SHA256:
    raise RuntimeError('test primitive pin')
primitive = {'__name__': 'legacy_test_pinned_primitive', '__file__': str(PRIMITIVE_PATH)}
exec(compile(primitive_source, str(PRIMITIVE_PATH), 'exec'), primitive)
rlp, uint, digest = primitive['rlp'], primitive['integer'], primitive['digest']


def fields(nonce=9, gas_price=GAS_PRICE, gas_limit=21000, to=ADDRESS,
           value=0, data='0x', chain_id=CHAIN_ID, parity=0, r=1, s=1):
    return [uint(nonce), uint(gas_price), uint(gas_limit),
            b'' if to is None else bytes.fromhex(to[2:]), uint(value), bytes.fromhex(data[2:]),
            uint(2 * chain_id + 35 + parity), uint(r), uint(s)]


def raw(**changes):
    return '0x' + rlp(fields(**changes)).hex()


def signing_arguments(**changes):
    return {'nonce': 9, 'gas_price': GAS_PRICE, 'gas_limit': 21000, 'to': ADDRESS,
            'value': 0, 'data': '0x', 'chain_id': CHAIN_ID, **changes}


def encoded_arguments(**changes):
    return {'nonce': 9, 'to': ADDRESS, 'data': '0x', 'r': 1, 's': 1,
            'parity': 0, 'gas_limit': 21000, **changes}


class LegacyCodecTests(unittest.TestCase):
    def reject(self, action, reason=None):
        with self.assertRaises(codec.LegacyCodecError) as caught:
            action()
        self.assertTrue(caught.exception.code.startswith('LEGACY_CODEC_'))
        if reason is not None:
            self.assertEqual(caught.exception.code, 'LEGACY_CODEC_' + reason)

    def test_fixed_local_scope_and_primitive_are_explicit(self):
        self.assertEqual((codec.CHAIN_ID, codec.GAS_PRICE, codec.MAX_GAS, codec.SECP256K1_N),
                         (CHAIN_ID, GAS_PRICE, MAX_GAS, N))
        self.assertEqual((codec.MAX_RAW_BYTES, codec.MAX_DATA_BYTES), (16384, 8192))
        self.assertEqual(codec.PRIMITIVE_SHA256, PRIMITIVE_SHA256)

    def test_published_eip155_payload_and_hash_anchor_the_shared_primitive(self):
        # Published example: https://eips.ethereum.org/EIPS/eip-155#example
        official = bytes.fromhex('ec098504a817c800825208943535353535353535353535353535353535353535'
                                 '880de0b6b3a764000080018080')
        expected = [uint(9), uint(20000000000), uint(21000), bytes.fromhex('35' * 20),
                    uint(10 ** 18), b'', uint(1), b'', b'']
        self.assertEqual(rlp(expected), official)
        self.assertEqual(digest(official).hex(),
                         'daf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53')
        # The actual codec remains local-only; this mainnet example is not an
        # exception to chain, fee or value restrictions.
        signed = '0xf86c098504a817c800825208943535353535353535353535353535353535353535'
        signed += '880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276'
        signed += 'a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83'
        self.reject(lambda: codec.inspect_legacy(signed), 'CHAIN_ID')

    def test_local_signing_payload_has_chain_id_and_two_empty_signature_slots(self):
        expected = bytes.fromhex('e60985174876e800825208943535353535353535353535353535353535353535'
                                 '8080827a698080')
        payload = codec.signing_payload(**signing_arguments())
        self.assertEqual(payload, expected)
        self.assertEqual(payload, rlp(fields()[:6] + [uint(CHAIN_ID), b'', b'']))
        self.assertNotEqual(payload, rlp(fields()[:6]))
        self.assertNotEqual(digest(payload), digest(rlp(fields())))

    def test_signed_envelopes_decode_exact_fields_and_both_hashes_for_each_parity(self):
        for parity in (0, 1):
            with self.subTest(parity=parity):
                original = raw(parity=parity)
                result = codec.inspect_legacy(original)
                expected = {'nonce': 9, 'gas_price': GAS_PRICE, 'gas_limit': 21000, 'to': ADDRESS,
                    'value': 0, 'data': '0x', 'chain_id': CHAIN_ID, 'parity': parity, 'r': 1, 's': 1,
                    'raw': original, 'hash': '0x' + digest(bytes.fromhex(original[2:])).hex(),
                    'signing_hash': '0x' + digest(rlp(fields()[:6] + [uint(CHAIN_ID), b'', b''])).hex()}
                self.assertEqual(result, expected)
                self.assertEqual(codec.encode_signed(**encoded_arguments(parity=parity)), expected)
        left, right = (codec.inspect_legacy(raw(parity=parity)) for parity in (0, 1))
        self.assertNotEqual(left['hash'], right['hash'])
        self.assertEqual(left['signing_hash'], right['signing_hash'])

    def test_creation_data_boundaries_max_nonce_and_scalar_edges_are_preserved(self):
        for size in (0, 1, 55, 56, 255, 256, 8192):
            with self.subTest(data_bytes=size):
                data = '0x' + '00' * size
                args = encoded_arguments(nonce=(1 << 64) - 1, to=None, data=data,
                                         gas_limit=MAX_GAS, r=N - 1, s=N // 2, parity=1)
                result = codec.encode_signed(**args)
                self.assertEqual(result['nonce'], (1 << 64) - 1)
                self.assertIsNone(result['to'])
                self.assertEqual(result['data'], data)
                self.assertEqual((result['r'], result['s']), (N - 1, N // 2))
                self.assertEqual(result['raw'], raw(nonce=(1 << 64) - 1, to=None, data=data,
                                                   gas_limit=MAX_GAS, r=N - 1, s=N // 2, parity=1))
                self.assertLessEqual((len(result['raw']) - 2) // 2, 16384)
        self.assertEqual(codec.inspect_legacy(raw(nonce=0, gas_limit=1))['nonce'], 0)

    def test_local_chain_fee_gas_value_and_nonce_restrictions_apply_to_both_paths(self):
        changes = [('chain_id', [0, 1, 1337, CHAIN_ID + 1], 'CHAIN_ID'),
                   ('gas_price', [0, GAS_PRICE - 1, GAS_PRICE + 1], 'GAS_PRICE'),
                   ('gas_limit', [0, MAX_GAS + 1], 'GAS_LIMIT'),
                   ('value', [1, (1 << 256) - 1], 'VALUE')]
        for field, invalids, reason in changes:
            for invalid in invalids:
                with self.subTest(field=field, invalid=invalid):
                    self.reject(lambda: codec.signing_payload(**signing_arguments(**{field: invalid})), reason)
                    self.reject(lambda: codec.inspect_legacy(raw(**{field: invalid})), reason)
        self.reject(lambda: codec.signing_payload(**signing_arguments(nonce=1 << 64)), 'NONCE')
        self.reject(lambda: codec.inspect_legacy(raw(nonce=1 << 64)), 'RLP_INTEGER')

    def test_signature_scalars_must_be_nonzero_in_range_and_low_s_without_silent_normalization(self):
        for field, invalids, reason in [('r', [0, N, 1 << 256], 'R'),
                                      ('s', [0, N // 2 + 1, N - 1, N], 'S')]:
            for invalid in invalids:
                with self.subTest(field=field, invalid=invalid):
                    self.reject(lambda: codec.encode_signed(**encoded_arguments(**{field: invalid})), reason)
                    self.reject(lambda: codec.inspect_legacy(raw(**{field: invalid})),
                                'RLP_INTEGER' if invalid >= 1 << 256 else reason)
        for parity in (-1, 2, 27, 28):
            self.reject(lambda: codec.encode_signed(**encoded_arguments(parity=parity)), 'PARITY')
        for v in (0, 1, 27, 28, 35, 36, 2 * CHAIN_ID + 34, 2 * CHAIN_ID + 37):
            values = fields()
            values[6] = uint(v)
            self.reject(lambda: codec.inspect_legacy('0x' + rlp(values).hex()), 'CHAIN_ID')

    def test_numeric_fields_reject_booleans_floats_strings_and_negative_values(self):
        for field in ('nonce', 'gas_price', 'gas_limit', 'value', 'chain_id'):
            for invalid in (True, False, 1.0, '1', None, -1):
                with self.subTest(field=field, kind=type(invalid).__name__):
                    self.reject(lambda: codec.signing_payload(**signing_arguments(**{field: invalid})))
        for field in ('nonce', 'gas_limit', 'r', 's', 'parity'):
            for invalid in (True, False, 1.0, '1', None, -1):
                with self.subTest(field=field, kind=type(invalid).__name__):
                    self.reject(lambda: codec.encode_signed(**encoded_arguments(**{field: invalid})))

    def test_recipient_data_and_raw_hex_types_widths_and_limits_are_strict(self):
        for to in ('0x', '0x' + '11' * 19, '0x' + '11' * 21, '0x' + 'AA' * 20, b'\x11' * 20, False):
            self.reject(lambda: codec.signing_payload(**signing_arguments(to=to)), 'HEX')
            self.reject(lambda: codec.encode_signed(**encoded_arguments(to=to)), 'HEX')
        for size in (19, 21):
            self.reject(lambda: codec.inspect_legacy(raw(to='0x' + '11' * size)), 'TO')
        for data in (None, '0x0', '0xAA', '0X00', b'', False, '0x' + 'ab' * 8193):
            self.reject(lambda: codec.signing_payload(**signing_arguments(data=data)), 'HEX')
            self.reject(lambda: codec.encode_signed(**encoded_arguments(data=data)), 'HEX')
        self.reject(lambda: codec.inspect_legacy(raw(data='0x' + 'ab' * 8193)), 'HEX')
        for value in (None, {}, [], 1, b'\xc0', '0x', '0x0', '0Xc0', '0xAA', '0x' + '00' * 16385):
            self.reject(lambda: codec.inspect_legacy(value), 'HEX')

    def test_only_one_complete_legacy_list_with_exactly_nine_flat_fields_is_accepted(self):
        original = bytes.fromhex(raw()[2:])
        for prefix in (0, 1, 2, 3, 127):
            self.reject(lambda: codec.inspect_legacy('0x' + (bytes([prefix]) + original).hex()), 'RLP_ENVELOPE')
        for malformed, reason in [(b'\x80', 'RLP_ENVELOPE'), (b'\xc0', 'FIELD_COUNT'),
                                  (original + b'\x80', 'RLP_ENVELOPE'), (original[:-1], 'RLP_TRUNCATED'),
                                  (b'\xc2\x82\x00', 'RLP_TRUNCATED')]:
            self.reject(lambda: codec.inspect_legacy('0x' + malformed.hex()), reason)
        for values in (fields()[:-1], fields() + [b'']):
            self.reject(lambda: codec.inspect_legacy('0x' + rlp(values).hex()), 'FIELD_COUNT')
        for index in range(9):
            values = fields()
            values[index] = []
            self.reject(lambda: codec.inspect_legacy('0x' + rlp(values).hex()), 'RLP_NESTED')

    def test_overlong_rlp_lengths_and_single_byte_encodings_are_rejected(self):
        payload = b''.join(rlp(value) for value in fields())
        self.assertLess(len(payload), 56)
        for malformed in (b'\xf8' + bytes([len(payload)]) + payload,
                          b'\xf9\x00' + bytes([len(payload)]) + payload):
            self.reject(lambda: codec.inspect_legacy('0x' + malformed.hex()), 'RLP_LENGTH')
        rest = b''.join(rlp(value) for value in fields()[1:])
        for nonce, reason in ((b'\x81\x09', 'RLP_SINGLE_BYTE'), (b'\xb8\x01\x09', 'RLP_LENGTH')):
            changed = nonce + rest
            malformed = bytes([0xc0 + len(changed)]) + changed
            self.reject(lambda: codec.inspect_legacy('0x' + malformed.hex()), reason)
        self.reject(lambda: codec.inspect_legacy('0xffffffffffffffffff'), 'RLP_TRUNCATED')

    def test_integer_minimality_and_width_are_checked_for_every_numeric_field(self):
        for index in (0, 1, 2, 4, 6, 7, 8):
            for encoded in (b'\x00', b'\x00\x01', b'\x01' * 33):
                with self.subTest(index=index, encoded_bytes=len(encoded)):
                    values = fields()
                    values[index] = encoded
                    self.reject(lambda: codec.inspect_legacy('0x' + rlp(values).hex()), 'RLP_INTEGER')

    def test_public_api_argument_shapes_and_conversion_hooks_are_not_loosened(self):
        calls = []

        class Hook:
            def __str__(self):
                calls.append('str')
                raise AssertionError('untrusted conversion')

            def __int__(self):
                calls.append('int')
                raise AssertionError('untrusted conversion')

        self.reject(lambda: codec.inspect_legacy(Hook()), 'HEX')
        self.reject(lambda: codec.signing_payload(**signing_arguments(nonce=Hook())), 'NONCE')
        with self.assertRaises(TypeError):
            codec.inspect_legacy(raw(), True)
        with self.assertRaises(TypeError):
            codec.encode_signed(**encoded_arguments(), chain_id=1)
        self.assertEqual(calls, [])

    def test_public_test_key_signs_exact_keccak_payload_and_preserves_low_s_parity(self):
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec, utils

        # Scalar 1 is a public test fixture. Deriving its ephemeral point from
        # the known scalar lets this test determine parity without a recovery
        # implementation or any claim that the codec itself recovers a sender.
        private = ec.derive_private_key(1, ec.SECP256K1())
        unsigned = rlp(fields()[:6] + [uint(CHAIN_ID), b'', b''])
        message = digest(unsigned)
        signature = private.sign(message, ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        r, s = utils.decode_dss_signature(signature)
        s = min(s, N - s)
        ephemeral = ((int.from_bytes(message, 'big') + r) * pow(s, -1, N)) % N
        point = ec.derive_private_key(ephemeral, ec.SECP256K1()).public_key().public_numbers()
        self.assertEqual(point.x, r)
        parity = point.y & 1
        result = codec.encode_signed(**encoded_arguments(r=r, s=s, parity=parity))
        self.assertEqual(result['signing_hash'], '0x' + message.hex())
        self.assertEqual((result['r'], result['s'], result['parity']), (r, s, parity))
        # Prehashed consumes the supplied Keccak bytes; it does not SHA-256
        # them again. Verification also uses the decoded codec signing hash.
        private.public_key().verify(utils.encode_dss_signature(result['r'], result['s']),
                                   bytes.fromhex(result['signing_hash'][2:]),
                                   ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        public = private.public_key().public_bytes(serialization.Encoding.X962,
                                                  serialization.PublicFormat.UncompressedPoint)
        self.assertEqual('0x' + digest(public[1:])[-20:].hex(), '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf')
        self.assertNotIn('from', result)
        self.assertNotIn('senderVerified', result)
        self.assertNotIn('signaturesVerified', result)


if __name__ == '__main__':
    unittest.main(verbosity=2)
