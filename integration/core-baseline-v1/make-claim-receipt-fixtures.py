from pathlib import Path
import runpy,json,sys,hashlib,copy
root=Path(sys.argv[1]);out=Path(sys.argv[2]);vectors=json.loads(Path(sys.argv[3]).read_text())['vectors'];v=vectors[0]
g=runpy.run_path(str(root/'reference/fixtures/generate-block-receipts-fixtures.py'))
primitive_path=root/'reference/fixtures/generate-ethereum-proof-fixtures.py'
assert hashlib.sha256(primitive_path.read_bytes()).hexdigest()==g['PRIMITIVE_SHA256']
p=runpy.run_path(str(primitive_path));uint=lambda n:int(n).to_bytes(32,'big');raw=lambda s:bytes.fromhex(s[2:]);hx=lambda b:'0x'+b.hex()
topic=lambda s:hx(p['digest'](s.encode()))
ad={'address':v['selection']['emitter'],'topics':[topic('ResearchFeeAdmitted(bytes32,uint256,uint256,uint256,uint256,bytes32,uint256,uint256,bytes32)'),v['recordId'],hx(uint(v['payerAccount']))],
    'data':hx(uint(v['epoch'])+uint(v['nonce'])+uint(v['fee'])+raw(v['stakeRoot'])+uint(v['totalStake'])+uint(v['payerStake'])+raw(v['selection']['profile']))}
cl={'address':ad['address'],'topics':[topic('ResearchFeeClaimed(bytes32,uint256,uint256)'),v['recordId'],hx(uint(3))],'data':hx(uint(4))}
def case(name,rows):return g['case'](name,[g['receipt'](2,status,(i+1)*21000,logs,p)for i,(status,logs)in enumerate(rows)],p)
wrong=copy.deepcopy(ad);wrong['data']=hx(uint(v['epoch'])+uint(v['nonce'])+uint(999)+raw(v['stakeRoot'])+uint(v['totalStake'])+uint(v['payerStake'])+raw(v['selection']['profile']))
foreign=copy.deepcopy(ad);foreign['address']='0x'+'44'*20
cases=[case('valid',[(1,[ad]),(0,[]),(1,[cl])]),case('failed-with-log',[(0,[ad])]),case('wrong-record-fee',[(1,[wrong])]),case('foreign-emitter',[(1,[foreign])])]
out.write_text(json.dumps({'synthetic':True,'selectionContext':v['selection'],'cases':cases},indent=2)+'\n')
