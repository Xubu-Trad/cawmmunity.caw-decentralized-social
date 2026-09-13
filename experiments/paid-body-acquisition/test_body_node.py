"""Offline lease tests: no node construction, process or transport invocation.

Run explicitly with Python -I -B. The wrapper is loaded by absolute file path;
sys.path is unchanged. The inherited RPC method is replaced with an in-memory
stub that still applies the real parameter allowlist before counting a request.
"""
import copy
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


sys.dont_write_bytecode = True
WRAPPER_PATH = Path(__file__).resolve().with_name('body_node.py')
SPEC = importlib.util.spec_from_loader('caw_body_node_under_test', loader=None)
NODE = importlib.util.module_from_spec(SPEC)
NODE.__file__ = str(WRAPPER_PATH)
exec(compile(WRAPPER_PATH.read_bytes(), str(WRAPPER_PATH), 'exec'), NODE.__dict__)

BLOCK_HASH = '0x' + 'ab' * 32
TX_HASH = '0x' + 'cd' * 32
OTHER_HASH = '0x' + 'ef' * 32
RAW = '0xc98080808080801b8080'


class BodyNodeTests(unittest.TestCase):
    def setUp(self):
        # Bypass every constructor: even the synthetic runtime is not loaded.
        self.node = NODE.BodyNode.__new__(NODE.BodyNode)
        self.node.phase = 'read-left'
        self.node.generation = 2
        self.node._request_id = 0
        self.node.calls = []
        self.node._scope = SimpleNamespace(read_config={
            'start_block_number': 3, 'end_block_number': 8, 'addresses': {}
        }, getters={})
        self.node._lease_active = False
        self.node._control = None
        self.node._body_active = False
        self.node._body_serial = 0
        self.node._body_generation = None
        self.node._body_phase = None
        self.node._body_hashes = set()
        self.response = self.header()
        self.failure = None
        self.callback = None

        def memory_rpc(node, label, method, params):
            captured = copy.deepcopy(params)
            node._params(method, captured)
            node._request_id += 1
            node.calls.append({'label': label, 'request': {
                'id': node._request_id, 'method': method, 'params': captured
            }})
            if self.callback is not None:
                self.callback()
            if self.failure is not None:
                raise self.failure
            if method in ('eth_getBlockByNumber', 'eth_getBlockByHash'):
                return copy.deepcopy(self.response)
            if method == 'eth_getRawTransactionByHash':
                return RAW
            return '0x7a69'

        # A mistaken path to real RPC fails before any liveness or network work.
        transport_patch = patch.object(NODE.BASE.Node, 'rpc_raw',
            side_effect=AssertionError('REAL_RPC_FORBIDDEN'))
        self.transport = transport_patch.start()
        self.addCleanup(transport_patch.stop)
        rpc_patch = patch.object(NODE.module.ReorgNode, 'rpc', new=memory_rpc)
        rpc_patch.start()
        self.addCleanup(rpc_patch.stop)

    @staticmethod
    def header(number='0x4', transaction_hashes=None):
        return {'number': number, 'hash': BLOCK_HASH,
                'transactions': [TX_HASH] if transaction_hashes is None else transaction_hashes}

    def tearDown(self):
        self.transport.assert_not_called()

    def assert_idle(self):
        self.assertFalse(self.node._lease_active)
        self.assertFalse(self.node._body_active)

    def assert_refused(self, code, operation):
        before = len(self.node.calls)
        with self.assertRaisesRegex(RuntimeError, '^' + code + '$'):
            operation()
        self.assertEqual(len(self.node.calls), before)

    def learn(self, read, method='eth_getBlockByNumber'):
        params = ['0x4', False] if method == 'eth_getBlockByNumber' else [BLOCK_HASH, False]
        return read(method, params)

    def test_direct_raw_is_refused_even_after_a_body_lease_learns_it(self):
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: self.node.rpc('direct', 'eth_getRawTransactionByHash', [TX_HASH]))
        read = self.node.body_read_lease()
        self.learn(read)
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: self.node.rpc('direct', 'eth_getRawTransactionByHash', [TX_HASH]))
        self.assert_idle()

    def test_body_lease_and_raw_scope_are_unavailable_outside_read_phases(self):
        for phase in ('prefix', 'write-left', 'switch-at-ancestor', 'write-right', 'closed'):
            with self.subTest(phase=phase):
                self.node.phase = phase
                self.assert_refused('BODY_READ_PHASE', self.node.body_read_lease)
                self.assert_refused('BODY_RAW_SCOPE',
                    lambda: self.node.rpc('direct', 'eth_getRawTransactionByHash', [TX_HASH]))

    def test_only_previously_observed_hashes_are_admitted(self):
        read = self.node.body_read_lease()
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: read('eth_getRawTransactionByHash', [TX_HASH]))
        self.assert_idle()
        observed = self.learn(read)
        observed['transactions'].append(OTHER_HASH)
        self.assertEqual(read('eth_getRawTransactionByHash', [TX_HASH]), RAW)
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: read('eth_getRawTransactionByHash', [OTHER_HASH]))
        self.assertEqual(self.node._body_hashes, {TX_HASH})
        self.assertEqual([row['label'] for row in self.node.calls],
                         ['collector.left.body.0', 'collector.left.body.1'])
        self.assert_idle()

    def test_hash_header_read_learns_only_in_the_body_lease(self):
        old = self.node.read_lease('hash')
        self.learn(old, 'eth_getBlockByHash')
        self.assertEqual(self.node._body_hashes, set())
        read = self.node.body_read_lease()
        self.learn(read, 'eth_getBlockByHash')
        self.assertEqual(read('eth_getRawTransactionByHash', [TX_HASH]), RAW)
        self.assert_idle()

    def test_existing_number_and_hash_leases_cannot_use_body_raw_scope(self):
        read = self.node.body_read_lease()
        self.learn(read)
        for name in ('number', 'hash'):
            with self.subTest(name=name):
                old = self.node.read_lease(name)
                self.assert_refused('BODY_RAW_SCOPE',
                    lambda: old('eth_getRawTransactionByHash', [TX_HASH]))
                self.assert_idle()

    def test_raw_parameter_shape_has_no_alias_or_debug_fallback(self):
        read = self.node.body_read_lease()
        self.learn(read)
        for params in (None, (), [], [TX_HASH, TX_HASH], [0], ['0x1'], [TX_HASH.upper()]):
            with self.subTest(params=params):
                self.assert_refused('BODY_RAW_SCOPE',
                    lambda: read('eth_getRawTransactionByHash', params))
                self.assert_idle()
        for method, params in (
                ('debug_getRawTransaction', [TX_HASH]),
                ('eth_getRawTransactionByBlockNumberAndIndex', ['0x4', '0x0']),
                ('eth_getRawTransactionByBlockHashAndIndex', [BLOCK_HASH, '0x0'])):
            with self.subTest(method=method):
                self.assert_refused('ACQUISITION_READ_ONLY_SCOPE', lambda: read(method, params))

    def test_phase_or_generation_change_retires_body_lease_before_rpc(self):
        for change in ('phase', 'generation'):
            with self.subTest(change=change):
                self.node.phase, self.node.generation = 'read-left', 2
                read = self.node.body_read_lease()
                self.learn(read)
                if change == 'phase':
                    self.node.phase = 'read-right'
                else:
                    self.node.generation += 1
                self.assert_refused('REORG_RETIRED_LEASE',
                    lambda: read('eth_getRawTransactionByHash', [TX_HASH]))
                self.assert_idle()

    def test_replacement_lease_retires_prior_serial_and_clears_hashes(self):
        old = self.node.body_read_lease()
        self.learn(old)
        replacement = self.node.body_read_lease()
        self.assertEqual(self.node._body_hashes, set())
        self.assert_refused('REORG_RETIRED_LEASE', lambda: old('eth_chainId', []))
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: replacement('eth_getRawTransactionByHash', [TX_HASH]))
        self.response = self.header(transaction_hashes=[OTHER_HASH])
        self.learn(replacement)
        self.assertEqual(replacement('eth_getRawTransactionByHash', [OTHER_HASH]), RAW)
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: replacement('eth_getRawTransactionByHash', [TX_HASH]))

    def test_right_body_lease_uses_right_label(self):
        self.node.phase = 'read-right'
        read = self.node.body_read_lease()
        self.learn(read)
        self.assertEqual(self.node.calls[0]['label'], 'collector.right.body.0')
        self.assert_idle()

    def test_nested_lease_creation_and_nested_reads_are_refused(self):
        read = self.node.body_read_lease()
        old = self.node.read_lease('number')

        def nested_attempts():
            self.assert_refused('REORG_NESTED_LEASE', self.node.body_read_lease)
            self.assert_refused('REORG_NESTED_LEASE', lambda: read('eth_chainId', []))
            self.assert_refused('REORG_NESTED_LEASE', lambda: old('eth_chainId', []))
            self.assertTrue(self.node._lease_active)
            self.assertTrue(self.node._body_active)

        self.callback = nested_attempts
        self.assertEqual(read('eth_chainId', []), '0x7a69')
        self.assertEqual(len(self.node.calls), 1)
        self.assert_idle()

    def test_rpc_failure_resets_both_active_flags(self):
        read = self.node.body_read_lease()
        self.failure = RuntimeError('SIMULATED_RPC_FAILURE')
        with self.assertRaisesRegex(RuntimeError, '^SIMULATED_RPC_FAILURE$'):
            self.learn(read)
        self.assertEqual(len(self.node.calls), 1)
        self.assertEqual(self.node._body_hashes, set())
        self.assert_idle()
        self.failure = None
        self.learn(read)
        self.assertEqual(read('eth_getRawTransactionByHash', [TX_HASH]), RAW)

    def test_generation_change_during_header_response_does_not_learn(self):
        read = self.node.body_read_lease()
        self.callback = lambda: setattr(self.node, 'generation', self.node.generation + 1)
        with self.assertRaisesRegex(RuntimeError, '^REORG_RETIRED_LEASE$'):
            self.learn(read)
        self.assertEqual(self.node._body_hashes, set())
        self.assert_idle()

    def test_inherited_allowlist_still_refuses_writes_and_controller_methods(self):
        read = self.node.body_read_lease()
        for method, params, code in (
                ('anvil_setBalance', [NODE.BASE.TOKEN, '0x1'], 'ACQUISITION_READ_ONLY_SCOPE'),
                ('eth_sendTransaction', [{}], 'ACQUISITION_READ_ONLY_SCOPE'),
                ('anvil_setCode', [NODE.BASE.TOKEN, '0x'], 'ACQUISITION_READ_ONLY_SCOPE'),
                ('evm_snapshot', [], 'REORG_CONTROLLER_ONLY'),
                ('evm_revert', ['0x1'], 'REORG_CONTROLLER_ONLY')):
            with self.subTest(method=method):
                self.assert_refused(code, lambda: read(method, params))
                self.assert_idle()
        self.assertEqual(read('eth_chainId', []), '0x7a69')
        self.assert_idle()

    def test_malformed_or_out_of_range_headers_do_not_learn_hashes(self):
        invalid = [None, [], {}, self.header('0x2'), self.header('0x9'),
                   self.header('0x04'), self.header(4), self.header(transaction_hashes=()),
                   self.header(transaction_hashes=[{'hash': OTHER_HASH}]),
                   self.header(transaction_hashes=['0x1']),
                   self.header(transaction_hashes=[OTHER_HASH] * 257)]
        wrong_hash = self.header(transaction_hashes=[OTHER_HASH])
        wrong_hash['hash'] = '0x1'
        invalid.append(wrong_hash)
        for index, response in enumerate(invalid):
            with self.subTest(case=index):
                read = self.node.body_read_lease()
                self.response = self.header()
                self.learn(read)
                self.response = response
                with self.assertRaisesRegex(RuntimeError, '^BODY_HEADER_SCOPE$'):
                    self.learn(read)
                self.assertEqual(self.node._body_hashes, {TX_HASH})
                self.assert_refused('BODY_RAW_SCOPE',
                    lambda: read('eth_getRawTransactionByHash', [OTHER_HASH]))
                self.assert_idle()

    def test_empty_header_is_allowed_without_granting_raw_access(self):
        read = self.node.body_read_lease()
        self.response = self.header(transaction_hashes=[])
        self.learn(read)
        self.assertEqual(self.node._body_hashes, set())
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: read('eth_getRawTransactionByHash', [TX_HASH]))

    def test_total_learned_hashes_are_bounded_across_headers(self):
        read = self.node.body_read_lease()
        hashes = ['0x' + format(index, '064x') for index in range(256)]
        self.response = self.header(transaction_hashes=hashes)
        self.learn(read)
        self.assertEqual(len(self.node._body_hashes), 256)
        self.assertEqual(read('eth_getRawTransactionByHash', [hashes[-1]]), RAW)
        self.response = self.header(transaction_hashes=[OTHER_HASH])
        with self.assertRaisesRegex(RuntimeError, '^BODY_TRANSACTION_LIMIT$'):
            self.learn(read)
        self.assertEqual(self.node._body_hashes, set(hashes))
        self.assert_refused('BODY_RAW_SCOPE',
            lambda: read('eth_getRawTransactionByHash', [OTHER_HASH]))
        self.assert_idle()


if __name__ == '__main__':
    unittest.main()
