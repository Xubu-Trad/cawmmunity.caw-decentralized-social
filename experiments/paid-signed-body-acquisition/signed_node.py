"""One-shot signed-envelope submission over the unchanged local body guard.

Only a canonical, bounded legacy envelope for synthetic chain 31337 may reach
the inherited transport. Envelope structure does not prove the sender or the
endpoint; the separate writer checks its fixed public test identities.
"""
import importlib.util
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent


def _source(name, path):
    spec = importlib.util.spec_from_loader(name, loader=None)
    loaded = importlib.util.module_from_spec(spec)
    loaded.__file__ = str(path)
    sys.modules[name] = loaded
    exec(compile(path.read_bytes(), str(path), 'exec'), loaded.__dict__)
    return loaded


module = _source('caw_signed_body_scope', HERE / '../paid-body-acquisition/body_node.py')
codec = _source('caw_signed_envelope_scope', HERE / 'legacy_codec.py')
BASE = module.BASE
WRITE_PHASES = ('prefix', 'write-left', 'write-right')
FORBIDDEN = frozenset((
    'eth_sendTransaction', 'anvil_impersonateAccount',
    'anvil_stopImpersonatingAccount', 'anvil_autoImpersonateAccount',
))


class SignedNode(module.BodyNode):
    def __init__(self, anvil, work):
        super().__init__(anvil, work)
        self.local_signed_raw_attempts = 0
        self._signed_active = False
        self._signed_permission = None

    def _signed_scope(self, generation, phase):
        if (self.phase not in WRITE_PHASES or self.phase != phase
                or self.generation != generation
                or self._lease_active or self._body_active):
            raise RuntimeError('SIGNED_WRITE_SCOPE')

    def submit_signed(self, label, raw):
        if self._signed_active or self._signed_permission is not None:
            raise RuntimeError('SIGNED_NESTED_SUBMISSION')
        generation, phase = self.generation, self.phase
        self._signed_scope(generation, phase)
        # The pinned decoder checks canonical nine-field legacy RLP, chain
        # 31337, gas price 1e11, zero value, gas <= 4M, uint64 nonce, <= 16 KiB
        # raw bytes, <= 8 KiB data, and nonzero in-range r / low-s scalars.
        envelope = codec.inspect_legacy(raw)
        self._signed_scope(generation, phase)
        self._signed_active = True
        self._signed_permission = (envelope['raw'], generation, phase)
        try:
            result = self.rpc(label, 'eth_sendRawTransaction', [envelope['raw']])
            self._signed_scope(generation, phase)
            if self._signed_permission is not None:
                raise RuntimeError('SIGNED_PERMISSION_UNCONSUMED')
            return result
        finally:
            self._signed_permission = None
            self._signed_active = False

    def _params(self, method, params):
        if method in FORBIDDEN:
            raise RuntimeError('SIGNED_METHOD_REFUSED')
        if method == 'eth_sendRawTransaction':
            permission = self._signed_permission
            if not self._signed_active or permission is None:
                raise RuntimeError('SIGNED_RAW_SCOPE')
            raw, generation, phase = permission
            self._signed_scope(generation, phase)
            if type(params) is not list or len(params) != 1 or params[0] != raw:
                raise RuntimeError('SIGNED_RAW_SCOPE')
            # Consume before transport; even a second identical call cannot
            # reuse this permission. The outer finally also clears failures.
            self._signed_permission = None
            if self._request_id >= 1800:
                self._halt('LOCAL_REQUEST_LIMIT')
                raise RuntimeError('LOCAL_REQUEST_LIMIT')
            if self.transaction_count >= 250:
                self._halt('LOCAL_TRANSACTION_LIMIT')
                raise RuntimeError('LOCAL_TRANSACTION_LIMIT')
            # The inherited rpc_raw counts eth_sendTransaction only. Count
            # this new method here, including RPC rejection and timeout.
            self.transaction_count += 1
            self.local_signed_raw_attempts += 1
            return
        return super()._params(method, params)

    def receipt(self):
        result = super().receipt()
        result['local_signed_raw_attempts'] = self.local_signed_raw_attempts
        result['non_impersonated_submission'] = True
        return result
