"""Replay signed local acquisition evidence without starting any transport.

The alpha.40 transcript parser and per-branch replay are reused with an explicit
in-memory schema adapter. Original trace bytes are never changed. Additional
checks bind captured raw envelopes to exact signed submissions and ensure the
trace used no impersonation or eth_sendTransaction. This is evidence extraction,
not a generic signature, sender, execution or consensus verifier.
"""
import argparse
import copy
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OLD = HERE / '../paid-body-acquisition/extract_body_evidence.py'
OLD_SHA = 'a32c902aeac1e1167e2e43cde82965520531a65edc90c42fb6cfbc03e9d9e8b1'
COLLECTOR = HERE / '../paid-body-acquisition/collect_body.py'
COLLECTOR_SHA = '7b0fe6536ef1daf5c0c9ffd08999e2becd410d8516c5ab8b7d01ca25e31b52fb'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok, code):
    if not ok:
        raise ValueError('SIGNED_EVIDENCE_' + code)


def load(path, pin, name):
    with path.open('rb') as handle:
        raw = handle.read(1024 * 1024 + 1)
    need(len(raw) <= 1024 * 1024 and sha(raw) == pin, 'MODULE_PIN')
    module = importlib.util.module_from_spec(importlib.util.spec_from_loader(name, loader=None))
    module.__file__ = str(path)
    sys.modules[name] = module
    exec(compile(raw, str(path), 'exec'), module.__dict__)
    return module


