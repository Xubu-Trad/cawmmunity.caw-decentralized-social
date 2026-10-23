"""Acquire registry proofs from a disposable guarded local node; no remote RPC."""
import argparse, hashlib, importlib.util, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True

def load(name, path, expected):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise RuntimeError('INPUT_PIN')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--anvil', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists() or not args.output.parent.is_dir():
        raise RuntimeError('NEW_OUTPUT_REQUIRED')
    helper = load('registry_local_node', HERE/'account_node.py', '461a0d0e0f6124d8540f58bb77252406d081a81dd180438cea26d01420bb5bbf')
    experiment = load('registry_local_experiment', HERE/'run_account_authority.py', 'd6ed0548f91a2b5d7a9208ef24ff4a78b5094aae185e63e9a704b2ce728d533f')
    k = load('registry_local_keccak', HERE/'../../reference/fixtures/generate-ethereum-proof-fixtures.py', '5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa')
    raw = (HERE/'authority-build.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != '43dca5ba9079d2f5a1bc4a155b21b31a147f573fd8ab995c7fbde3e11b9341fa':
        raise RuntimeError('BUILD_PIN')
    class ProofNode(helper.Node):
        proof_scope = None
        def _params(self, method, params):
            if method == 'eth_getProof':
                if self.proof_scope is None or params != self.proof_scope:
                    raise RuntimeError('PROOF_SCOPE_REFUSED')
                return
            return super()._params(method, params)
    record = {'schema':'caw-executed-registry-approvals/1', 'complete':False,
              'localOnly':True, 'impersonatedActors':True, 'publicChainCertification':False,
              'setup':[], 'deployments':[], 'cases':[]}
    node = ProofNode(args.anvil, 'synthetic', args.output.parent/(args.output.stem+'-work'))
    try:
        with node:
            e = experiment.Experiment(node, k, json.loads(raw), record)
            for actor in (experiment.A, experiment.B, experiment.D):
                node.rpc('fund.'+actor, 'anvil_setBalance', [actor,'0xde0b6b3a7640000'])
                node.rpc('actor.'+actor, 'anvil_impersonateAccount', [actor])
            registry = e.deploy('registry', 'TestAccountRegistry', (experiment.A,experiment.B))
            cases=[('initial',experiment.A,0,experiment.ZERO,False),('approved',experiment.A,0,experiment.D,False),
                   ('operator_granted',experiment.A,0,experiment.D,True),('transferred',experiment.B,1,experiment.ZERO,False),
                   ('returned',experiment.A,2,experiment.ZERO,True),('revoked',experiment.A,2,experiment.ZERO,False)]
            for label, owner, epoch, approved, allowed in cases:
                if label=='approved':e.call(label,experiment.A,registry,'approve(address,uint256)',experiment.D,1)
                if label=='operator_granted':e.call(label,experiment.A,registry,'setApprovalForAll(address,bool)',experiment.D,True)
                if label=='transferred':e.call(label,experiment.D,registry,'transferFrom(address,address,uint256)',experiment.A,experiment.B,1)
                if label=='returned':e.call(label,experiment.B,registry,'transferFrom(address,address,uint256)',experiment.B,experiment.A,1)
                if label=='revoked':e.call(label,experiment.A,registry,'setApprovalForAll(address,bool)',experiment.D,False)
                keys=['0x'+k.digest(bytes.fromhex(experiment.word(1)+experiment.word(slot))).hex() for slot in (0,4,2)]
                root=k.digest(bytes.fromhex(experiment.word(owner)+experiment.word(3)))
                keys.append('0x'+k.digest(bytes.fromhex(experiment.word(experiment.D))+root).hex())
                header = node.rpc(label+'.header','eth_getBlockByNumber',['latest',False])
                node.proof_scope = [registry,keys,header['number']]
                proof = node.rpc(label+'.proof','eth_getProof',node.proof_scope)
                code = node.rpc(label+'.code','eth_getCode',[registry,header['number']])
                direct = e.view(label+'.authority',registry,'authority(uint256)',1)
                experiment.require(direct == '0x'+experiment.word(owner)+experiment.word(epoch),'DIRECT_STATE')
                direct_approved=e.view(label+'.approved',registry,'getApproved(uint256)',1)
                direct_operator=e.view(label+'.operator',registry,'isApprovedForAll(address,address)',owner,experiment.D)
                experiment.require(direct_approved=='0x'+experiment.word(approved),'DIRECT_APPROVAL')
                experiment.require(direct_operator=='0x'+experiment.word(allowed),'DIRECT_OPERATOR')
                after = node.rpc(label+'.stable','eth_getBlockByNumber',['latest',False])
                experiment.require(after['hash']==header['hash'],'STATE_MOVED')
                record['cases'].append({'name':label,'owner':owner,'epoch':hex(epoch),'approved':approved,'operatorAllowed':allowed,
                    'directAuthority':direct,'directApproved':direct_approved,'directOperator':direct_operator,
                    'selection':{'schema':'caw-test-registry-approval-selection/1','headerProfile':'london-16','hash':header['hash'],'registry':registry,'accountId':'0x1','operator':experiment.D},
                    'evidence':{'header':header,'proof':proof,'code':code}})
        experiment.require(node.receipt()['stop_reason'] is None,'NODE_STOP')
        record['complete'] = True
    except Exception as exc:
        record['failure'] = str(exc)
    finally:
        record['node'] = node.receipt()
        encoded = (json.dumps(record,indent=2)+'\n').encode()
        if len(encoded)>1024*1024: raise RuntimeError('OUTPUT_BOUND')
        with args.output.open('xb') as out: out.write(encoded)
    print(json.dumps({'complete':record['complete'],'cases':len(record['cases']),'failure':record.get('failure')}))
    return 0 if record['complete'] else 1

if __name__ == '__main__': sys.exit(main())
