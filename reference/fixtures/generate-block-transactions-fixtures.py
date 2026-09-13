"""Deterministic synthetic London transaction-body and receipt-association fixtures.

Run with Python 3.11+ under the repository resource guard. Writes only the
adjacent block-transactions-v1.json; imports no JavaScript and uses no network.
The pinned Python Keccak/RLP/Trie oracle supplies cryptographic primitives.
The pinned receipt generator supplies receipt encoding, blooms, and the base
London16 header; this reuse is not another independent cryptographic oracle.

Legacy, EIP-2930 and EIP-1559 envelopes are constructed directly from fields.
Synthetic r/s values are formatting data, not valid signatures or evidence of
sender recovery, transaction execution, consensus, or any live-chain history.
RLP(index) is the trie key; typed prefixes are outside the payload's RLP list.
Large cases preserve every raw transaction and use explicit receipt recipes.
The readable JSON output is bounded to 384 KiB, including malformed-limit vectors.
"""
from pathlib import Path
import hashlib
import json
import runpy
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
PRIMITIVE = HERE / 'generate-ethereum-proof-fixtures.py'
PRIMITIVE_SHA256 = '5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa'
RECEIPT_ORACLE = HERE / 'generate-block-receipts-fixtures.py'
RECEIPT_ORACLE_SHA256 = 'bade4d20fa0fd49d0990745b0dd4c0a4163cc7634d537358225e7c49dedaca77'
MAX_SOURCE = 1024 * 1024
MAX_OUTPUT = 384 * 1024
ZERO_BLOOM = '0x' + '00' * 256
ADDRESS = '0x' + '11' * 20
LEGACY = ('nonce', 'gasPrice', 'gasLimit', 'to', 'value', 'data', 'v', 'r', 's')
TYPE1 = ('chainId', 'nonce', 'gasPrice', 'gasLimit', 'to', 'value', 'data',
         'accessList', 'yParity', 'r', 's')
TYPE2 = ('chainId', 'nonce', 'maxPriorityFeePerGas', 'maxFeePerGas', 'gasLimit',
         'to', 'value', 'data', 'accessList', 'yParity', 'r', 's')


def require(condition, code):
    if not condition:
        raise ValueError('Transaction fixture rejected: ' + code)


def hx(value):
    return '0x' + value.hex()


def raw(value):
    return bytes.fromhex(value[2:])


def pinned(path, expected_hash):
    with path.open('rb') as source:
        contents = source.read(MAX_SOURCE + 1)
    require(len(contents) <= MAX_SOURCE, 'source-size')
    require(hashlib.sha256(contents).hexdigest() == expected_hash, 'source-pin:' + path.name)
    return runpy.run_path(str(path))


def transaction(tx_type=0, **updates):
    common = {'type': hex(tx_type), 'nonce': '0x0', 'gasLimit': '0x100000',
              'to': ADDRESS, 'value': '0x0', 'data': '0x', 'r': '0x1', 's': '0x2'}
    if tx_type == 0:
        common.update(gasPrice='0x3', v='0x1b')
    else:
        common.update(chainId='0x1', accessList=[], yParity='0x1')
        if tx_type == 1:
            common.update(gasPrice='0x3')
        else:
            common.update(maxPriorityFeePerGas='0x2', maxFeePerGas='0x3')
    common.update(updates)
    return common


def fields(item, primitive):
    names = (LEGACY, TYPE1, TYPE2)[int(item['type'], 16)]
    values = []
    for name in names:
        value = item[name]
        if name == 'accessList':
            values.append([[raw(entry['address']), [raw(key) for key in entry['storageKeys']]]
                           for entry in value])
        elif name in ('to', 'data'):
            values.append(raw(value))
        else:
            values.append(primitive['integer'](int(value, 16)))
    return values


def encode(item, primitive):
    tx_type = int(item['type'], 16)
    payload = primitive['rlp'](fields(item, primitive))
    return payload if tx_type == 0 else bytes([tx_type]) + payload


def access_entry(address, keys):
    return {'address': hx(address.to_bytes(20, 'big')),
            'storageKeys': [hx(key.to_bytes(32, 'big')) for key in keys]}


