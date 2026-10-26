from pathlib import Path
import json,sys
assert len(sys.argv)==3, "Supply repository root and a new output directory"
r=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(exist_ok=False)
f=json.loads((r/'experiments/signed-contract-fixture/fixture.json').read_text());state=f['parent']
selected={'schema':'caw-replay-input-binding/1','anchor':{'schema':'caw-first-transaction-anchor/1','parentHeader':state['header'],'header':f['child']['header'],'rawTransactions':[f['rawTransaction']],'selection':{'profile':'london-16','parentHash':state['header']['hash'],'blockHash':f['child']['header']['hash'],'chainId':'0x7a69','transactionIndex':'0x0','transactionHash':f['transactionHash']}},'dependencies':{'schema':'caw-replay-dependencies/1','header':state['header'],'selection':{'profile':'london-16','parentHash':state['header']['hash'],'dependencies':[{'address':v['proof']['address'],'storageKeys':['0x'+format(int(p['key'],16),'064x') for p in v['proof']['storageProof']],'expectedCodeHash':v['proof']['codeHash']} for v in state['witnesses']]},'witnesses':state['witnesses']}}
(out/'valid.json').write_text(json.dumps(selected,separators=(',',':')),encoding='utf-8')
(out/'oversize.json').write_bytes(b' '*1048577)
(out/'invalid-utf8.json').write_bytes(b'\xff')
(out/'malformed.json').write_bytes(b'{bad')
