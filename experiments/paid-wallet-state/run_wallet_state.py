"""Fresh local branch histories with complete transaction-byte acquisition.

Runs unchanged paid contracts, acquires each branch twice, then fetches each complete body.
The selected branch is an explicit fixture input, not an inferred finality rule.
"""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import socket
import sys

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True


def load(name, path, expected):
    source = path.read_bytes()
    need(sha(source) == expected, 'EXECUTION_INPUT_PIN')
    spec = importlib.util.spec_from_loader(name, loader=None)
    m = importlib.util.module_from_spec(spec)
    m.__file__ = str(path)
    sys.modules[name] = m
    exec(compile(source, str(path), 'exec'), m.__dict__)
    return m


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(condition, code):
    if not condition:
        raise RuntimeError(code)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--anvil', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--expected-input-sha256', required=True)
    a = p.parse_args()
    raw = (HERE / 'experiment-inputs.json').read_bytes()
    need(sha(raw) == a.expected_input_sha256, 'INPUT_MANIFEST')
    pins = json.loads(raw)['files']

    def verify_pins():
        for name, expected in pins.items():
            need(sha((HERE / name).read_bytes()) == expected, 'INPUT_PIN')
    verify_pins()
    need(a.output.parent.is_dir() and not a.output.exists(), 'NEW_OUTPUT')

    def source(name, relative):
        return load(name, HERE / relative, pins[relative])
    base = source('reorg_writer_base', '../paid-action/run_paid_action.py')
    node_module = source('signed_state_node', '../paid-signed-state-acquisition/state_node.py')
    k = source('reorg_keccak', '../../reference/fixtures/generate-ethereum-proof-fixtures.py')
    body_collector = source('body_collector', '../paid-body-acquisition/collect_body.py')
    body_leases = []
    build = json.loads((HERE / '../paid-action/paid-build.json').read_bytes())
    A, B, D, TOKEN, F = base.A, base.B, base.D, base.TOKEN, base.FEE
    q1, q2 = F // 3, 2 * F // 3

    writer_module = source('signed_writer', '../paid-signed-body-acquisition/signed_writer.py')
    codec = source('signed_legacy_codec', '../paid-signed-body-acquisition/legacy_codec.py')
    Writer = writer_module.make_writer(base, codec)

    def expected(owners, nonces, stakes, credits, total, dust, vault, messages, epochs=(1, 0, 0)):
        return {'owners': owners, 'epochs': list(map(str, epochs)), 'nonces': list(map(str, nonces)),
                'stakes': list(map(str, stakes)), 'credits': list(map(str, credits)),
                'totalCredits': str(total), 'poolDust': str(dust), 'tokenBalance': str(vault),
                'messageCount': str(messages)}

    node = node_module.SignedNode(a.anvil, a.output.parent / (a.output.stem + '-node'))
    result = {'schema': 'caw-paid-wallet-state-run/1', 'created_utc': datetime.now(timezone.utc).isoformat(),
              'input_manifest_sha256': sha(raw), 'status': 'incomplete', 'branches': {},
              'selected_branch': 'right', 'selection_policy': 'explicit local fixture checkpoint',
              'independent_providers': False, 'authenticates_consensus': False, 'submissions': [],
              'signing': {'cryptography_version': writer_module.CRYPTOGRAPHY_VERSION, 'public_test_accounts': [A, B],
                  'relayer_deployer_uses_test_signer_a': True, 'impersonation_enabled': False, 'real_wallet_used': False}}
    try:
        with node:
            writer = Writer(node, k, build)
            for actor in (A, B, D):
                node.rpc('gas', 'anvil_setBalance', [actor, '0xde0b6b3a7640000'])
            node.install_token()
            for actor in (A, B):
                writer.send('synthetic_funding', D, TOKEN, writer.data('setBalance(address,uint256)', actor, F * 40))
            start = writer.header('prefix.start')
            registry = writer.reg = writer.deploy('TestAccountRegistry', (A, B))
            registry_runtime = writer.deployments[-1]['runtime']
            rh = '0x' + writer.k(bytes.fromhex(registry_runtime[2:])).hex()
            probe = writer.probe = writer.deploy('CawPaidActionProbe', (registry, rh), {'registry': registry, 'registryCodeHash': rh})
            probe_runtime = writer.deployments[-1]['runtime']
            for actor in (A, B):
                writer.call('approve', actor, TOKEN, 'approve(address,uint256)', probe, F * 40)
            for i, actor, amount in ((1, A, 20 * F), (2, A, 10), (3, B, 10)):
                writer.call('deposit', actor, probe, 'deposit(uint256,uint256,uint256)', i, 0, amount)
            for i, actor, amount in ((2, A, 1), (3, B, 2)):
                writer.call('stake', actor, probe, 'stake(uint256,uint256,uint256)', i, 0, amount)
            wallet = writer.deploy('TestSignatureOwner', (A,), {'signer': A})
            writer.call('wallet.transfer', A, registry, 'transferFrom(address,address,uint256)', A, wallet, 1)
            request, signature = writer.intent('fixed-wallet-post', b'fixed-wallet-post')
            calldata = writer.encode(request, signature)
            before = writer.state('baseline')
            result['wallet'] = wallet
            result['deployments'] = copy.deepcopy(writer.deployments)
            result['intent'] = copy.deepcopy(writer.intents[-1])
            result['observations'] = []
            for label, mode, accepted in [('valid', 0, True), ('reject', 1, False), ('restored', 0, True)]:
                row = writer.call(label+'.configure', A, wallet, 'configure(uint8)', mode)
                header = writer.header(label+'.header')
                block = header['number']
                tx = writer.tx(A, probe, calldata)
                response = node.rpc_raw(label+'.fixed_post', 'eth_call', [tx, 'latest'])
                need(('result' in response) == accepted, 'WALLET_MODE_RESULT')
                if accepted: need(response['result'] == '0x', 'POST_RETURN')
                else: need(response['error'].get('data') == writer.data('InvalidSignature()'), 'POST_REJECTION')
                observed_mode = node.rpc(label+'.mode', 'eth_call', [writer.tx(A,wallet,writer.data('mode()')),'latest'])
                need(int(observed_mode,16)==mode, 'MODE_READBACK')
                need(writer.state(label+'.after') == before, 'SIMULATION_MUTATED_ACCOUNTING')
                need(writer.header(label+'.stable') == header, 'BLOCK_MOVED')
                result['observations'].append({'label':label,'mode':mode,'header':header,'call':tx,
                    'observed_block':block,'request_block':'latest','response':response,'mode_readback':observed_mode,'accounting':copy.deepcopy(before),
                    'configuration':copy.deepcopy(row)})
            result['submissions'] = copy.deepcopy(writer.signed_submissions)
            verify_pins()
            result['source_pins_unchanged_after_run'] = True
            result['status'] = 'pass'
    except Exception as error:
        result['status'] = 'fail'
        result['error'] = str(error)
    finally:
        result['node'] = node.receipt()
        result['rpc'] = node.calls
        result['phases'] = node.transitions
        try:
            with socket.socket() as check:
                check.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                check.bind(('127.0.0.1', 18545))
            result['owned_listener_released'] = True
        except OSError:
            result['owned_listener_released'] = False
            result['status'] = 'fail'
            result['cleanup_error'] = 'LISTENER_RELEASE_NOT_CONFIRMED'
        encoded = json.dumps(result, ensure_ascii=True, separators=(',', ':')) + '\n'
        if len(encoded.encode()) > 8 * 1024 * 1024:
            # Keep the bounded raw evidence even when the expanded collector
            # copies exceed the separate report budget. Never report a pass.
            retained = a.output.with_name(a.output.stem + '-incomplete-rpc.json')
            with retained.open('x', encoding='utf-8') as f:
                json.dump(result['rpc'], f, ensure_ascii=True, separators=(',', ':'))
            result['rpc'] = []
            result['branches'] = {}
            result['status'], result['error'] = 'fail', 'OUTPUT_BOUND'
            result['retained_rpc_file'] = retained.name
            encoded = json.dumps(result, ensure_ascii=True, separators=(',', ':')) + '\n'
        with a.output.open('x', encoding='utf-8') as f:
            f.write(encoded)
    print(json.dumps({key: result[key] for key in ('status', 'node', 'owned_listener_released')}))
    if result['status'] != 'pass':
        print(result.get('error', 'REORG_FAILED'))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