def extract(trace_path, inputs_path, input_pin):
    old = load(OLD, OLD_SHA, 'signed_evidence_prior_replay')
    collector = load(COLLECTOR, COLLECTOR_SHA, 'signed_evidence_collector')
    raw = old.read_bounded(trace_path, old.MAX_TRACE_BYTES)
    trace = old.parsed(raw, old.MAX_TRACE_BYTES)
    need(trace['schema'] == 'caw-paid-signed-body-acquisition-run/1', 'SCHEMA')
    input_raw = old.read_bounded(inputs_path, 65536)
    need(sha(input_raw) == input_pin == trace['input_manifest_sha256'], 'MANIFEST_PIN')
    manifest = old.parsed(input_raw, 65536)
    need(set(manifest) == {'schema', 'files'} and manifest['schema'] == 'caw-paid-signed-body-inputs/1', 'MANIFEST')
    need(type(manifest['files']) is dict and 1 <= len(manifest['files']) <= 64, 'SOURCE_COUNT')
    for name, pin in manifest['files'].items():
        need(type(name) is str and re.fullmatch(r'[A-Za-z0-9_./-]+', name) and not name.startswith('/'), 'SOURCE_NAME')
        path = (HERE / name).resolve()
        need(path.is_relative_to(ROOT) and sha(old.read_bounded(path, 8 * 1024 * 1024)) == pin, 'SOURCE_PIN')
    signing = trace['signing']
    need(set(signing) == {'cryptography_version', 'public_test_accounts', 'relayer_deployer_uses_test_signer_a',
                         'impersonation_enabled', 'real_wallet_used'}, 'SIGNING_FIELDS')
    accounts = ['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73']
    need(signing['public_test_accounts'] == accounts and signing['relayer_deployer_uses_test_signer_a'] is True
         and signing['impersonation_enabled'] is False and signing['real_wallet_used'] is False, 'SIGNING_PROFILE')
    # Only the schema envelope differs. All original data stays in the archive.
    adapted = copy.deepcopy(trace)
    del adapted['signing']
    del adapted['submissions']
    adapted['schema'] = 'caw-paid-body-acquisition-run/1'
    bounds = old.check_trace(adapted)
    branches, provenance = {}, {}
    for branch in ('left', 'right'):
        branches[branch], provenance[branch] = old.extract_branch(adapted, branch, bounds[branch], collector)
    left, right = branches['left'], branches['right']
    left_config, right_config = (trace['branches'][name]['config'] for name in ('left', 'right'))
    need(old.same({k: v for k, v in left_config.items() if not k.startswith('end_')},
                  {k: v for k, v in right_config.items() if not k.startswith('end_')}), 'BRANCH_COMMON_CONFIG')
    need(len(left) == len(right) and left[-1]['header']['number'] == right[-1]['header']['number']
         and left[-1]['header']['hash'] != right[-1]['header']['hash'], 'DISTINCT_TIPS')
    ancestor = int(trace['ancestor']['header']['number'], 16)
    need(left_config['start_block_number'] < ancestor < left_config['end_block_number'], 'ANCESTOR_INTERVAL')
    for a, b in zip(left, right):
        need(a['header']['number'] == b['header']['number'], 'BRANCH_HEIGHT')
        if int(a['header']['number'], 16) <= ancestor:
            need(old.same(a, b), 'COMMON_PREFIX')
        else:
            need(a['header']['hash'] != b['header']['hash'], 'BRANCH_SUFFIX')
        if int(a['header']['number'], 16) == ancestor:
            need(old.same(a['header'], trace['ancestor']['header']), 'ANCESTOR_HEADER')
    forbidden = {'eth_sendTransaction', 'anvil_impersonateAccount', 'anvil_stopImpersonatingAccount', 'anvil_autoImpersonateAccount'}
    need(not any(row['request']['method'] in forbidden for row in trace['rpc']), 'IMPERSONATION_OR_UNSIGNED_SEND')
    sent = [row for row in trace['rpc'] if row['request']['method'] == 'eth_sendRawTransaction']
    submissions = trace['submissions']
    need(type(submissions) is list and 1 <= len(submissions) == len(sent) <= 250, 'SUBMISSION_COUNT')
    for counter in ('local_transaction_attempts', 'local_signed_raw_attempts'):
        need(type(trace['node'].get(counter)) is int and trace['node'][counter] == len(sent), 'RAW_COUNTER')
    need(trace['node'].get('non_impersonated_submission') is True, 'RAW_POLICY')
    submitted = {}
    for item, row in zip(submissions, sent):
        need(type(item) is dict and item['test_sender'] in accounts and item['chain_id'] == 31337, 'SUBMISSION_PROFILE')
        need(item['known_test_public_key_signature_checked'] is True and item['local_precompile_parity_checked'] is True
             and item['generic_sender_verifier'] is False, 'SUBMISSION_BOUNDARY')
        need(row['label'] == item['label'] + '.send' and row['request']['params'] == [item['raw']]
             and row['response']['result'] == item['hash'], 'SUBMITTED_BYTES')
        need(item['hash'] not in submitted, 'DUPLICATE_SUBMISSION_HASH')
        submitted[item['hash']] = item
    for branch in branches.values():
        for capture in branch:
            for i, raw_tx in enumerate(capture['raw_transactions']):
                tx_hash = capture['header']['transactions'][i]
                need(tx_hash in submitted, 'UNRECORDED_BODY')
                item = submitted[tx_hash]
                need(raw_tx == item['raw'] and capture['receipts'][i]['transactionHash'] == tx_hash
                     and capture['receipts'][i]['from'] == item['test_sender']
                     and capture['header']['hash'] == item['block_hash']
                     and capture['header']['number'] == item['block_number'], 'ACQUIRED_SUBMISSION_BINDING')
    captures = {'schema': 'caw-local-body-captures/1', 'synthetic_chain': True,
                'independent_providers': False, 'branches': branches}
    buf = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=buf, compresslevel=9, mtime=0) as stream:
        stream.write(raw)
    compressed = buf.getvalue()
    need(gzip.decompress(compressed) == raw, 'ARCHIVE')
    evidence = {'schema': 'caw-local-signed-body-provenance/1', 'synthetic_chain': True,
        'execution_trace': {'file': 'execution-trace.json.gz', 'sha256': sha(raw), 'bytes': len(raw),
                            'compressed_sha256': sha(compressed), 'compressed_bytes': len(compressed)},
        'input_manifest_sha256': sha(input_raw), 'sources_checked': len(manifest['files']),
        'signing': signing, 'branches': provenance, 'counts': {'rpc_requests': len(trace['rpc']),
            'submitted_transactions': len(sent), 'captured_blocks': len(left) + len(right),
            'distinct_blocks': len({c['header']['hash'] for c in left + right})},
        'raw_transcript_replayed': True, 'captured_bytes_match_submissions': True,
        'impersonation_calls': 0, 'unsigned_submission_calls': 0,
        'verification_flags': {k: False for k in ('signaturesVerified', 'senderVerified', 'bodyCommitmentsVerified',
            'endpointAuthenticated', 'executionVerified', 'consensusVerified', 'finalityVerified', 'freshnessVerified')}}
    return {'body-captures.json': old.encoded(captures) + b'\n',
            'provenance.json': old.encoded(evidence) + b'\n', 'execution-trace.json.gz': compressed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trace', type=Path, required=True)
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--expected-input-sha256', required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    need(args.output_dir.parent.is_dir() and not args.output_dir.exists(), 'NEW_DIRECTORY')
    artifacts = extract(args.trace, args.inputs, args.expected_input_sha256)
    args.output_dir.mkdir()
    for name, data in artifacts.items():
        with (args.output_dir / name).open('xb') as out:
            out.write(data)
    print(json.dumps({'status': 'pass', 'files': {k: {'bytes': len(v), 'sha256': sha(v)} for k, v in artifacts.items()}}))


if __name__ == '__main__':
    main()
