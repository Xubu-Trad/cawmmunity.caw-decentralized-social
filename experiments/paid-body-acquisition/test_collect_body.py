"""Offline collector contract tests with explicitly reused alpha.39 fixtures.

The pinned Python-generated block-transactions-v1.json supplies synthetic
headers, envelopes and receipts. Mocked replies and their mutations are not
live acquisition evidence or an additional independent root implementation.
The collector captures bounded RPC observations; the JavaScript checker must
subsequently verify headers, transaction hashes, canonical RLP and both roots.
Run directly with Python -I -B; only Python standard-library modules are used.
"""

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FIXTURE_PATH = ROOT / 'reference' / 'fixtures' / 'block-transactions-v1.json'
FIXTURE_SHA256 = '6ef84984389a24fb114cbbe4a8de6d739dcfdabcd07ef5c24c62fd10e1ae5086'
fixture_bytes = FIXTURE_PATH.read_bytes()
if len(fixture_bytes) > 384 * 1024 or hashlib.sha256(fixture_bytes).hexdigest() != FIXTURE_SHA256:
    raise RuntimeError('alpha.39 synthetic fixture pin')
FIXTURE = json.loads(fixture_bytes)
if FIXTURE['format'] != 'caw-block-transactions-fixtures-v1' or FIXTURE['synthetic'] is not True:
    raise RuntimeError('alpha.39 synthetic fixture format')

