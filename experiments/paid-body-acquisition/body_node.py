"""One bounded raw-body read scope over the unchanged synthetic reorg guard.

Raw transaction hashes must first appear in headers read during this body
lease. That scope is a transport restriction, not header authentication. The
inherited node still owns every RPC, response capture and resource limit.
"""
import importlib.util
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent
path = HERE / '../paid-reorg/reorg_node.py'
spec = importlib.util.spec_from_loader('caw_body_reorg_scope', loader=None)
module = importlib.util.module_from_spec(spec)
module.__file__ = str(path)
sys.modules[spec.name] = module
exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
BASE = module.module.BASE


class BodyNode(module.ReorgNode):
    def __init__(self, anvil, work):
        super().__init__(anvil, work)
        self._body_active = False
        self._body_serial = 0
        self._body_generation = None
        self._body_phase = None
        self._body_hashes = set()

    def body_read_lease(self):
        if self.phase not in ('read-left', 'read-right'):
            raise RuntimeError('BODY_READ_PHASE')
        if self._lease_active or self._body_active:
            raise RuntimeError('REORG_NESTED_LEASE')
        self._body_serial += 1
        serial, generation, phase = self._body_serial, self.generation, self.phase
        self._body_generation, self._body_phase = generation, phase
        self._body_hashes = set()
        first = len(self.calls)

        def read(method, params):
            if (self.generation != generation or self.phase != phase
                    or self._body_serial != serial):
                raise RuntimeError('REORG_RETIRED_LEASE')
            if self._lease_active or self._body_active:
                raise RuntimeError('REORG_NESTED_LEASE')
            self._lease_active = self._body_active = True
            try:
                return self.rpc('collector.' + phase[5:] + '.body.'
                                + str(len(self.calls) - first), method, params)
            finally:
                self._body_active = self._lease_active = False
        return read

    def _params(self, method, params):
        if method == 'eth_getRawTransactionByHash':
            if (not self._body_active or not self._lease_active
                    or self.phase not in ('read-left', 'read-right')
                    or self.generation != self._body_generation
                    or self.phase != self._body_phase
                    or not isinstance(params, list) or len(params) != 1
                    or not BASE._hash(params[0])
                    or params[0] not in self._body_hashes):
                raise RuntimeError('BODY_RAW_SCOPE')
            return
        return super()._params(method, params)

    def rpc(self, label, method, params):
        result = super().rpc(label, method, params)
        if (self._body_active and method in
                ('eth_getBlockByNumber', 'eth_getBlockByHash')):
            if (not self._lease_active or self.generation != self._body_generation
                    or self.phase != self._body_phase
                    or self.phase not in ('read-left', 'read-right')):
                raise RuntimeError('REORG_RETIRED_LEASE')
            config = self._scope.read_config
            if (not isinstance(result, dict)
                    or not BASE._quantity(result.get('number'))
                    or not config['start_block_number'] <= int(result['number'], 16)
                    <= config['end_block_number']
                    or not BASE._hash(result.get('hash'))
                    or not isinstance(result.get('transactions'), list)
                    or len(result['transactions']) > 256
                    or not all(BASE._hash(value) for value in result['transactions'])):
                raise RuntimeError('BODY_HEADER_SCOPE')
            observed_hashes = self._body_hashes | set(result['transactions'])
            if len(observed_hashes) > 256:
                raise RuntimeError('BODY_TRANSACTION_LIMIT')
            self._body_hashes = observed_hashes
        return result