def body_header(encoded, receipts, primitive, receipt_oracle):
    tx_pairs = [(primitive['rlp'](primitive['integer'](index)), value)
                for index, value in enumerate(encoded)]
    tx_root = primitive['Trie'](tx_pairs).root
    receipt_encoded = [receipt_oracle['encoded_receipt'](item, primitive) for item in receipts]
    receipt_root = primitive['Trie']([
        (primitive['rlp'](primitive['integer'](index)), value)
        for index, value in enumerate(receipt_encoded)
    ]).root
    bloom = 0
    for item in receipts:
        bloom |= int(item['logsBloom'], 16)
    gas_used = int(receipts[-1]['cumulativeGasUsed'], 16) if receipts else 0
    header = receipt_oracle['build_header'](receipt_root, bloom.to_bytes(256, 'big'), gas_used, primitive)
    header['transactionsRoot'] = hx(tx_root)
    header_fields = [primitive['integer'](int(header[name], 16))
                     if name in receipt_oracle['HEADER_QUANTITIES'] else raw(header[name])
                     for name in receipt_oracle['HEADER_FIELDS']]
    header['hash'] = hx(primitive['digest'](primitive['rlp'](header_fields)))
    return header, tx_pairs, receipt_encoded


def associated_receipts(types, primitive, receipt_oracle, gas_step=21000):
    return [receipt_oracle['receipt'](tx_type, 1, (index + 1) * gas_step, [], primitive)
            for index, tx_type in enumerate(types)]


def case(name, transactions, primitive, receipt_oracle, compact=False,
         receipt_types=None, decoded=True):
    require(len(transactions) <= 256, 'transaction-count')
    encoded = [encode(item, primitive) for item in transactions]
    require(all(len(item) <= 16384 for item in encoded), 'raw-size')
    require(sum(map(len, encoded)) <= 1048576, 'aggregate-size')
    tx_types = [int(item['type'], 16) for item in transactions]
    receipt_types = tx_types if receipt_types is None else receipt_types
    receipts = associated_receipts(receipt_types, primitive, receipt_oracle)
    header, pairs, encoded_receipts = body_header(encoded, receipts, primitive, receipt_oracle)
    hashes = [hx(primitive['digest'](item)) for item in encoded]
    expected = {
        'transaction_count': len(transactions), 'receipt_count': len(receipts),
        'transactions_root': header['transactionsRoot'], 'receipts_root': header['receiptsRoot'],
        'header_hash': header['hash'], 'transaction_hashes': hashes,
        'transaction_types': [hex(item) for item in tx_types],
        'raw_transaction_bytes': [len(item) for item in encoded],
        'total_raw_transaction_bytes': sum(map(len, encoded)),
        'encoded_transactions_sha256': hashlib.sha256(b''.join(encoded)).hexdigest(),
        'encoded_receipts_sha256': hashlib.sha256(b''.join(encoded_receipts)).hexdigest(),
    }
    if decoded:
        expected['decoded_transactions'] = [
            {'index': index, **item, 'hash': hashes[index]}
            for index, item in enumerate(transactions)
        ]
    sample_indexes = sorted({index for index in (0, 1, 127, 128, 129, 255, len(transactions) - 1)
                             if 0 <= index < len(transactions)})
    expected['index_samples'] = [{'index': hex(index), 'key': hx(pairs[index][0]),
                                  'hash': hashes[index]} for index in sample_indexes]
    output = {
        'name': name, 'header': header,
        'selection': {'schema': 'caw-block-transactions-selection/1',
                      'profile': 'london-16', 'hash': header['hash']},
        'raw_transactions': [hx(item) for item in encoded], 'expected': expected,
    }
    if compact:
        require(receipt_types == tx_types, 'recipe-type-association')
        output['receipt_recipe'] = {
            'schema': 'caw-synthetic-associated-receipts/1', 'count': len(receipts),
            'gas_step': '0x5208', 'types': 'transaction-types',
            'template': {'status': '0x1', 'logsBloom': ZERO_BLOOM, 'logs': []},
        }
    else:
        output['receipts'] = [
            {**item, 'transactionIndex': hex(index), 'blockHash': header['hash'],
             'blockNumber': header['number'],
             **({'transactionHash': hashes[index]} if index < len(hashes) else {})}
            for index, item in enumerate(receipts)
        ]
        expected['encoded_receipts'] = [hx(item) for item in encoded_receipts]
    return output


