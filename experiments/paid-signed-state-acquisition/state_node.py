"""Bounded endpoint proof read over the unchanged signed local submission guard."""
import hashlib,importlib.util,sys
from pathlib import Path
path=Path(__file__).resolve().parent/'../paid-signed-body-acquisition/signed_node.py'
raw=path.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='91ac92f88edc6557eb8be838267c9bd009716baee7dc876e32ea20d566bc3d22'
spec=importlib.util.spec_from_loader('joint_signed_base',loader=None)
module=importlib.util.module_from_spec(spec);module.__file__=str(path);sys.modules[spec.name]=module
exec(compile(raw,str(path),'exec'),module.__dict__)

class SignedNode(module.SignedNode):
    _proof_permission=None
    def endpoint_proof(self,keys):
        if self.phase not in ('read-left','read-right') or self._lease_active or self._body_active or self._proof_permission is not None:
            raise RuntimeError('STATE_READ_SCOPE')
        if type(keys) is not list or len(keys)!=4 or len(set(keys))!=4 or not all(module.BASE._hash(k) for k in keys):
            raise RuntimeError('STATE_KEYS')
        config=self._scope.read_config
        params=[config['addresses']['registry'],list(keys),hex(config['end_block_number'])]
        self._proof_permission=((params[0],tuple(params[1]),params[2]),self.generation,self.phase)
        try:
            result=self.rpc('collector.'+self.phase[5:]+'.registry-proof','eth_getProof',params)
            if self._proof_permission is not None:raise RuntimeError('STATE_PERMISSION_UNCONSUMED')
            return result
        finally:self._proof_permission=None

    def _params(self,method,params):
        if method=='eth_getProof':
            permission=self._proof_permission
            if permission is None or self._lease_active or self._body_active:
                raise RuntimeError('STATE_READ_SCOPE')
            selected,generation,phase=permission
            if (type(params) is not list or len(params)!=3 or type(params[1]) is not list
                    or (params[0],tuple(params[1]),params[2])!=selected
                    or generation!=self.generation or phase!=self.phase or phase not in ('read-left','read-right')):
                raise RuntimeError('STATE_READ_SCOPE')
            self._proof_permission=None
            return
        return super()._params(method,params)
