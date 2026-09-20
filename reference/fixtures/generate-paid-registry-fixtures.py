"""Offline native-signed negative registry fixture; public test scalar only.

The retained transfer is re-signed by an unauthorized test sender. Commitment
bytes are rebuilt while success receipts remain deliberately impossible. This
is not EVM execution or a real account transaction. No RPC/network is used.
"""
import argparse,copy,gzip,hashlib,json,sys
from pathlib import Path
import cryptography
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec,utils
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[2]
N=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
PINS={
 'reference/fixtures/generate-ethereum-proof-fixtures.py':'5f100b6e1a12d29b0004bcb29f2ba5b23ffefc076646d2b67b1fb8df81c2effa',
 'reference/fixtures/generate-block-receipts-fixtures.py':'bade4d20fa0fd49d0990745b0dd4c0a4163cc7634d537358225e7c49dedaca77',
 'experiments/paid-action/CawPaidActionProbe.sol':'e48f8f8f816aae21e0e9865a8be0aa2e47204ea04b4c12b4124e5b0452412da1',
 'experiments/paid-action/run_paid_action.py':'92b50402f8ad097839ec4e40e7e221647c89c8b9d0b3c915c4ce2400531130bf',
 'experiments/paid-signed-body-acquisition/execution-trace.json.gz':'d98a1b7c2e5d28bc05b75e427b7e2eacb7e237c6756c6dd460124feb6e18a276'}
def need(ok,reason):
    if not ok:raise ValueError('PAID_REGISTRY_FIXTURE_'+reason)
def read(name):
    with (ROOT/name).open('rb') as f:raw=f.read(1024*1024+1)
    need(len(raw)<=1024*1024 and hashlib.sha256(raw).hexdigest()==PINS[name],'SOURCE_PIN')
    return raw
def load(name):
    raw=read(name);scope={'__name__':'pinned_fixture','__file__':str(ROOT/name)}
    exec(compile(raw,str(ROOT/name),'exec'),scope);return scope
def word(v):return (int(v,16) if isinstance(v,str) else v).to_bytes(32,'big')
def hx(v):return '0x'+v.hex()
def blob(v):return word(len(v))+v+bytes(-len(v)%32)

PINS['experiments/paid-action/TestAccountRegistry.sol']='ab3aecb6b0bc77fa838baf1141d2af96ad8395850b714f35b2f0cdb3b8c826df'

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    need(not args.output.exists() and args.output.parent.is_dir(),'NEW_OUTPUT')
    need(cryptography.__version__=='50.0.1','CRYPTOGRAPHY_VERSION')
    primitive=load('reference/fixtures/generate-ethereum-proof-fixtures.py')
    headers=load('reference/fixtures/generate-block-receipts-fixtures.py')
    read('experiments/paid-action/CawPaidActionProbe.sol');read('experiments/paid-action/run_paid_action.py')
    k=primitive['digest'];uint=primitive['integer'];rlp=primitive['rlp'];kh=lambda t:k(t.encode())
    need(hx(k(b''))=='0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470','KECCAK')
    def native(digest,scalar):
        need(scalar == 0x1337ca200002,'PUBLIC_FIXTURE_SCALAR')
        key=ec.derive_private_key(scalar,ec.SECP256K1())
        der=key.sign(digest,ec.ECDSA(utils.Prehashed(hashes.SHA256()),deterministic_signing=True))
        r,s=utils.decode_dss_signature(der);s=min(s,N-s)
        key.public_key().verify(utils.encode_dss_signature(r,s),digest,ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        nonce=(int.from_bytes(digest,'big')+r*scalar)*pow(s,-1,N)%N
        need(nonce!=0,'NATIVE_NONCE');point=ec.derive_private_key(nonce,ec.SECP256K1()).public_key().public_numbers()
        need(point.x==r,'ETHEREUM_RECOVERY_POINT');pub=key.public_key().public_numbers()
        coords=word(pub.x)+word(pub.y)
        return word(r)+word(s)+bytes([27+(point.y&1)]),hx(b'\x04'+coords),hx(k(coords)[-20:])
    compressed=read('experiments/paid-signed-body-acquisition/execution-trace.json.gz')
    import io
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as f:expanded=f.read(8*1024*1024+1)
    need(len(expanded)<=8*1024*1024 and hashlib.sha256(expanded).hexdigest()=='6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975','TRACE_PIN')
    trace=json.loads(expanded);history=trace['branches']['left']['collectors']['number']['history'];index=10
    read('experiments/paid-action/TestAccountRegistry.sol')
    original=history['blocks'][index];tx=original['transactions'][0]['transaction'];calldata=bytes.fromhex(tx['data'][2:])
    need(tx['to']==history['addresses']['registry'] and calldata[:4]==bytes.fromhex('23b872dd'),'TRANSFER_CALL')
    submission=next(s for s in trace['submissions'] if s['hash']==original['header']['transactions'][0])
    tx_nonce=submission['nonce'];tx_nonce=int(tx_nonce,16) if isinstance(tx_nonce,str) else tx_nonce
    base=[uint(tx_nonce),uint(int(tx['gasPrice'],16)),uint(int(tx['gas'],16)),bytes.fromhex(tx['to'][2:]),uint(int(tx['value'],16)),calldata]
    sig,pub,signer=native(k(rlp(base+[uint(31337),b'',b''])),0x1337ca200002)
    need(signer=='0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73' and signer!=tx['from'],'UNAUTHORIZED_TEST_SIGNER')
    raw=rlp(base+[uint(31337*2+35+sig[64]-27),sig[:32].lstrip(b'\x00'),sig[32:64].lstrip(b'\x00')]);txhash=hx(k(raw))
    linked=[];previous=None
    for offset in range(index,len(history['blocks'])):
        h=copy.deepcopy(history['blocks'][offset]['header'])
        if offset==index:
            h['transactions']=[txhash];h['transactionsRoot']=hx(primitive['Trie']([(rlp(uint(0)),raw)]).root)
        else:h['parentHash']=previous
        encoded=rlp([uint(int(h[key],16)) if key in headers['HEADER_QUANTITIES'] else bytes.fromhex(h[key][2:]) for key in headers['HEADER_FIELDS']])
        h['hash']=hx(k(encoded));previous=h['hash'];linked.append(dict(index=offset,header=h))
    result=dict(schema='caw-paid-registry-fixtures/1',synthetic=True,
        provenance=dict(cryptography='50.0.1',source_pins=PINS,public_test_scalar='0x1337ca200002',
            boundary='Synthetic signatures and commitments, not valid execution. Receipt from/transaction labels are not receipt-trie payloads.',
            shared_primitives='Pinned Python Keccak/RLP/trie/header helpers; native deterministic ECDSA. No JavaScript imports.'),
        historyMutation=dict(base='alpha41-left-number',index=index,sender=signer,rawTransaction=hx(raw),transactionHash=txhash,headers=linked,expected_error='PAID_REGISTRY_NOT_AUTHORIZED'))
    output=(json.dumps(result,indent=2,sort_keys=True)+'\n').encode();need(len(output)<=96*1024,'OUTPUT_BOUND')
    with args.output.open('xb') as f:f.write(output)
    print(json.dumps(dict(status='pass',bytes=len(output),sha256=hashlib.sha256(output).hexdigest())))
if __name__=='__main__':main()