def invalid_envelopes(primitive, receipt_oracle):
    rlp = primitive['rlp']
    legacy_fields = fields(transaction(), primitive)
    typed1_fields = fields(transaction(1), primitive)
    typed2_fields = fields(transaction(2), primitive)
    vectors = []

    def add(name, encoded, reason):
        vectors.append((name, encoded, reason))

    def altered(name, tx_type, position, value, reason):
        original = (legacy_fields, typed1_fields, typed2_fields)[tx_type]
        changed = [*original]
        changed[position] = value
        prefix = b'' if tx_type == 0 else bytes([tx_type])
        add(name, prefix + rlp(changed), reason)

    canonical = encode(transaction(), primitive)
    payload = b''.join(rlp(value) for value in legacy_fields)
    add('empty-envelope', b'', 'empty envelope')
    add('scalar-envelope', b'\x80', 'top-level transaction must be a list')
    add('empty-legacy-list', b'\xc0', 'legacy field count')
    add('unsupported-type-zero', b'\x00' + canonical, 'unsupported typed prefix')
    add('unsupported-type-three', b'\x03' + rlp(typed2_fields), 'unsupported typed prefix')
    add('type-one-empty-payload', b'\x01', 'missing typed payload')
    add('type-two-empty-list', b'\x02\xc0', 'type two field count')
    add('type-two-string-payload', b'\x02' + rlp(b'\xc0'), 'typed payload must be a list')
    add('trailing-byte', canonical + b'\x80', 'trailing RLP item')
    add('truncated-envelope', canonical[:-1], 'truncated RLP item')
    add('long-list-below-56', b'\xf8' + bytes([len(payload)]) + payload, 'nonminimal list length')
    add('leading-zero-list-length', b'\xf9\x00' + bytes([len(payload)]) + payload,
        'nonminimal length of length')
    for name, nonce in [('nonminimal-single-byte', b'\x81\x01'),
                        ('long-string-below-56', b'\xb8\x01\x01')]:
        altered_payload = nonce + b''.join(rlp(value) for value in legacy_fields[1:])
        add(name, bytes([192 + len(altered_payload)]) + altered_payload, 'nonminimal scalar RLP')
    for tx_type, position in ((0, 0), (1, 1), (2, 1)):
        altered('leading-zero-nonce-type-' + str(tx_type), tx_type, position, b'\x00',
                'integer leading zero')
        altered('nonce-over-256-bits-type-' + str(tx_type), tx_type, position,
                primitive['integer'](1 << 256), 'integer exceeds 32 bytes')
    altered('legacy-list-nonce', 0, 0, [], 'integer must be scalar')
    for size in (19, 21):
        altered('legacy-recipient-' + str(size), 0, 3, b'\x11' * size, 'recipient width')
    for value in (0, 1, 29, 34):
        altered('legacy-v-' + str(value), 0, 6, primitive['integer'](value), 'legacy v domain')
    altered('type-one-parity-two', 1, 8, b'\x02', 'typed parity domain')
    altered('type-two-parity-list', 2, 9, [], 'typed parity must be scalar')
    altered('leading-zero-signature-r', 0, 7, b'\x00', 'integer leading zero')
    altered('signature-s-over-256-bits', 2, 11, b'\x01' * 33, 'integer exceeds 32 bytes')
    altered('access-list-is-scalar', 1, 7, b'', 'access list must be a list')
    altered('access-tuple-one-field', 1, 7, [[b'\x11' * 20]], 'access tuple field count')
    altered('access-tuple-three-fields', 2, 8, [[b'\x11' * 20, [], b'']], 'access tuple field count')
    altered('access-address-19', 2, 8, [[b'\x11' * 19, []]], 'access address width')
    altered('access-storage-is-scalar', 2, 8, [[b'\x11' * 20, b'']], 'storage keys must be a list')
    for size in (31, 33):
        altered('access-storage-key-' + str(size), 2, 8,
                [[b'\x11' * 20, [b'\x00' * size]]], 'storage key width')
    altered('calldata-over-8192', 2, 7, b'\xab' * 8193, 'calldata byte limit')
    altered('access-tuples-over-64', 1, 7,
            [[address.to_bytes(20, 'big'), []] for address in range(65)], 'access tuple limit')
    altered('access-storage-keys-over-256-across-tuples', 2, 8,
            [[address.to_bytes(20, 'big'), [key.to_bytes(32, 'big') for key in range(count)]]
             for address, count in ((17, 128), (18, 129))], 'aggregate storage key limit')
    nested = b''
    for _ in range(10):
        nested = [nested]
    altered('nested-rlp-over-depth', 0, 0, nested, 'RLP nesting limit')
    altered('rlp-over-node-count', 0, 0, [b''] * 2049, 'RLP node limit')
    add('parent-child-escape', b'\xc1\x82\x00\x01', 'child exceeds parent RLP boundary')
    for tx_type, original in enumerate((legacy_fields, typed1_fields, typed2_fields)):
        prefix = b'' if tx_type == 0 else bytes([tx_type])
        add('missing-field-type-' + str(tx_type), prefix + rlp(original[:-1]),
            'transaction field count')
        add('extra-field-type-' + str(tx_type), prefix + rlp(original + [b'']),
            'transaction field count')
    receipts = associated_receipts([0], primitive, receipt_oracle)
    template = body_header([canonical], receipts, primitive, receipt_oracle)[0]
    results = []
    for name, encoded, reason in vectors:
        header = body_header([encoded], receipts, primitive, receipt_oracle)[0]
        results.append({'name': name, 'raw_transaction': hx(encoded), 'expected_reason': reason,
                        'header_patch': {'transactionsRoot': header['transactionsRoot'],
                                         'hash': header['hash']}})
    return template, results


