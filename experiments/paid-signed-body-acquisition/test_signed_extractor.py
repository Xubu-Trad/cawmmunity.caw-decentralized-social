"""Offline regression tests for extraction of the retained alpha.41 trace.

These tests reuse the actual, pinned local experiment. Mutated copies are
adversarial test inputs, not new live evidence. Only temporary trace files are
written; the retained archive, capture data, manifest and frozen source files
must remain unchanged. Extraction loads no node or writer and starts no RPC.
Run explicitly with Python -I -B and only standard-library dependencies.
"""

import copy
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
MAX_TRACE = 8 * 1024 * 1024
PINS = {
    'execution-trace.json.gz': 'd98a1b7c2e5d28bc05b75e427b7e2eacb7e237c6756c6dd460124feb6e18a276',
    'body-captures.json': 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36',
    'experiment-inputs.json': 'bc36f989ffdb8f323511de9d562f48778710d415072b646f89d6c47ca21311d2',
}
TRACE_SHA256 = '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975'
MANIFEST_SHA256 = PINS['experiment-inputs.json']


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_bounded(path, maximum):
    with path.open('rb') as stream:
        raw = stream.read(maximum + 1)
    if not 0 < len(raw) <= maximum:
        raise AssertionError('test input byte bound')
    return raw


spec = importlib.util.spec_from_file_location('signed_extractor_under_test', HERE / 'extract_signed_evidence.py')
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)


class SignedExtractorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.retained = {name: read_bounded(HERE / name, 1048576) for name in PINS}
        for name, raw in cls.retained.items():
            if sha(raw) != PINS[name]:
                raise AssertionError('retained input pin: ' + name)
        with gzip.GzipFile(fileobj=io.BytesIO(cls.retained['execution-trace.json.gz']), mode='rb') as stream:
            cls.original = stream.read(MAX_TRACE + 1)
        if len(cls.original) > MAX_TRACE or sha(cls.original) != TRACE_SHA256:
            raise AssertionError('expanded trace pin or bound')
        cls.trace = json.loads(cls.original)
        cls.source_pins = json.loads(cls.retained['experiment-inputs.json'])['files']
        cls.temporary = tempfile.TemporaryDirectory(prefix='caw-signed-extractor-tests-')
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.addClassCleanup(cls.assert_frozen_inputs)
        # A regression that imports a node or tries a subprocess/network path
        # must fail before it can create such a side effect.
        for target in ((socket, 'socket'), (subprocess, 'Popen')):
            guard = patch.object(*target, side_effect=AssertionError('EXTERNAL_EXECUTION_FORBIDDEN'))
            guard.start()
            cls.addClassCleanup(guard.stop)

    @classmethod
    def assert_frozen_inputs(cls):
        for name, before in cls.retained.items():
            if read_bounded(HERE / name, 1048576) != before:
                raise AssertionError('retained input changed: ' + name)
        for name, expected in cls.source_pins.items():
            if sha(read_bounded(HERE / name, MAX_TRACE)) != expected:
                raise AssertionError('frozen source changed: ' + name)

    def write_trace(self, value=None, raw=None):
        data = raw if raw is not None else (json.dumps(value, ensure_ascii=True, separators=(',', ':')) + '\n').encode('ascii')
        self.assertLessEqual(len(data), MAX_TRACE)
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.json', dir=self.temporary.name, delete=False) as stream:
            stream.write(data)
            path = Path(stream.name)
        self.addCleanup(path.unlink)
        return path

    def rejected(self, trace, reason, manifest_pin=MANIFEST_SHA256):
        path = self.write_trace(trace)
        with self.assertRaises(ValueError) as caught:
            extractor.extract(path, HERE / 'experiment-inputs.json', manifest_pin)
        self.assertEqual(str(caught.exception), reason)

    def changed(self):
        return copy.deepcopy(self.trace)

    def test_success_replays_exact_captures_preserves_archive_and_retains_false_verification_flags(self):
        path = self.write_trace(raw=self.original)
        outputs = extractor.extract(path, HERE / 'experiment-inputs.json', MANIFEST_SHA256)
        self.assertEqual(set(outputs), {'body-captures.json', 'provenance.json', 'execution-trace.json.gz'})
        self.assertEqual(outputs['body-captures.json'], self.retained['body-captures.json'])
        self.assertEqual(outputs['execution-trace.json.gz'], self.retained['execution-trace.json.gz'])
        self.assertEqual(gzip.decompress(outputs['execution-trace.json.gz']), self.original)
        provenance = json.loads(outputs['provenance.json'])
        self.assertEqual(provenance['schema'], 'caw-local-signed-body-provenance/1')
        self.assertEqual(provenance['counts'], {'rpc_requests': 884, 'submitted_transactions': 22,
                                               'captured_blocks': 30, 'distinct_blocks': 20})
        self.assertIs(provenance['raw_transcript_replayed'], True)
        self.assertIs(provenance['captured_bytes_match_submissions'], True)
        self.assertEqual((provenance['impersonation_calls'], provenance['unsigned_submission_calls']), (0, 0))
        self.assertEqual(provenance['verification_flags'], {name: False for name in (
            'signaturesVerified', 'senderVerified', 'bodyCommitmentsVerified', 'endpointAuthenticated',
            'executionVerified', 'consensusVerified', 'finalityVerified', 'freshnessVerified')})
        captures = json.loads(outputs['body-captures.json'])
        self.assertIs(captures['synthetic_chain'], True)
        self.assertIs(captures['independent_providers'], False)
        self.assertEqual(len(captures['branches']['left']), 15)
        self.assertEqual(len(captures['branches']['right']), 15)
        self.assertEqual(path.read_bytes(), self.original)
        # Returned artifacts are detached bytes. Altering the output mapping or
        # decoded copies cannot modify retained captures or their trace.
        captures['branches']['left'].clear()
        outputs['execution-trace.json.gz'] = b'changed caller result'
        self.assert_frozen_inputs()

    def test_wrong_manifest_pin_rejects_before_collector_replay(self):
        self.rejected(self.trace, 'SIGNED_EVIDENCE_MANIFEST_PIN', manifest_pin='0' * 64)

    def test_wrong_trace_schema_cannot_silently_use_the_unsigned_adapter(self):
        trace = self.changed()
        trace['schema'] = 'caw-paid-body-acquisition-run/1'
        self.rejected(trace, 'SIGNED_EVIDENCE_SCHEMA')

    def test_signing_profile_rejects_impersonation_wallet_or_changed_relayer_policy(self):
        for field, invalid in (('impersonation_enabled', True), ('real_wallet_used', True),
                               ('relayer_deployer_uses_test_signer_a', False)):
            with self.subTest(field=field):
                trace = self.changed()
                trace['signing'][field] = invalid
                self.rejected(trace, 'SIGNED_EVIDENCE_SIGNING_PROFILE')

    def test_failed_cleanup_cannot_be_relabelled_as_successful_evidence(self):
        trace = self.changed()
        trace['owned_listener_released'] = False
        self.rejected(trace, 'BODY_EVIDENCE_LIFECYCLE_FLAGS')

    def test_decoded_rpc_response_cannot_diverge_from_the_retained_wire_response(self):
        trace = self.changed()
        row = next(row for row in trace['rpc'] if row['response'].get('result') is not None)
        row['response']['result'] = None
        self.rejected(trace, 'BODY_EVIDENCE_RAW_RESPONSE_MISMATCH')

    def test_duplicate_top_level_json_fields_are_rejected_before_replay(self):
        duplicated = b'{"schema":"caw-paid-signed-body-acquisition-run/1",' + self.original.lstrip()[1:]
        path = self.write_trace(raw=duplicated)
        with self.assertRaises(ValueError) as caught:
            extractor.extract(path, HERE / 'experiment-inputs.json', MANIFEST_SHA256)
        self.assertEqual(str(caught.exception), 'BODY_EVIDENCE_DUPLICATE_JSON_KEY')

    def test_branch_runtime_inputs_must_match_even_when_each_old_manifest_agrees_locally(self):
        trace = self.changed()
        right = trace['branches']['right']
        changed = '0' * 64
        self.assertNotEqual(right['config']['registry_runtime_sha256'], changed)
        right['config']['registry_runtime_sha256'] = changed
        # Repair each branch-local comparison so the cross-branch guard itself
        # must reject; actual body replies, ranges and headers remain intact.
        for route in ('number', 'hash'):
            right['collectors'][route]['manifest']['registry_runtime_sha256'] = changed
        self.rejected(trace, 'SIGNED_EVIDENCE_BRANCH_COMMON_CONFIG')

    def test_ancestor_must_lie_strictly_inside_the_shared_selected_interval(self):
        trace = self.changed()
        trace['ancestor']['header']['number'] = hex(trace['branches']['left']['config']['start_block_number'])
        self.rejected(trace, 'SIGNED_EVIDENCE_ANCESTOR_INTERVAL')

    def test_ancestor_header_must_equal_the_captured_header_at_that_height(self):
        trace = self.changed()
        before = trace['ancestor']['header']['extraData']
        trace['ancestor']['header']['extraData'] = '0x01' if before != '0x01' else '0x02'
        self.rejected(trace, 'SIGNED_EVIDENCE_ANCESTOR_HEADER')

    def test_signed_attempt_counters_and_non_impersonation_policy_are_consistent(self):
        for field in ('local_transaction_attempts', 'local_signed_raw_attempts', 'non_impersonated_submission'):
            with self.subTest(field=field):
                trace = self.changed()
                if field == 'non_impersonated_submission':
                    trace['node'][field] = False
                    reason = 'SIGNED_EVIDENCE_RAW_POLICY'
                else:
                    trace['node'][field] += 1
                    reason = 'SIGNED_EVIDENCE_RAW_COUNTER'
                self.rejected(trace, reason)

    def test_unsigned_submission_is_forbidden_even_with_unchanged_response_and_counts(self):
        trace = self.changed()
        row = next(row for row in trace['rpc'] if row['request']['method'] == 'eth_sendRawTransaction')
        row['request']['method'] = 'eth_sendTransaction'
        self.rejected(trace, 'SIGNED_EVIDENCE_IMPERSONATION_OR_UNSIGNED_SEND')

    def test_submission_raw_bytes_must_match_the_exact_rpc_request(self):
        trace = self.changed()
        raw = trace['submissions'][0]['raw']
        trace['submissions'][0]['raw'] = raw[:-2] + ('02' if raw.endswith('01') else '01')
        self.rejected(trace, 'SIGNED_EVIDENCE_SUBMITTED_BYTES')

    def test_submission_signature_parity_and_generic_verifier_claims_cannot_be_changed(self):
        for field, invalid in (('known_test_public_key_signature_checked', False),
                               ('local_precompile_parity_checked', False), ('generic_sender_verifier', True)):
            with self.subTest(field=field):
                trace = self.changed()
                trace['submissions'][0][field] = invalid
                self.rejected(trace, 'SIGNED_EVIDENCE_SUBMISSION_BOUNDARY')

    def test_acquired_body_must_attach_to_its_recorded_submission_block(self):
        trace = self.changed()
        first = trace['branches']['left']['body_captures'][0]['capture']
        tx_hash = first['header']['transactions'][0]
        submission = next(item for item in trace['submissions'] if item['hash'] == tx_hash)
        submission['block_hash'] = '0x' + '00' * 32
        self.rejected(trace, 'SIGNED_EVIDENCE_ACQUIRED_SUBMISSION_BINDING')


if __name__ == '__main__':
    unittest.main(verbosity=2)
