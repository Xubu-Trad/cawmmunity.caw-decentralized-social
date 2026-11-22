from pathlib import Path
import runpy,json,sys
m=runpy.run_path(str(Path(__file__).with_name('c007-snapshot-claims.py')))
Record,digest,build,DOMAIN=(m[k] for k in ['Record','digest','build','DOMAIN'])
records=[]
for nonce,fee,weights in [(0,5,{1:2,2:3,3:5}),(1,7,{1:2,2:1,3:7})]:
    root,total,_=build(weights);records.append((Record(*DOMAIN,1,0,nonce,fee,root,total),2))
maximum=(1<<256)-1
records += [(Record(maximum,b'\xff'*20,b'\xff'*32,maximum,maximum,maximum,maximum,b'\xff'*32,maximum),maximum),
            (Record(0,b'\0'*20,b'\0'*32,0,0,0,0,b'\0'*32,0),0)]
out=[]
for r,payer_weight in records:
    out.append({'selection':{'chainId':str(r.chain),'emitter':'0x'+r.contract.hex(),'profile':'0x'+r.profile.hex()},
      'recordId':'0x'+digest(r),'payerAccount':str(r.payer),'epoch':str(r.epoch),'nonce':str(r.nonce),
      'fee':str(r.fee),'stakeRoot':'0x'+r.root.hex(),'totalStake':str(r.total),'payerStake':str(payer_weight)})
Path(sys.argv[1]).write_text(json.dumps({'status':'RESEARCH_BYTE_VECTORS_NOT_VALID_ACTIONS','vectors':out},indent=2)+'\n')
