"""Offline admission tests; no node constructor, process, or real transport.

Run with Python -I -B. The real inherited RPC validation and audit path run
against a patched in-memory transport. Imports use explicit local file paths.
The dummy envelope has scalar bounds only; these tests assert no sender proof.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


sys.dont_write_bytecode = True
PATH = Path(__file__).resolve().with_name('signed_node.py')
SPEC = importlib.util.spec_from_loader('caw_signed_node_under_test', loader=None)
NODE = importlib.util.module_from_spec(SPEC)
NODE.__file__ = str(PATH)
exec(compile(PATH.read_bytes(), str(PATH), 'exec'), NODE.__dict__)


class SignedNodeTests(unittest.TestCase):
    def setUp(self):
        self.node = NODE.SignedNode.__new__(NODE.SignedNode)
        self.node.phase, self.node.generation = 'prefix', 0
        self.node._request_id = 0
        self.node.transaction_count = 0
        self.node.local_signed_raw_attempts = 0
        self.node._signed_active = False
        self.node._signed_permission = None
        self.node._lease_active = self.node._body_active = False
        self.node._body_serial = 0
        self.node._body_generation = self.node._body_phase = None
        self.node._body_hashes = set()
        self.node._scope = SimpleNamespace(read_config={
            'start_block_number': 3, 'end_block_number': 8, 'addresses': {}
        }, getters={})
        self.node._control = None
        self.node._ancestor_snapshot = None
        self.node._snapshot_ids = set()
        self.node.calls, self.node.overrides = [], []
        self.node.stop_reason = None
        self.node._live = lambda: None
        self.node._halt = lambda reason: setattr(self.node, 'stop_reason', reason)
        self.node._record = lambda target, entry: target.append(copy.deepcopy(entry))
        self.envelope = NODE.codec.encode_signed(0, '0x' + 'ab' * 20, '0x', 1, 1, 0)
        self.raw, self.tx_hash = self.envelope['raw'], self.envelope['hash']
        self.response_error = None
        self.transport_failure = None
        self.callback = None

        def memory_post(url, request):
            self.assertEqual(url, NODE.BASE.LOCAL_URL)
            if self.callback is not None:
                self.callback()
            if self.transport_failure is not None:
                raise self.transport_failure
            response = {'jsonrpc': '2.0', 'id': request['id']}
            if self.response_error is not None:
                response['error'] = self.response_error
            else:
                response['result'] = self.tx_hash
            return response, json.dumps(response, separators=(',', ':'))

        transport_patch = patch.object(NODE.BASE, '_post', side_effect=memory_post)
        self.transport = transport_patch.start()
        self.addCleanup(transport_patch.stop)

    def assert_idle(self):
        self.assertFalse(self.node._signed_active)
        self.assertIsNone(self.node._signed_permission)

    def assert_refused(self, code, operation):
        before = self.transport.call_count
        with self.assertRaisesRegex(RuntimeError, '^' + code + '$'):
            operation()
        self.assertEqual(self.transport.call_count, before)

    def test_all_write_phases_submit_the_exact_raw_payload_through_inherited_rpc(self):
        for index, phase in enumerate(NODE.WRITE_PHASES):
            with self.subTest(phase=phase):
                self.node.phase, self.node.generation = phase, index
                self.assertEqual(self.node.submit_signed('writer.send', self.raw), self.tx_hash)
                row = self.node.calls[-1]
                self.assertEqual(row['label'], 'writer.send')
                self.assertEqual(row['request']['method'], 'eth_sendRawTransaction')
                self.assertEqual(row['request']['params'], [self.raw])
                self.assertEqual(row['response']['result'], self.tx_hash)
                self.assertIn('raw_response', row)
                self.assert_idle()
        self.assertEqual(self.node._request_id, 3)
        self.assertEqual(self.node.transaction_count, 3)
        self.assertEqual(self.node.local_signed_raw_attempts, 3)
        self.assertEqual(self.node.overrides, [])

    def test_direct_rpc_and_rpc_raw_never_authorize_raw_submission(self):
        for phase in ('prefix', 'write-left', 'read-left', 'switch-at-ancestor',
                      'write-right', 'read-right', 'closed'):
            self.node.phase = phase
            for method in (self.node.rpc, self.node.rpc_raw):
                with self.subTest(phase=phase, method=method.__name__):
                    self.assert_refused('SIGNED_RAW_SCOPE',
                        lambda: method('direct', 'eth_sendRawTransaction', [self.raw]))
        self.assertEqual(self.node.transaction_count, 0)
        self.assertEqual(self.node.calls, [])

    def test_unsigned_and_impersonation_methods_are_always_refused(self):
        actor = next(iter(NODE.BASE.ACTORS))
        for phase in ('prefix', 'write-left', 'read-left', 'write-right', 'read-right'):
            self.node.phase = phase
            for method in NODE.FORBIDDEN:
                with self.subTest(phase=phase, method=method):
                    self.assert_refused('SIGNED_METHOD_REFUSED',
                        lambda: self.node.rpc_raw('forbidden', method, [actor]))
        self.assertEqual(self.node.transaction_count, 0)

    def test_unlisted_signing_and_impersonation_aliases_stay_default_denied(self):
        for method in ('eth_signTransaction', 'eth_sign', 'personal_sendTransaction',
                       'hardhat_impersonateAccount', 'anvil_impersonateSignature'):
            with self.subTest(method=method):
                self.assert_refused('LOCAL_METHOD_REFUSED',
                    lambda: self.node.rpc_raw('alias', method, []))

    def test_submission_cannot_enter_read_closed_or_nested_read_scopes(self):
        for phase in ('read-left', 'switch-at-ancestor', 'read-right', 'closed'):
            self.node.phase = phase
            self.assert_refused('SIGNED_WRITE_SCOPE',
                lambda: self.node.submit_signed('writer.send', self.raw))
            self.assert_idle()
        self.node.phase = 'write-left'
        for flag in ('_lease_active', '_body_active'):
            with self.subTest(flag=flag):
                setattr(self.node, flag, True)
                self.assert_refused('SIGNED_WRITE_SCOPE',
                    lambda: self.node.submit_signed('writer.send', self.raw))
                setattr(self.node, flag, False)
                self.assert_idle()

    def test_body_read_lease_does_not_grant_raw_submission(self):
        self.node.phase = 'read-left'
        read = self.node.body_read_lease()
        self.assert_refused('SIGNED_RAW_SCOPE',
            lambda: read('eth_sendRawTransaction', [self.raw]))
        self.assertFalse(self.node._lease_active)
        self.assertFalse(self.node._body_active)
        self.assert_idle()

    def test_malformed_envelopes_never_enter_transport_or_consume_attempts(self):
        for raw in (None, '', '0x', '0x01', '0xc0', self.raw.upper()):
            with self.subTest(raw=raw):
                with self.assertRaises(NODE.codec.LegacyCodecError):
                    self.node.submit_signed('writer.send', raw)
                self.assert_idle()
        self.transport.assert_not_called()
        self.assertEqual(self.node.local_signed_raw_attempts, 0)

    def test_changed_raw_parameters_cannot_use_the_authorization(self):
        original = self.node.rpc
        other = NODE.codec.encode_signed(1, '0x' + 'ab' * 20, '0x', 1, 1, 0)['raw']

        def changed(label, method, params):
            return original(label, method, [other])

        with patch.object(self.node, 'rpc', side_effect=changed):
            self.assert_refused('SIGNED_RAW_SCOPE',
                lambda: self.node.submit_signed('writer.send', self.raw))
        self.assert_idle()
        self.assertEqual(self.node.transaction_count, 0)

    def test_phase_generation_and_read_scope_changes_before_transport_fail_closed(self):
        for field, value in (('phase', 'write-right'), ('generation', 1),
                             ('_lease_active', True), ('_body_active', True)):
            with self.subTest(field=field):
                self.node.phase, self.node.generation = 'prefix', 0
                self.node._lease_active = self.node._body_active = False
                original = self.node.rpc

                def changed(label, method, params):
                    setattr(self.node, field, value)
                    return original(label, method, params)

                with patch.object(self.node, 'rpc', side_effect=changed):
                    self.assert_refused('SIGNED_WRITE_SCOPE',
                        lambda: self.node.submit_signed('writer.send', self.raw))
                self.assert_idle()
        self.assertEqual(self.node.transaction_count, 0)

    def test_generation_change_after_transport_is_rejected_and_retained(self):
        self.callback = lambda: setattr(self.node, 'generation', 1)
        with self.assertRaisesRegex(RuntimeError, '^SIGNED_WRITE_SCOPE$'):
            self.node.submit_signed('writer.send', self.raw)
        self.assertEqual(len(self.node.calls), 1)
        self.assertEqual(self.node.transaction_count, 1)
        self.assert_idle()

    def test_nested_submission_and_second_identical_raw_call_cannot_reuse_permission(self):
        def nested():
            self.assertTrue(self.node._signed_active)
            self.assertIsNone(self.node._signed_permission)
            self.assert_refused('SIGNED_NESTED_SUBMISSION',
                lambda: self.node.submit_signed('nested', self.raw))
            self.assert_refused('SIGNED_RAW_SCOPE',
                lambda: self.node.rpc_raw('repeat', 'eth_sendRawTransaction', [self.raw]))

        self.callback = nested
        self.assertEqual(self.node.submit_signed('writer.send', self.raw), self.tx_hash)
        self.assertEqual(self.transport.call_count, 1)
        self.assertEqual(self.node.transaction_count, 1)
        self.assert_idle()

    def test_rpc_rejection_counts_once_and_clears_permission(self):
        self.response_error = {'code': -32000, 'message': 'synthetic rejection'}
        with self.assertRaisesRegex(RuntimeError, '^LOCAL_RPC_ERROR$'):
            self.node.submit_signed('writer.send', self.raw)
        self.assertEqual(self.node.transaction_count, 1)
        self.assertEqual(self.node.local_signed_raw_attempts, 1)
        self.assertIn('error', self.node.calls[0]['response'])
        self.assert_idle()
        self.response_error = None
        self.assertEqual(self.node.submit_signed('retry', self.raw), self.tx_hash)
        self.assertEqual(self.node.transaction_count, 2)

    def test_transport_failure_counts_once_and_retains_failed_attempt(self):
        self.transport_failure = TimeoutError('in-memory timeout')
        with self.assertRaisesRegex(RuntimeError, '^LOCAL_RPC_FAILED$'):
            self.node.submit_signed('writer.send', self.raw)
        self.assertEqual(self.node.stop_reason, 'LOCAL_RPC_FAILED')
        self.assertEqual(self.node.transaction_count, 1)
        self.assertEqual(self.node.local_signed_raw_attempts, 1)
        self.assertEqual(self.node.calls[0]['transport_error'], 'LOCAL_RPC_FAILED')
        self.assert_idle()

    def test_transaction_ceiling_includes_raw_attempts_and_refuses_251st(self):
        self.node.transaction_count = self.node.local_signed_raw_attempts = 249
        self.node.submit_signed('last', self.raw)
        self.assertEqual(self.node.transaction_count, 250)
        self.assert_refused('LOCAL_TRANSACTION_LIMIT',
            lambda: self.node.submit_signed('excess', self.raw))
        self.assertEqual(self.node.transaction_count, 250)
        self.assertEqual(self.node.local_signed_raw_attempts, 250)
        self.assertEqual(self.node.stop_reason, 'LOCAL_TRANSACTION_LIMIT')
        self.assert_idle()

    def test_original_request_ceiling_remains_1800(self):
        self.node._request_id = 1799
        self.node.submit_signed('last', self.raw)
        self.assertEqual(self.node._request_id, 1800)
        self.assert_refused('LOCAL_REQUEST_LIMIT',
            lambda: self.node.submit_signed('excess', self.raw))
        self.assertEqual(self.node.transaction_count, 1)
        self.assertEqual(self.node.local_signed_raw_attempts, 1)
        self.assertEqual(self.node.stop_reason, 'LOCAL_REQUEST_LIMIT')
        self.assert_idle()

    def test_bad_labels_and_liveness_failures_clear_permission_before_admission(self):
        self.assert_refused('LABEL_REFUSED',
            lambda: self.node.submit_signed('bad label', self.raw))
        self.assert_idle()
        with patch.object(self.node, '_live', side_effect=RuntimeError('NOT_LIVE')):
            self.assert_refused('NOT_LIVE',
                lambda: self.node.submit_signed('writer.send', self.raw))
        self.assertEqual(self.node.transaction_count, 0)
        self.assert_idle()

    def test_existing_balance_and_read_allowlists_still_apply(self):
        actor = next(iter(NODE.BASE.ACTORS))
        self.node.rpc('fund', 'anvil_setBalance', [actor, '0x1'])
        self.assertEqual(self.node.overrides[0]['method'], 'anvil_setBalance')
        self.assert_refused('LOCAL_METHOD_REFUSED',
            lambda: self.node.rpc('excess', 'anvil_setBalance', [actor, hex(10 ** 18 + 1)]))
        self.node.phase = 'read-left'
        read = self.node.read_lease('number')
        self.assert_refused('ACQUISITION_READ_ONLY_SCOPE',
            lambda: read('anvil_setBalance', [actor, '0x1']))
        self.assertEqual(self.node.transaction_count, 0)

    def test_receipt_adds_submission_facts_without_sender_verification_claim(self):
        retained = {'schema': 'caw-local-node/1', 'limits': {'local_requests': 1800},
                    'local_transaction_attempts': 3}
        self.node.local_signed_raw_attempts = 3
        with patch.object(NODE.module.BodyNode, 'receipt', return_value=copy.deepcopy(retained)):
            receipt = self.node.receipt()
        self.assertEqual(receipt, {**retained, 'local_signed_raw_attempts': 3,
                                  'non_impersonated_submission': True})


if __name__ == '__main__':
    unittest.main()