def main():
    primitive = pinned(PRIMITIVE, PRIMITIVE_SHA256)
    receipt_oracle = pinned(RECEIPT_ORACLE, RECEIPT_ORACLE_SHA256)
    require(primitive['digest'](b'').hex() ==
            'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470', 'keccak-empty')
    require(primitive['digest'](b'abc').hex() ==
            '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45', 'keccak-abc')
    require(primitive['Trie']([]).root.hex() ==
            '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421', 'empty-trie')
    cases = [case('empty', [], primitive, receipt_oracle)]
    tiny = transaction(gasPrice='0x0', gasLimit='0x0', to='0x')
    for name, transactions in (
        ('tiny-legacy-short-root', [tiny]),
        ('tiny-legacy-inline-children', [tiny, {**tiny, 'nonce': '0x1'}]),
    ):
        value = case(name, transactions, primitive, receipt_oracle)
        tree = primitive['Trie']([
            (primitive['rlp'](primitive['integer'](index)), encode(item, primitive))
            for index, item in enumerate(transactions)
        ])
        value['expected']['trie_shape'] = {
            'root_rlp_bytes': len(primitive['rlp'](tree.root_node)),
            'inline_root_children': sum(isinstance(item, list) for item in tree.root_node),
        }
        cases.append(value)
    cases.append(case('legacy-nonce-zero', [transaction()], primitive, receipt_oracle))
    large = hex((1 << 256) - 1)
    cases.append(case('legacy-large-integers', [transaction(nonce=large, gasPrice=large,
                     value=large, v='0x25', r=large, s=large)], primitive, receipt_oracle))
    cases.append(case('zero-signature-scalars-formatting-only', [
        transaction(r='0x0', s='0x0', v='0x1c'),
        transaction(1, r='0x0', s='0x0', yParity='0x0'),
        transaction(2, r='0x0', s='0x0', yParity='0x0'),
    ], primitive, receipt_oracle))
    duplicate_access = [access_entry(17, [0, 1, 1]), access_entry(17, [0])]
    mixed = [
        transaction(to='0x', data=hx(b'\xab' * 55), v='0x23'),
        transaction(1, nonce='0x80', data=hx(b'\xcd' * 56), accessList=duplicate_access),
        transaction(2, nonce=large, to='0x', accessList=[access_entry(18, [2])], yParity='0x0'),
    ]
    cases.append(case('mixed-types-contract-creation-and-data-boundaries', mixed, primitive, receipt_oracle))
    for count in (130, 256):
        transactions = [transaction(2, nonce=hex(index)) for index in range(count)]
        cases.append(case('typed-index-boundaries-' + str(count), transactions,
                          primitive, receipt_oracle, compact=True, decoded=False))
    bounded = [
        ('calldata-limit-8192', transaction(2, data=hx(bytes(index % 251 for index in range(8192))))),
        ('access-address-limit-64', transaction(1, accessList=[access_entry(17 + i, []) for i in range(64)])),
        ('access-slot-limit-256', transaction(2, accessList=[access_entry(17, range(256))])),
    ]
    # Fit one exact raw-byte bound while staying below the independent calldata,
    # tuple and storage-key limits. Varying only data length keeps this bounded.
    raw_limit = transaction(2, accessList=[access_entry(17 + i, range(4)) for i in range(64)])
    data_length = 16384 - len(encode(raw_limit, primitive)) - 2
    require(0 <= data_length <= 8192, 'raw-limit-fitting-range')
    raw_limit['data'] = hx(b'\xee' * data_length)
    require(len(encode(raw_limit, primitive)) == 16384, 'exact-raw-limit')
    bounded.append(('raw-transaction-limit-16384', raw_limit))
    for name, item in bounded:
        cases.append(case(name, [item], primitive, receipt_oracle, compact=True, decoded=False))
    association_mismatches = [
        case('separate-roots-valid-receipt-type-mismatch', [transaction(2)],
             primitive, receipt_oracle, receipt_types=[0]),
        case('separate-roots-valid-receipt-count-mismatch', mixed,
             primitive, receipt_oracle, receipt_types=[0, 1]),
    ]
    invalid_header, invalid = invalid_envelopes(primitive, receipt_oracle)
    result = {
        'format': 'caw-block-transactions-fixtures-v1', 'synthetic': True,
        'notice': 'Synthetic signed-shaped transaction bytes and receipts. r/s are formatting data; no signature validity, sender recovery, execution, consensus, live chain, or alpha.28 historical-body claim.',
        'oracle': 'Envelope fields, transaction trie roots, transaction hashes and final London16 header hashes are assembled in Python, independently of JavaScript. Keccak/RLP/Trie reuse the pinned primitive; receipt encoding, blooms and base header assembly reuse the pinned receipt oracle. These are not additional independent cryptographic implementations.',
        'primitive': {'path': 'reference/fixtures/' + PRIMITIVE.name, 'sha256': PRIMITIVE_SHA256},
        'receipt_oracle': {'path': 'reference/fixtures/' + RECEIPT_ORACLE.name, 'sha256': RECEIPT_ORACLE_SHA256},
        'receipt_recipe_expansion': 'For i=0..count-1, clone template; add type=expected.transaction_types[i], cumulativeGasUsed=hex((i+1)*int(gas_step,16)), transactionIndex=hex(i), blockHash=header.hash, blockNumber=header.number and transactionHash=expected.transaction_hashes[i]. Quantities are minimal lowercase hex. Every raw transaction is present in raw_transactions; recipes abbreviate only fully synthetic receipts.',
        'invalid_expansion': 'For each invalid_envelopes entry, clone invalid_header_template and apply header_patch; select that resulting header.hash using caw-block-transactions-selection/1 and profile london-16; rawTransactions=[raw_transaction]. The Python-generated header genuinely commits to those malformed raw bytes, so the vector tests canonical envelope parsing with a matching body root.',
        'association_mismatch_semantics': 'Each association_mismatches header independently commits to its supplied transactions and supplied receipts. Both separate root checks pass; the joint type or count association must fail.',
        'encoding_digest': 'SHA-256 over complete raw transaction byte strings concatenated in index order, without separators or extra framing, is auxiliary fixture evidence and is not the Ethereum trie root. The receipt digest follows the same concatenation rule.',
        'bounds': {'transaction_count': 256, 'raw_transaction_bytes': 16384,
                   'total_raw_transaction_bytes': 1048576, 'calldata_bytes': 8192,
                   'access_addresses': 64, 'access_storage_keys': 256},
        'cases': cases, 'association_mismatches': association_mismatches,
        'invalid_header_template': invalid_header, 'invalid_envelopes': invalid,
    }
    output = (json.dumps(result, indent=2) + '\n').encode('utf-8')
    require(len(output) <= MAX_OUTPUT, 'output-size:' + str(len(output)))
    target = HERE / 'block-transactions-v1.json'
    target.write_bytes(output)
    print(json.dumps({'cases': len(cases), 'invalid_envelopes': len(invalid),
                      'association_mismatches': len(association_mismatches),
                      'transaction_counts': [item['expected']['transaction_count'] for item in cases],
                      'fixture_bytes': len(output), 'fixture_sha256': hashlib.sha256(output).hexdigest()}))


if __name__ == '__main__':
    main()
