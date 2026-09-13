"""Deterministic, synthetic London receipt-set fixtures; no network or accounts.

Run with Python 3.11+ from any directory under the repository's resource guard.
Writes only the adjacent block-receipts-v1.json. This generator independently
assembles receipts, log blooms and London execution headers without importing
the JavaScript inspector. It reuses the pinned Python Keccak/RLP/trie oracle;
that reuse is not an additional independent cryptographic implementation.

Only post-Byzantium status receipts of types 0, 1 and 2 are constructed. These
headers prove no execution, consensus or chain identity. The 130/256-receipt
cases are compact synthetic recipes, not abbreviated network captures.

Sources: EIP-658, EIP-2718, EIP-2930, EIP-1559 and Ethereum Yellow Paper
receipt/log-bloom definitions. The trie key is RLP(transaction index), not a
hash of that key; typed receipt prefixes are outside the payload's RLP list.
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
MAX_SOURCE = 1024 * 1024
MAX_OUTPUT = 256 * 1024
ZERO_BLOOM = '0x' + '00' * 256
HEADER_FIELDS = (
    'parentHash', 'sha3Uncles', 'miner', 'stateRoot', 'transactionsRoot',
    'receiptsRoot', 'logsBloom', 'difficulty', 'number', 'gasLimit', 'gasUsed',
    'timestamp', 'extraData', 'mixHash', 'nonce', 'baseFeePerGas',
)
HEADER_QUANTITIES = {
    'difficulty', 'number', 'gasLimit', 'gasUsed', 'timestamp', 'baseFeePerGas',
}


def require(condition, code):
    if not condition:
        raise ValueError('Receipt fixture rejected: ' + code)


def hx(value):
    return '0x' + value.hex()


def raw(value):
    return bytes.fromhex(value[2:])


def log_bloom(logs, primitive):
    """Set Ethereum's three 11-bit positions per address and topic."""
    bits = 0
    for log in logs:
        for value in [log['address'], *log['topics']]:
            hashed = primitive['digest'](raw(value))
            for offset in (0, 2, 4):
                position = int.from_bytes(hashed[offset:offset + 2], 'big') & 2047
                bits |= 1 << position
    return bits.to_bytes(256, 'big')


def encoded_receipt(receipt, primitive):
    receipt_type = int(receipt['type'], 16)
    require(receipt_type in (0, 1, 2), 'receipt-type')
    require(receipt['status'] in ('0x0', '0x1'), 'status')
    require(raw(receipt['logsBloom']) == log_bloom(receipt['logs'], primitive), 'bloom')
    payload = primitive['rlp']([
        primitive['integer'](int(receipt['status'], 16)),
        primitive['integer'](int(receipt['cumulativeGasUsed'], 16)),
        raw(receipt['logsBloom']),
        [[raw(log['address']), [raw(topic) for topic in log['topics']], raw(log['data'])]
         for log in receipt['logs']],
    ])
    return payload if receipt_type == 0 else bytes([receipt_type]) + payload


def synthetic_log(data_length, topics=0, address_value=17):
    require(data_length in (0, 55, 56), 'log-data-length')
    require(0 <= topics <= 4, 'log-topic-count')
    return {
        'address': hx(address_value.to_bytes(20, 'big')),
        'topics': [hx((index + 1).to_bytes(32, 'big')) for index in range(topics)],
        'data': hx(bytes(index % 251 for index in range(data_length))),
    }


def receipt(receipt_type, status, cumulative_gas, logs, primitive):
    return {
        'type': hex(receipt_type), 'status': hex(status),
        'cumulativeGasUsed': hex(cumulative_gas),
        'logsBloom': hx(log_bloom(logs, primitive)), 'logs': logs,
    }