spec = importlib.util.spec_from_file_location('body_collector_under_test', HERE / 'collect_body.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


def case(name='mixed-types-contract-creation-and-data-boundaries'):
    value = copy.deepcopy(next(item for item in FIXTURE['cases'] if item['name'] == name))
    header = value['header']
    header['transactions'] = value['expected']['transaction_hashes'][:]
    if 'receipts' not in value:
        recipe = value['receipt_recipe']
        if recipe['schema'] != 'caw-synthetic-associated-receipts/1':
            raise RuntimeError('receipt recipe schema')
        value['receipts'] = [
            {**copy.deepcopy(recipe['template']), 'type': value['expected']['transaction_types'][index],
             'transactionHash': header['transactions'][index], 'transactionIndex': hex(index),
             'blockHash': header['hash'], 'blockNumber': header['number'],
             'cumulativeGasUsed': hex((index + 1) * int(recipe['gas_step'], 16))}
            for index in range(recipe['count'])
        ]
    value['config'] = {'block_number': header['number'], 'block_hash': header['hash']}
    return value


def changed_hex(value):
    return '0x' + format(int(value[2:4], 16) ^ 1, '02x') + value[4:]


class ScriptedRPC:
    """Return retained decoded replies while enforcing every requested method."""

    def __init__(self, value, on_call=None):
        header, config = value['header'], value['config']
        self.steps = [
            ['eth_getBlockByNumber', [config['block_number'], False], copy.deepcopy(header)],
            ['eth_getBlockByHash', [config['block_hash'], False], copy.deepcopy(header)],
        ]
        for tx_hash, raw, receipt in zip(header['transactions'], value['raw_transactions'], value['receipts']):
            self.steps.extend([
                ['eth_getRawTransactionByHash', [tx_hash], raw],
                ['eth_getTransactionReceipt', [tx_hash], copy.deepcopy(receipt)],
            ])
        self.steps.extend([
            ['eth_getBlockByNumber', [config['block_number'], False], copy.deepcopy(header)],
            ['eth_getBlockByHash', [config['block_hash'], False], copy.deepcopy(header)],
        ])
        self.calls = []
        self.on_call = on_call

    def __call__(self, method, params):
        index = len(self.calls)
        self.calls.append((method, copy.deepcopy(params)))
        if index >= len(self.steps):
            raise AssertionError('unexpected additional RPC call')
        wanted_method, wanted_params, result = self.steps[index]
        if (method, params) != (wanted_method, wanted_params):
            raise AssertionError('unexpected RPC method or parameters: ' + method)
        if self.on_call:
            self.on_call(self, index)
        if isinstance(result, Exception):
            raise result
        return result

    def expected_calls(self):
        return [(method, params) for method, params, _ in self.steps]


def expanded(value, count, raw=None):
    """Admission probe only: these expanded bodies have no claimed valid root."""
    value = copy.deepcopy(value)
    source = raw if raw is not None else value['raw_transactions'][0]
    value['header']['transactions'] = ['0x' + format(index + 1000, '064x') for index in range(count)]
    value['header']['gasUsed'] = hex(count * 21000)
    value['raw_transactions'] = [source[:-2] + format(index, '02x') for index in range(count)]
    template = value['receipts'][0]
    value['receipts'] = [{**copy.deepcopy(template), 'transactionHash': tx_hash,
                          'transactionIndex': hex(index), 'cumulativeGasUsed': hex((index + 1) * 21000)}
                         for index, tx_hash in enumerate(value['header']['transactions'])]
    return value


class CollectorTests(unittest.TestCase):
    def reject(self, rpc, config, code=None):
        with self.assertRaises(collector.AcquisitionError) as caught:
            collector.collect(rpc, config)
        self.assertTrue(caught.exception.code.startswith('BODY_ACQUISITION_'))
        if code is not None:
            self.assertEqual(caught.exception.code, code)
        # Rejection must not prompt a fallback to RPC transaction objects, a
        # bulk receipt method, getLogs, or an unselected latest block.
        self.assertEqual(rpc.calls, rpc.expected_calls()[:len(rpc.calls)])
        return caught.exception

    def test_fixture_provenance_and_original_hashes_are_pinned(self):
        self.assertEqual(hashlib.sha256(fixture_bytes).hexdigest(), FIXTURE_SHA256)
        self.assertEqual(len(FIXTURE['cases']), 13)
        self.assertIs(FIXTURE['synthetic'], True)
        self.assertTrue(all(item['expected']['transaction_count'] == len(item['raw_transactions'])
                            for item in FIXTURE['cases']))

    def test_complete_body_preserves_header_order_bytes_and_receipts(self):
        value = case()
        before = copy.deepcopy(value)
        rpc = ScriptedRPC(value)
        result = collector.collect(rpc, value['config'])
        self.assertEqual(result, {'schema': 'caw-block-body-capture/1', 'selection': value['config'],
                                 'header': value['header'], 'raw_transactions': value['raw_transactions'],
                                 'receipts': value['receipts']})
        self.assertEqual(rpc.calls, rpc.expected_calls())
        self.assertEqual(len(rpc.calls), 4 + 2 * len(value['raw_transactions']))
        self.assertEqual(value, before)
        self.assertEqual(set(result), {'schema', 'selection', 'header', 'raw_transactions', 'receipts'})

    def test_empty_block_rechecks_both_selectors_without_body_requests(self):
        value = case('empty')
        rpc = ScriptedRPC(value)
        result = collector.collect(rpc, value['config'])
        self.assertEqual(result['raw_transactions'], [])
        self.assertEqual(result['receipts'], [])
        self.assertEqual(rpc.calls, rpc.expected_calls())
        self.assertEqual(len(rpc.calls), 4)

    def test_exact_transaction_count_and_raw_size_boundaries_are_supported(self):
        for name in ('typed-index-boundaries-256', 'raw-transaction-limit-16384'):
            with self.subTest(name=name):
                value = case(name)
                rpc = ScriptedRPC(value)
                result = collector.collect(rpc, value['config'])
                self.assertEqual(result['raw_transactions'], value['raw_transactions'])
                self.assertEqual(rpc.calls, rpc.expected_calls())
                if name.endswith('256'):
                    self.assertEqual(len(result['raw_transactions']), 256)
                    self.assertEqual(rpc.calls[2 + 2 * 128], ('eth_getRawTransactionByHash', [value['header']['transactions'][128]]))
                    self.assertEqual(rpc.calls[2 + 2 * 255], ('eth_getRawTransactionByHash', [value['header']['transactions'][255]]))
                else:
                    self.assertEqual((len(result['raw_transactions'][0]) - 2) // 2, 16384)

    def test_config_is_exact_and_invalid_selection_never_starts_rpc(self):
        value = case()
        malformed = [None, [], {}, {**value['config'], 'profile': 'london-16'},
                     {'block_number': value['config']['block_number']},
                     {'block_hash': value['config']['block_hash']}]
        for field, invalids in (
            ('block_number', [None, True, 1, -1, 'latest', 'pending', '0x', '0x00', '0X1', '0xA', '1',
                              hex(1 << 64), '0x1' + '0' * 64]),
            ('block_hash', [None, 1, '0x', '0x' + 'aa' * 31, '0x' + 'aa' * 33, '0x' + 'AA' * 32]),
        ):
            malformed.extend({**value['config'], field: invalid} for invalid in invalids)
        for config in malformed:
            with self.subTest(config=config):
                rpc = ScriptedRPC(value)
                self.reject(rpc, config)
                self.assertEqual(rpc.calls, [])
        with self.assertRaises(collector.AcquisitionError):
            collector.collect(None, value['config'])
        with self.assertRaises(TypeError):
            collector.collect(ScriptedRPC(value), value['config'], True)

    def test_null_missing_or_protocol_wrapped_results_fail_without_fallback(self):
        for position in (0, 1, 2, 3):
            for invalid in (None, {}, [], {'jsonrpc': '2.0', 'id': 1, 'result': None}):
                with self.subTest(position=position, invalid=invalid):
                    value = case('legacy-nonce-zero')
                    rpc = ScriptedRPC(value)
                    rpc.steps[position][2] = invalid
                    self.reject(rpc, value['config'])
                    self.assertEqual(len(rpc.calls), position + 1)

    def test_transport_error_propagates_as_acquisition_failure_without_fallback(self):
        for position in (0, 2, 3):
            with self.subTest(position=position):
                value = case('legacy-nonce-zero')
                rpc = ScriptedRPC(value)
                rpc.steps[position][2] = OSError('simulated unavailable RPC')
                self.reject(rpc, value['config'], 'BODY_ACQUISITION_RPC_FAILED_' + rpc.steps[position][0])
                self.assertEqual(len(rpc.calls), position + 1)

    def test_selected_header_identity_and_initial_number_hash_views_must_match(self):
        for position in (0, 1):
            for field in ('hash', 'number', 'transactionsRoot', 'extraData', 'transactions'):
                with self.subTest(position=position, field=field):
                    value = case()
                    rpc = ScriptedRPC(value)
                    header = rpc.steps[position][2]
                    if field in ('hash', 'transactionsRoot'):
                        header[field] = changed_hex(header[field])
                    elif field == 'number':
                        header[field] = hex(int(header[field], 16) + 1)
                    elif field == 'extraData':
                        header[field] = '0xdeadbeef'
                    else:
                        header[field].reverse()
                    self.reject(rpc, value['config'], 'BODY_ACQUISITION_HEADER_SELECTION' if field in ('hash', 'number')
                                else 'BODY_ACQUISITION_HEADER_DISAGREEMENT')
                    self.assertLessEqual(len(rpc.calls), 2)

    def test_header_missing_unknown_null_or_post_london_fields_fail(self):
        required = ['hash', 'parentHash', 'sha3Uncles', 'miner', 'stateRoot', 'transactionsRoot',
                    'receiptsRoot', 'logsBloom', 'difficulty', 'number', 'gasLimit', 'gasUsed',
                    'timestamp', 'extraData', 'mixHash', 'nonce', 'baseFeePerGas', 'transactions']
        for field in required:
            for mode in ('missing', 'null'):
                with self.subTest(field=field, mode=mode):
                    value = case()
                    rpc = ScriptedRPC(value)
                    if mode == 'missing':
                        del rpc.steps[0][2][field]
                    else:
                        rpc.steps[0][2][field] = None
                    self.reject(rpc, value['config'])
                    self.assertEqual(len(rpc.calls), 1)
        for field in ('futureField', 'withdrawalsRoot', 'blobGasUsed'):
            with self.subTest(field=field):
                value = case()
                rpc = ScriptedRPC(value)
                rpc.steps[0][2][field] = '0x0'
                self.reject(rpc, value['config'])

    def test_header_transaction_hashes_are_unique_and_never_full_rpc_objects(self):
        value = case()
        original = value['header']['transactions']
        for hashes in (None, {}, [None], [{'hash': original[0]}], [original[0], original[0]],
                       ['0x' + 'AA' * 32], ['0x' + '11' * 31],
                       ['0x' + format(index, '064x') for index in range(257)]):
            with self.subTest(length=len(hashes) if isinstance(hashes, list) else None):
                rpc = ScriptedRPC(value)
                rpc.steps[0][2]['transactions'] = hashes
                self.reject(rpc, value['config'])
                self.assertEqual(len(rpc.calls), 1)

    def test_raw_envelopes_must_be_lowercase_nonempty_bounded_byte_strings(self):
        for invalid in (None, {}, [], 1, False, b'\xc0', '0x', '0x0', '0Xc0', '0xAA',
                        '0x03c0', '0x00c0', '0x80', '0x02' + '00' * 16384):
            with self.subTest(kind=type(invalid).__name__, size=len(invalid) if isinstance(invalid, str) else None):
                value = case('legacy-nonce-zero')
                rpc = ScriptedRPC(value)
                rpc.steps[2][2] = invalid
                self.reject(rpc, value['config'])
                self.assertEqual(len(rpc.calls), 3)

    def test_duplicate_raw_bytes_at_distinct_hashes_fail_before_second_receipt(self):
        value = case('typed-index-boundaries-130')
        rpc = ScriptedRPC(value)
        rpc.steps[4][2] = rpc.steps[2][2]
        self.reject(rpc, value['config'], 'BODY_ACQUISITION_DUPLICATE_RAW')
        self.assertEqual(len(rpc.calls), 5)

    def test_receipt_identity_type_status_and_exact_fields_are_required(self):
        value = case()
        invalids = {
            'transactionHash': changed_hex(value['receipts'][0]['transactionHash']),
            'transactionIndex': '0x1', 'blockHash': changed_hex(value['header']['hash']),
            'blockNumber': hex(int(value['header']['number'], 16) + 1),
            'type': '0x2', 'status': '0x2', 'logs': None,
            'logsBloom': '0x' + '00' * 255, 'cumulativeGasUsed': '0x00',
        }
        for field, invalid in invalids.items():
            for mode in ('altered', 'missing', 'null'):
                with self.subTest(field=field, mode=mode):
                    rpc = ScriptedRPC(value)
                    receipt = rpc.steps[3][2]
                    if mode == 'missing':
                        del receipt[field]
                    else:
                        receipt[field] = invalid if mode == 'altered' else None
                    self.reject(rpc, value['config'])
                    self.assertEqual(len(rpc.calls), 4)
        rpc = ScriptedRPC(value)
        rpc.steps[3][2]['futureField'] = True
        self.reject(rpc, value['config'])

    def test_receipt_order_and_cumulative_gas_coverage_are_checked(self):
        for mode in ('swapped', 'duplicate', 'zero-first', 'equal', 'final'):
            with self.subTest(mode=mode):
                value = case()
                rpc = ScriptedRPC(value)
                if mode == 'swapped':
                    rpc.steps[3][2], rpc.steps[5][2] = rpc.steps[5][2], rpc.steps[3][2]
                elif mode == 'duplicate':
                    rpc.steps[5][2] = copy.deepcopy(rpc.steps[3][2])
                elif mode == 'zero-first':
                    rpc.steps[3][2]['cumulativeGasUsed'] = '0x0'
                elif mode == 'equal':
                    rpc.steps[5][2]['cumulativeGasUsed'] = rpc.steps[3][2]['cumulativeGasUsed']
                else:
                    rpc.steps[7][2]['cumulativeGasUsed'] = hex(int(value['header']['gasUsed'], 16) + 1)
                self.reject(rpc, value['config'])

    def test_optional_gas_used_matches_receipt_delta_and_failed_receipts_have_no_logs(self):
        value = case('legacy-nonce-zero')
        value['receipts'][0]['gasUsed'] = value['receipts'][0]['cumulativeGasUsed']
        rpc = ScriptedRPC(value)
        self.assertEqual(collector.collect(rpc, value['config'])['receipts'], value['receipts'])
        rpc = ScriptedRPC(value)
        rpc.steps[3][2]['gasUsed'] = '0x0'
        self.reject(rpc, value['config'], 'BODY_ACQUISITION_RECEIPT_GAS')
        rpc = ScriptedRPC(value)
        rpc.steps[3][2]['status'] = '0x0'
        rpc.steps[3][2]['logs'] = [{'address': '0x' + '11' * 20, 'topics': [], 'data': '0x'}]
        self.reject(rpc, value['config'], 'BODY_ACQUISITION_FAILED_RECEIPT_LOGS')

    def test_optional_log_attachment_metadata_cannot_conflict_with_the_receipt(self):
        baseline = {'address': '0x' + '11' * 20, 'topics': [], 'data': '0x'}
        value = case('legacy-nonce-zero')
        for field, invalid in (
            ('transactionHash', '0x' + '22' * 32), ('transactionIndex', '0x1'),
            ('blockHash', changed_hex(value['header']['hash'])), ('blockNumber', '0x0'),
            ('logIndex', '0x1'), ('removed', True), ('removed', None),
            ('address', '0x' + '11' * 19), ('topics', ['0x' + '00' * 31]),
            ('topics', ['0x' + '00' * 32] * 5), ('data', '0x0'), ('futureField', True),
        ):
            with self.subTest(field=field, invalid=invalid):
                rpc = ScriptedRPC(value)
                rpc.steps[3][2]['logs'] = [{**baseline, field: invalid}]
                self.reject(rpc, value['config'])

    def test_late_changes_to_either_selected_view_discard_the_complete_capture(self):
        for position in (-2, -1):
            for field in ('hash', 'number', 'transactionsRoot', 'extraData', 'transactions'):
                with self.subTest(position=position, field=field):
                    value = case()
                    rpc = ScriptedRPC(value)
                    header = rpc.steps[position][2]
                    if field in ('hash', 'transactionsRoot'):
                        header[field] = changed_hex(header[field])
                    elif field == 'number':
                        header[field] = hex(int(header[field], 16) + 1)
                    elif field == 'extraData':
                        header[field] = '0xdeadbeef'
                    else:
                        header[field].reverse()
                    self.reject(rpc, value['config'], 'BODY_ACQUISITION_HEADER_SELECTION' if field in ('hash', 'number')
                                else 'BODY_ACQUISITION_HEADER_CHANGED')
                    self.assertEqual(len(rpc.calls), len(rpc.steps) + position + 1)

    def test_whole_header_metadata_is_preserved_and_rechecked_for_exact_equality(self):
        value = case('legacy-nonce-zero')
        value['header']['size'] = '0x123'
        value['header']['totalDifficulty'] = '0x456'
        value['header']['uncles'] = []
        rpc = ScriptedRPC(value)
        self.assertEqual(collector.collect(rpc, value['config'])['header'], value['header'])
        for position in (1, -2, -1):
            with self.subTest(position=position):
                rpc = ScriptedRPC(value)
                rpc.steps[position][2]['size'] = '0x124'
                self.reject(rpc, value['config'], 'BODY_ACQUISITION_HEADER_DISAGREEMENT' if position == 1
                            else 'BODY_ACQUISITION_HEADER_CHANGED')

    def test_receipt_and_log_timestamps_preserve_matching_integer_and_hex_extensions(self):
        for as_integer in (False, True):
            with self.subTest(as_integer=as_integer):
                value = case('legacy-nonce-zero')
                timestamp = int(value['header']['timestamp'], 16) if as_integer else value['header']['timestamp']
                value['receipts'][0]['blockTimestamp'] = timestamp
                value['receipts'][0]['logs'] = [{'address': '0x' + '11' * 20, 'topics': [], 'data': '0x',
                                                'blockTimestamp': timestamp}]
                rpc = ScriptedRPC(value)
                result = collector.collect(rpc, value['config'])
                self.assertEqual(result['receipts'], value['receipts'])
                self.assertIs(type(result['receipts'][0]['blockTimestamp']), type(timestamp))
                self.assertIs(type(result['receipts'][0]['logs'][0]['blockTimestamp']), type(timestamp))

    def test_timestamp_extensions_reject_boolean_float_noncanonical_or_conflicting_values(self):
        for place in ('receipt', 'log'):
            for invalid in (True, False, 1000.0, 1001, '0x03e8', '0X3e8', '0x3E8', '1000', None):
                with self.subTest(place=place, invalid=invalid):
                    value = case('legacy-nonce-zero')
                    if type(invalid) is bool:
                        value['header']['timestamp'] = hex(int(invalid))
                    rpc = ScriptedRPC(value)
                    if place == 'receipt':
                        rpc.steps[3][2]['blockTimestamp'] = invalid
                    else:
                        rpc.steps[3][2]['logs'] = [{'address': '0x' + '11' * 20, 'topics': [], 'data': '0x',
                                                 'blockTimestamp': invalid}]
                    self.reject(rpc, value['config'])

    def test_detached_config_and_reply_snapshots_cannot_be_changed_by_the_caller(self):
        value = case()
        original = copy.deepcopy(value)

        def mutate_old_inputs(rpc, index):
            if index == 2:
                value['config']['block_hash'] = '0x' + '00' * 32
                rpc.steps[0][2]['extraData'] = '0xffff'

        rpc = ScriptedRPC(value, mutate_old_inputs)
        result = collector.collect(rpc, value['config'])
        self.assertEqual(result['selection'], original['config'])
        self.assertEqual(result['header'], original['header'])
        self.assertEqual(rpc.calls, rpc.expected_calls())
        before = copy.deepcopy(result)
        rpc.steps[1][2]['transactions'].clear()
        rpc.steps[3][2]['logs'].append({'data': '0xdeadbeef'})
        value['raw_transactions'].clear()
        value['receipts'].clear()
        self.assertEqual(result, before)

    def test_caller_controlled_conversion_and_deepcopy_hooks_are_not_invoked(self):
        calls = []

        class Hook:
            def __deepcopy__(self, memo):
                calls.append('deepcopy')
                raise AssertionError('untrusted hook ran')

            def __str__(self):
                calls.append('str')
                raise AssertionError('untrusted hook ran')

        class ExoticDict(dict):
            def items(self):
                calls.append('items')
                raise AssertionError('untrusted hook ran')

            def __iter__(self):
                calls.append('iter')
                raise AssertionError('untrusted hook ran')

        value = case()
        rpc = ScriptedRPC(value)
        rpc.steps[3][2]['from'] = Hook()
        self.reject(rpc, value['config'])
        rpc = ScriptedRPC(value)
        self.reject(rpc, ExoticDict(value['config']))
        self.assertEqual(calls, [])

    def test_cycles_non_json_values_and_malformed_strings_fail_closed(self):
        for kind in ('cycle', 'float', 'set', 'tuple', 'bytes', 'surrogate', 'negative', 'large-integer'):
            with self.subTest(kind=kind):
                value = case()
                rpc = ScriptedRPC(value)
                receipt = rpc.steps[3][2]
                if kind == 'cycle':
                    receipt['from'] = receipt
                else:
                    receipt['from'] = {'float': 1.5, 'set': {1}, 'tuple': (1,), 'bytes': b'0x',
                                       'surrogate': '\ud800', 'negative': -1, 'large-integer': 1 << 256}[kind]
                self.reject(rpc, value['config'])

    def test_syntactically_valid_altered_bytes_and_receipts_still_need_root_verification(self):
        value = case()
        rpc = ScriptedRPC(value)
        raw = rpc.steps[2][2]
        self.assertEqual(raw.count('ab' * 55), 1)
        rpc.steps[2][2] = raw.replace('ab' * 55, 'ac' + 'ab' * 54)
        rpc.steps[3][2]['status'] = '0x0'
        result = collector.collect(rpc, value['config'])
        self.assertNotEqual(result['raw_transactions'][0], value['raw_transactions'][0])
        self.assertEqual(result['receipts'][0]['status'], '0x0')
        self.assertEqual(result['header'], value['header'])
        self.assertEqual(set(result), {'schema', 'selection', 'header', 'raw_transactions', 'receipts'})

    def test_capture_does_not_masquerade_as_a_canonical_rlp_validator(self):
        value = case('legacy-nonce-zero')
        rpc = ScriptedRPC(value)
        rpc.steps[2][2] = '0xc0'
        result = collector.collect(rpc, value['config'])
        self.assertEqual(result['raw_transactions'], ['0xc0'])
        self.assertEqual(result['header']['transactionsRoot'], value['header']['transactionsRoot'])

    def test_consistent_rpc_hash_labels_and_sender_metadata_are_preserved_without_authentication(self):
        value = case('legacy-nonce-zero')
        forged = '0x' + 'bb' * 32
        value['header']['transactions'][0] = forged
        value['receipts'][0]['transactionHash'] = forged
        value['receipts'][0]['from'] = '0x' + 'cc' * 20
        value['receipts'][0]['to'] = '0x' + 'dd' * 20
        rpc = ScriptedRPC(value)
        result = collector.collect(rpc, value['config'])
        self.assertEqual(result['header']['transactions'], [forged])
        self.assertEqual(result['raw_transactions'], value['raw_transactions'])
        self.assertEqual(result['receipts'][0]['from'], '0x' + 'cc' * 20)
        self.assertNotIn('senderVerified', result)
        self.assertNotIn('transactionCommitmentVerified', result)

    def test_individually_bounded_unique_raw_envelopes_cannot_exceed_one_mib(self):
        value = expanded(case('calldata-limit-8192'), 128)
        lengths = [(len(raw) - 2) // 2 for raw in value['raw_transactions']]
        self.assertLessEqual(max(lengths), 16384)
        self.assertGreater(sum(lengths), 1048576)
        self.assertEqual(len(set(value['raw_transactions'])), 128)
        rpc = ScriptedRPC(value)
        self.reject(rpc, value['config'], 'BODY_ACQUISITION_RAW_TOTAL_BOUND')

    def test_receipt_log_counts_topics_and_data_are_bounded_before_retention(self):
        base_log = {'address': '0x' + '11' * 20, 'topics': [], 'data': '0x'}
        for logs in ([base_log] * 65, [{**base_log, 'data': '0x' + 'ab' * 8193}],
                     [{**base_log, 'topics': ['0x' + '00' * 32] * 5}]):
            with self.subTest(log_count=len(logs)):
                value = case('legacy-nonce-zero')
                rpc = ScriptedRPC(value)
                rpc.steps[3][2]['logs'] = copy.deepcopy(logs)
                self.reject(rpc, value['config'])

    def test_individually_bounded_receipts_cannot_exceed_total_log_or_rpc_byte_budgets(self):
        for kind in ('logs', 'bytes'):
            with self.subTest(kind=kind):
                value = expanded(case('legacy-nonce-zero'), 9)
                log = {'address': '0x' + '11' * 20, 'topics': [],
                       'data': '0x' if kind == 'logs' else '0x' + 'ab' * 8192}
                count = 64 if kind == 'logs' else 32
                for receipt in value['receipts']:
                    receipt['logs'] = [copy.deepcopy(log) for _ in range(count)]
                    self.assertLess(len(json.dumps(receipt, separators=(',', ':'))), 1024 * 1024)
                rpc = ScriptedRPC(value)
                self.reject(rpc, value['config'], 'BODY_ACQUISITION_LOG_BOUND' if kind == 'logs'
                            else 'BODY_ACQUISITION_RESPONSE_TOTAL_BOUND')

    def test_decoded_response_structure_header_and_receipt_byte_budgets_are_enforced(self):
        for kind in ('depth', 'array', 'nodes', 'header-bytes', 'receipt-bytes'):
            with self.subTest(kind=kind):
                value = case('legacy-nonce-zero')
                rpc = ScriptedRPC(value)
                if kind == 'depth':
                    child = None
                    for _ in range(25):
                        child = {'nested': child}
                    rpc.steps[3][2]['from'] = child
                elif kind == 'array':
                    rpc.steps[3][2]['from'] = [None] * 4097
                elif kind == 'nodes':
                    rpc.steps[3][2]['from'] = [[None] * 2048 for _ in range(100)]
                elif kind == 'header-bytes':
                    rpc.steps[0][2]['extraData'] = 'a' * (64 * 1024)
                else:
                    log = {'address': '0x' + '11' * 20, 'topics': [], 'data': '0x' + 'ab' * 8192}
                    rpc.steps[3][2]['logs'] = [copy.deepcopy(log) for _ in range(64)]
                    self.assertGreater(len(json.dumps(rpc.steps[3][2], separators=(',', ':'))), 1024 * 1024)
                self.reject(rpc, value['config'], 'BODY_ACQUISITION_ARRAY_BOUND' if kind == 'array'
                            else 'BODY_ACQUISITION_DATA_BOUND')


if __name__ == '__main__':
    unittest.main(verbosity=2)
