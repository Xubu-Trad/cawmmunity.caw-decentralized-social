"""Decode only the pinned minimal-preset fixture; not a network SSZ adapter."""
from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[1];D=R/'evidence/consensus-capella-bootstrap'
def snappy(data):
    if len(data)>65536:raise ValueError('compressed limit')
    pos=0
    def take(n):
        nonlocal pos
        if n<0 or pos+n>len(data):raise ValueError('truncated')
        b=data[pos:pos+n];pos+=n;return b
    size=0
    for i in range(5):
        b=take(1)[0];size|=(b&127)<<(7*i)
        if not b&128:break
    else:raise ValueError('varint')
    if size>65536:raise ValueError('expanded limit')
    out=bytearray()
    while pos<len(data):
        tag=take(1)[0];kind=tag&3
        if kind==0:
            n=tag>>2
            n=(n+1) if n<60 else int.from_bytes(take(n-59),'little')+1
            if len(out)+n>size:raise ValueError('output overflow')
            out.extend(take(n))
        else:
            if kind==1:n=4+((tag>>2)&7);offset=((tag&224)<<3)|take(1)[0]
            else:n=1+(tag>>2);offset=int.from_bytes(take(2 if kind==2 else 4),'little')
            if not 0<offset<=len(out) or len(out)+n>size:raise ValueError('copy bounds')
            for _ in range(n):out.append(out[-offset])
    if len(out)!=size:raise ValueError('size mismatch')
    return bytes(out)
def decode():
    provenance=json.loads((D/'provenance.json').read_text())
    for record in provenance['files']:
        b=(D/Path(record['path']).name).read_bytes()
        if hashlib.sha256(b).hexdigest()!=record['sha256']:raise ValueError('fixture hash')
    raw=snappy((D/'bootstrap.ssz_snappy').read_bytes())
    if int.from_bytes(raw[:4],'little')!=1748:raise ValueError('minimal bootstrap offset')
    header=raw[1748:]
    if len(header)<812 or len(header)>844 or int.from_bytes(header[112:116],'little')!=244:raise ValueError('header layout')
    hx=lambda b:'0x'+b.hex()
    beacon={'slot':str(int.from_bytes(header[:8],'little')),'proposer_index':str(int.from_bytes(header[8:16],'little')),
      'parent_root':hx(header[16:48]),'state_root':hx(header[48:80]),'body_root':hx(header[80:112])}
    branch=[hx(header[i:i+32])for i in range(116,244,32)]
    p=header[244:];offset=0;values={};chunks=[]
    sha=lambda a,b:hashlib.sha256(a+b).digest()
    def merkle(c):
        while len(c)>1:c=[sha(c[i],c[i+1])for i in range(0,len(c),2)]
        return c[0]
    layout=[('parent_hash',32),('fee_recipient',20),('state_root',32),('receipts_root',32),('logs_bloom',256),('prev_randao',32),('block_number',8),('gas_limit',8),('gas_used',8),('timestamp',8),('extra_data',4),('base_fee_per_gas',32),('block_hash',32),('transactions_root',32),('withdrawals_root',32)]
    for key,n in layout:
        b=p[offset:offset+n];offset+=n
        if len(b)!=n:raise ValueError('payload truncated')
        if key=='extra_data':
            if int.from_bytes(b,'little')!=568:raise ValueError('extra offset')
            extra=p[568:]
            values[key]=hx(extra);chunks.append(sha(extra.ljust(32,b'\0'),len(extra).to_bytes(32,'little')))
        elif key in ['block_number','gas_limit','gas_used','timestamp','base_fee_per_gas']:
            values[key]=str(int.from_bytes(b,'little'));chunks.append(b.ljust(32,b'\0'))
        else:
            values[key]=hx(b);chunks.append(merkle([b[i:i+32]for i in range(0,256,32)])if key=='logs_bloom' else b.ljust(32,b'\0'))
    chunks.append(bytes(32));payload_root=hx(merkle(chunks))
    selected=re.search(r"trusted_block_root: '(0x[0-9a-f]{64})'",(D/'meta.yaml').read_text()).group(1)
    return {'origin':'official minimal Capella bootstrap; selected root copied from metadata; committee and signatures not verified',
      'decompressedSha256':hashlib.sha256(raw).hexdigest(),'decompressedSize':len(raw),'selectedBeaconRoot':selected,
      'committee':{'pubkeys':[hx(raw[i:i+48]) for i in range(4,1540,48)],'aggregate_pubkey':hx(raw[1540:1588])},
      'committeeBranch':[hx(raw[i:i+32])for i in range(1588,1748,32)],
      'input':{'schema':'caw-capella-header-binding/1','profile':'capella-structural-only','beacon':beacon,'execution':values,'executionRoot':payload_root,'executionBranch':branch}}
if __name__=='__main__':
    result=decode();(D/'binding.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'bytes':result['decompressedSize'],'root':result['selectedBeaconRoot']}))
