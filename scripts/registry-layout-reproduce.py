"""Prepare/verify compiler output for the fixed registry; never execute a compiler."""
from pathlib import Path
import hashlib, json, sys

ROOT = Path(__file__).resolve().parents[1] / 'experiments/account-authority'

def read(path, limit=10*1024*1024):
    with path.open('rb') as stream:
        data=stream.read(limit+1)
    if len(data)>limit:
        raise ValueError('input size limit')
    return data

def main(mode, path):
    receipt=json.loads(read(ROOT/'storage-layout.json'))
    original=read(ROOT/'compile-standard.json')
    if hashlib.sha256(original).hexdigest()!=receipt['parent_input_sha256']:
        raise ValueError('parent input changed')
    request=json.loads(original)
    request['settings']['outputSelection']['*']['*'].append('storageLayout')
    data=(json.dumps(request,sort_keys=True,separators=(',',':'))+'\n').encode()
    if hashlib.sha256(data).hexdigest()!=receipt['compiler_input_sha256']:
        raise ValueError('derived input changed')
    if mode=='input':
        with path.open('xb') as output: output.write(data)
        return {'inputSha256':hashlib.sha256(data).hexdigest()}
    if mode!='verify': raise ValueError('mode must be input or verify')
    compiled=json.loads(read(path))
    if any(e.get('severity')=='error' for e in compiled.get('errors',[])):
        raise ValueError('compiler errors')
    actual=compiled['contracts']['TestAccountRegistry.sol']['TestAccountRegistry']
    expected=json.loads(read(ROOT/'authority-build.json'))['contracts']['TestAccountRegistry']
    checks={'runtime': '0x'+actual['evm']['deployedBytecode']['object']==expected['runtime'],
            'creation': '0x'+actual['evm']['bytecode']['object']==expected['bytecode'],
            'abi':actual['abi']==expected['abi'],
            'layout':actual['storageLayout']==receipt['storageLayout']}
    if not all(checks.values()):raise ValueError('compiler comparison failed: '+str(checks))
    return {'matches':checks,'compilerIdentityAuthenticated':False,'deployedStateVerified':False}

if __name__=='__main__':
    if len(sys.argv)!=3:raise SystemExit('usage: registry-layout-reproduce.py input|verify FILE')
    print(json.dumps(main(sys.argv[1],Path(sys.argv[2]))))