def build_header(root, bloom, gas_used, primitive):
    """Direct London16 field assembly; distinct synthetic non-body roots."""
    header = {
        'parentHash': '0x' + '11' * 32,
        'sha3Uncles': hx(primitive['digest'](primitive['rlp']([]))),
        'miner': '0x' + '33' * 20,
        'stateRoot': '0x' + '44' * 32,
        'transactionsRoot': '0x' + '55' * 32,
        'receiptsRoot': hx(root), 'logsBloom': hx(bloom),
        'difficulty': '0x1', 'number': '0x2a', 'gasLimit': '0x1000000',
        'gasUsed': hex(gas_used), 'timestamp': '0x3e8', 'extraData': '0x',
        'mixHash': '0x' + '88' * 32,
        'nonce': '0x0000000000000000', 'baseFeePerGas': '0x1',
    }
    fields = [primitive['integer'](int(header[name], 16))
              if name in HEADER_QUANTITIES else raw(header[name])
              for name in HEADER_FIELDS]
    encoded = primitive['rlp'](fields)
    require(len(encoded) <= 2048, 'header-encoding-size')
    header['hash'] = hx(primitive['digest'](encoded))
    return header


def case(name, receipts, primitive, recipe=None):
    require(len(receipts) <= 256, 'receipt-count')
    previous = 0
    bloom_value = 0
    encoded = []
    for index, item in enumerate(receipts):
        current = int(item['cumulativeGasUsed'], 16)
        require(current > previous, 'cumulative-gas-order')
        previous = current
        bloom_value |= int.from_bytes(raw(item['logsBloom']), 'big')
        encoded.append(encoded_receipt(item, primitive))
    pairs = [(primitive['rlp'](primitive['integer'](index)), value)
             for index, value in enumerate(encoded)]
    root = primitive['Trie'](pairs).root
    bloom = bloom_value.to_bytes(256, 'big')
    header = build_header(root, bloom, previous, primitive)
    rpc_receipts = [{**item, 'transactionIndex': hex(index),
                     'blockHash': header['hash'], 'blockNumber': header['number']}
                    for index, item in enumerate(receipts)]
    expected = {
        'receipt_count': len(receipts), 'receipts_root': hx(root),
        'logs_bloom': hx(bloom), 'gas_used': hex(previous),
        'header_hash': header['hash'],
        'encoded_receipts_sha256': hashlib.sha256(b''.join(encoded)).hexdigest(),
    }
    result = {
        'name': name, 'header': header,
        'selection': {'schema': 'caw-block-receipts-selection/1',
                      'profile': 'london-16', 'hash': header['hash']},
        'expected': expected,
    }
    if recipe is None:
        result['receipts'] = rpc_receipts
        expected['encoded_receipts'] = [hx(value) for value in encoded]
    else:
        result['receipt_recipe'] = recipe
        indexes = sorted({index for index in (0, 1, 127, 128, len(receipts) - 1)
                          if index < len(receipts)})
        expected['encoded_samples'] = [
            {'transaction_index': hex(index), 'key': hx(pairs[index][0]),
             'encoded': hx(encoded[index]),
             'sha256': hashlib.sha256(encoded[index]).hexdigest()}
            for index in indexes
        ]
    return result


