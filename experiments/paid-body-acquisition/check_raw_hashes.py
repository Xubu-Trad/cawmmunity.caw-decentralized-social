"""Bounded offline Keccak diagnostics for the retained synthetic body captures.

Reads one body-captures.json of at most 1 MiB and writes only JSON to stdout.
No node, collector, transport, wallet, library installation or file writer is
loaded. The existing hash-pinned Python fixture primitive supplies Keccak; its
reuse is disclosed rather than presented as another cryptographic oracle.

For legacy envelopes only, also compare Keccak(raw || RPC receipt.from). The
Foundry v1.8.1 impersonated-transaction label uses transaction RLP followed by
the impersonated sender bytes, while encode_2718 preserves transaction bytes.
Legacy RLP equals its raw envelope; do not generalize this concatenation test
to typed envelopes. RPC from is unverified metadata, never sender evidence.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
PRIMITIVE = ROOT / 'reference' / 'fixtures' / 'generate-ethereum-proof-fixtures.py'
PRIMITIVE_SHA256 = '5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa'
MAX_INPUT = 1048576
MAX_CAPTURES = 30
MAX_TRANSACTIONS = 256
MAX_RAW = 16384
MAX_OUTPUT = 65536
HEX = re.compile(r'0x(?:[0-9a-f]{2})*\Z')
QUANTITY = re.compile(r'0x(?:0|[1-9a-f][0-9a-f]{0,15})\Z')


def need(condition, reason):
    if not condition:
        raise ValueError('RAW_HASH_DIAGNOSTIC_' + reason)


def read_bounded(path, limit):
    with path.open('rb') as handle:
        raw = handle.read(limit + 1)
    need(0 < len(raw) <= limit, 'FILE_BOUND')
    return raw


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def json_integer(text):
    need(len(text) <= 16, 'JSON_INTEGER_BOUND')
    return int(text)


def reject_constant(_value):
    raise ValueError('RAW_HASH_DIAGNOSTIC_JSON_CONSTANT')


def parse(raw):
    result = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object,
                        parse_int=json_integer, parse_constant=reject_constant)
    pending, count = [(result, 0)], 0
    while pending:
        value, depth = pending.pop()
        count += 1
        need(count <= 100000 and depth <= 24, 'JSON_STRUCTURE_BOUND')
        kind = type(value)
        if kind is dict:
            need(len(value) <= 64 and all(type(key) is str and len(key) <= 96
                 and not any(0xd800 <= ord(char) <= 0xdfff for char in key)
                 for key in value), 'JSON_KEYS')
            pending.extend((child, depth + 1) for child in value.values())
        elif kind is list:
            need(len(value) <= 2048, 'JSON_ARRAY_BOUND')
            pending.extend((child, depth + 1) for child in value)
        elif kind is str:
            need(len(value) <= 262144 and not any(0xd800 <= ord(char) <= 0xdfff for char in value), 'JSON_STRING')
        elif kind is int:
            need(0 <= value <= (1 << 53) - 1, 'JSON_INTEGER_BOUND')
        else:
            need(value is None or kind is bool, 'JSON_TYPE')
    return result


def exact(value, names):
    need(type(value) is dict and set(value) == set(names), 'FIELDS')


def hex_bytes(value, maximum, minimum=0, exact_size=None):
    need(type(value) is str and 2 + minimum * 2 <= len(value) <= 2 + maximum * 2
         and HEX.fullmatch(value), 'HEX')
    raw = bytes.fromhex(value[2:])
    need(exact_size is None or len(raw) == exact_size, 'HEX_WIDTH')
    return raw


def hash_text(value):
    hex_bytes(value, 32, exact_size=32)
    return value


def primitive():
    source = read_bounded(PRIMITIVE, MAX_INPUT)
    need(hashlib.sha256(source).hexdigest() == PRIMITIVE_SHA256, 'PRIMITIVE_PIN')
    scope = {'__name__': 'raw_hash_diagnostic_pinned_primitive', '__file__': str(PRIMITIVE)}
    # Execute exactly the bytes whose hash was checked; its main writer is not
    # invoked, and no path is reread between pin verification and loading.
    exec(compile(source, str(PRIMITIVE), 'exec'), scope)
    digest = scope['digest']
    need(digest(b'').hex() == 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470', 'EMPTY_KECCAK')
    need(digest(b'abc').hex() == '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45', 'ABC_KECCAK')
    return digest


def check(path):
    raw_input = read_bounded(path, MAX_INPUT)
    value = parse(raw_input)
    exact(value, ('schema', 'synthetic_chain', 'independent_providers', 'branches'))
    need(value['schema'] == 'caw-local-body-captures/1' and value['synthetic_chain'] is True
         and value['independent_providers'] is False, 'CAPTURE_PROFILE')
    exact(value['branches'], ('left', 'right'))
    need(all(type(items) is list and 1 <= len(items) <= MAX_CAPTURES
             for items in value['branches'].values())
         and sum(map(len, value['branches'].values())) <= MAX_CAPTURES, 'CAPTURE_BOUND')
    digest = primitive()
    totals = {name: 0 for name in ('captures', 'transaction_observations', 'raw_bytes',
        'header_label_matches', 'receipt_label_matches', 'both_labels_match',
        'legacy_sender_suffix_checks', 'legacy_sender_suffix_matches_both_labels')}
    block_rows, first_mismatch = [], None
    block_hashes, raw_hashes = set(), set()
    for branch in ('left', 'right'):
        for captured in value['branches'][branch]:
            exact(captured, ('schema', 'selection', 'header', 'raw_transactions', 'receipts'))
            need(captured['schema'] == 'caw-block-body-capture/1', 'BODY_SCHEMA')
            selected = captured['selection']
            exact(selected, ('block_number', 'block_hash'))
            need(type(selected['block_number']) is str and QUANTITY.fullmatch(selected['block_number']), 'NUMBER')
            hash_text(selected['block_hash'])
            header, raws, receipts = captured['header'], captured['raw_transactions'], captured['receipts']
            need(type(header) is dict and header.get('number') == selected['block_number']
                 and header.get('hash') == selected['block_hash'], 'HEADER_SELECTION')
            labels = header.get('transactions')
            need(type(raws) is list and type(receipts) is list and type(labels) is list
                 and len(raws) == len(receipts) == len(labels) <= MAX_TRANSACTIONS, 'TRANSACTION_BOUND')
            counts = {name: 0 for name in totals if name != 'captures'}
            sample = None
            for index, (encoded, receipt, header_label) in enumerate(zip(raws, receipts, labels)):
                raw = hex_bytes(encoded, MAX_RAW, minimum=1)
                header_label = hash_text(header_label)
                need(type(receipt) is dict and receipt.get('transactionIndex') == hex(index)
                     and receipt.get('blockHash') == header['hash']
                     and receipt.get('blockNumber') == header['number'], 'RECEIPT_ASSOCIATION')
                receipt_label = hash_text(receipt.get('transactionHash'))
                computed = '0x' + digest(raw).hex()
                header_matches, receipt_matches = computed == header_label, computed == receipt_label
                row = {'transaction_index': hex(index), 'raw_bytes': len(raw), 'raw_keccak256': computed,
                    'header_rpc_transaction_hash': header_label, 'receipt_rpc_transaction_hash': receipt_label,
                    'header_label_matches_raw': header_matches, 'receipt_label_matches_raw': receipt_matches}
                counts['transaction_observations'] += 1
                counts['raw_bytes'] += len(raw)
                counts['header_label_matches'] += int(header_matches)
                counts['receipt_label_matches'] += int(receipt_matches)
                counts['both_labels_match'] += int(header_matches and receipt_matches)
                raw_hashes.add(hashlib.sha256(raw).hexdigest())
                if raw[0] >= 0xc0 and 'from' in receipt:
                    sender = hex_bytes(receipt['from'], 20, exact_size=20)
                    suffixed = '0x' + digest(raw + sender).hex()
                    matched = suffixed == header_label == receipt_label
                    row.update({'legacy_sender_suffix_keccak256': suffixed,
                                'unverified_rpc_from': receipt['from'],
                                'legacy_sender_suffix_matches_both_labels': matched})
                    counts['legacy_sender_suffix_checks'] += 1
                    counts['legacy_sender_suffix_matches_both_labels'] += int(matched)
                if sample is None:
                    sample = row
                if not (header_matches and receipt_matches) and first_mismatch is None:
                    first_mismatch = {'branch': branch, 'block_number': header['number'],
                                      'block_hash': header['hash'], **row}
            totals['captures'] += 1
            for name, count in counts.items():
                totals[name] += count
            block_hashes.add(header['hash'])
            block_rows.append({'branch': branch, 'block_number': header['number'],
                               'block_hash': header['hash'], 'counts': counts, 'sample': sample})
    totals.update({'distinct_block_hashes': len(block_hashes), 'distinct_raw_envelopes': len(raw_hashes),
                   'repeated_block_observations': totals['captures'] - len(block_hashes)})
    checked = totals['legacy_sender_suffix_checks']
    return {'schema': 'caw-local-raw-hash-diagnostic/1',
        'input_sha256': hashlib.sha256(raw_input).hexdigest(), 'input_bytes': len(raw_input),
        'primitive': {'path': 'reference/fixtures/generate-ethereum-proof-fixtures.py',
                      'sha256': PRIMITIVE_SHA256, 'reused_fixture_primitive': True},
        'legacy_diagnostic': {'formula': 'Keccak256(raw_legacy_bytes || unverified_RPC_receipt_from_20_bytes)',
            'source': 'https://github.com/foundry-rs/foundry/blob/v1.8.1/crates/anvil/core/src/eth/transaction/mod.rs',
            'source_blob_sha': '01f155c2dd82aabd15b433a0d7f09ab35efb680a',
            'typed_envelopes_excluded': True, 'rpc_from_is_unverified_metadata': True},
        'counts': totals, 'blocks': block_rows, 'first_mismatch': first_mismatch,
        'flags': {'rawByteHashesComputed': True,
            'rpcLabelsAllMatchRawByteHashes': totals['both_labels_match'] == totals['transaction_observations'],
            'allLegacySenderSuffixChecksMatchLabels': checked > 0 and checked == totals['legacy_sender_suffix_matches_both_labels'],
            'headerHashVerified': False, 'bodyCommitmentsVerified': False, 'signaturesVerified': False,
            'senderVerified': False, 'executionVerified': False, 'endpointAuthenticated': False,
            'consensusVerified': False, 'finalityVerified': False, 'freshnessVerified': False,
            'independentProvidersVerified': False, 'repeatedBlocksTreatedAsIndependentEvidence': False}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    args = parser.parse_args()
    try:
        result = check(args.input)
        output = json.dumps(result, sort_keys=True, separators=(',', ':'), allow_nan=False)
        need(len(output.encode('ascii')) <= MAX_OUTPUT, 'OUTPUT_BOUND')
    except (OSError, KeyError, TypeError, ValueError, RecursionError) as error:
        reason = str(error)
        print(reason if re.fullmatch(r'RAW_HASH_DIAGNOSTIC_[A-Z_]+', reason)
              else 'RAW_HASH_DIAGNOSTIC_REJECTED', file=sys.stderr)
        raise SystemExit(1) from None
    print(output)


if __name__ == '__main__':
    main()