def main():
    with PRIMITIVE.open('rb') as source:
        source_bytes = source.read(MAX_SOURCE + 1)
    require(len(source_bytes) <= MAX_SOURCE, 'source-size')
    require(hashlib.sha256(source_bytes).hexdigest() == PRIMITIVE_SHA256, 'primitive-pin')
    primitive = runpy.run_path(str(PRIMITIVE))
    require(primitive['digest'](b'').hex() ==
            'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
            'empty-keccak-vector')
    require(primitive['digest'](b'abc').hex() ==
            '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
            'abc-keccak-vector')
    require(primitive['Trie']([]).root.hex() ==
            '56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
            'empty-trie-vector')
    cases = [case('empty', [], primitive)]
    cases.append(case('legacy-failed', [receipt(0, 0, 21000, [], primitive)], primitive))
    cases.append(case('legacy-success', [receipt(0, 1, 21000, [], primitive)], primitive))
    cases.append(case('type-1', [receipt(1, 1, 22000, [synthetic_log(0, 1)], primitive)], primitive))
    cases.append(case('type-2', [receipt(2, 1, 23000, [synthetic_log(55, 4)], primitive)], primitive))
    cases.append(case('mixed-log-boundaries', [
        receipt(0, 1, 24000, [synthetic_log(0), synthetic_log(55, 4, 18)], primitive),
        receipt(1, 1, 49000, [synthetic_log(56, 4, 19)], primitive),
        receipt(2, 1, 75000, [synthetic_log(55, 1, 20), synthetic_log(56, 2, 21)], primitive),
        receipt(0, 0, 96000, [], primitive),
    ], primitive))
    for count in (130, 256):
        gas_step = 21000
        recipe = {
            'schema': 'caw-synthetic-empty-log-receipts/1', 'count': count,
            'gas_step': hex(gas_step),
            'template': {'type': '0x2', 'status': '0x1', 'logsBloom': ZERO_BLOOM, 'logs': []},
        }
        receipts = [receipt(2, 1, (index + 1) * gas_step, [], primitive)
                    for index in range(count)]
        cases.append(case('typed-index-boundaries-' + str(count), receipts, primitive, recipe))
    # Positive resource boundaries use the same explicit expansion with a
    # non-empty template. The template is repeated unchanged in each receipt;
    # only the index, cumulative gas and block attachment fields are supplied
    # by the recipe rule. The 64 addresses are small synthetic integers.
    limit_logs = [synthetic_log(0, 0, 17 + index) for index in range(64)]
    data_limit_log = {
        'address': hx((17).to_bytes(20, 'big')), 'topics': [],
        'data': hx(bytes(index % 251 for index in range(8192))),
    }
    for name, count, logs in (
        ('receipt-log-limit-64', 1, limit_logs),
        ('block-log-limit-512', 8, limit_logs),
        ('log-data-limit-8192', 1, [data_limit_log]),
    ):
        gas_step = 100000
        template = {'type': '0x2', 'status': '0x1',
                    'logsBloom': hx(log_bloom(logs, primitive)), 'logs': logs}
        recipe = {
            'schema': 'caw-synthetic-repeated-receipts/1', 'count': count,
            'gas_step': hex(gas_step), 'template': template,
        }
        receipts = [{**template, 'cumulativeGasUsed': hex((index + 1) * gas_step)}
                    for index in range(count)]
        cases.append(case(name, receipts, primitive, recipe))
    result = {
        'format': 'caw-block-receipts-fixtures-v1', 'synthetic': True,
        'notice': 'Synthetic receipt sets and headers; no account data, live chain, transaction body, execution or consensus claim.',
        'oracle': 'Receipt encoding, log bloom and London16 header assembly are independent of JavaScript; Keccak, RLP and trie construction reuse the pinned Python oracle and are not additional independent cryptographic implementations.',
        'primitive': {'path': 'reference/fixtures/generate-ethereum-proof-fixtures.py',
                      'sha256': PRIMITIVE_SHA256},
        'recipe_expansion': 'For each i from 0 through count-1, clone template and add transactionIndex=hex(i), cumulativeGasUsed=hex((i+1)*int(gas_step,16)), blockHash=header.hash and blockNumber=header.number. Quantities use minimal lowercase hexadecimal. No network receipts are omitted; these cases are fully synthetic recipes.',
        'encoding_digest': 'encoded_receipts_sha256 is SHA-256 over the concatenation of complete encoded receipt byte strings in transaction-index order, without separators or extra framing. It is an auxiliary fixture digest, not the Ethereum trie root.',
        'cases': cases,
    }
    output = (json.dumps(result, indent=2) + '\n').encode('utf-8')
    require(len(output) <= MAX_OUTPUT, 'output-size')
    target = HERE / 'block-receipts-v1.json'
    target.write_bytes(output)
    print(json.dumps({'cases': len(cases), 'receipt_counts': [item['expected']['receipt_count'] for item in cases],
                      'fixture_bytes': len(output), 'fixture_sha256': hashlib.sha256(output).hexdigest()}))


if __name__ == '__main__':
    main()
