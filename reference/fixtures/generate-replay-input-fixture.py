from pathlib import Path
import json,runpy,copy,hashlib,sys
sys.dont_write_bytecode=True
r=Path(__file__).resolve().parents[2]
f=json.loads((r/'experiments/paid-signed-withdrawal-acquisition/joint-capture.json').read_bytes())
b=f['branches']['left'];e=b['stateEvidence'];p=runpy.run_path(str(r/'reference/fixtures/generate-ethereum-proof-fixtures.py'));h=runpy.run_path(str(r/'reference/fixtures/generate-execution-header-fixtures.py'))
c=copy.deepcopy(b['captures'][-1]['header']);c['parentHash']=e['header']['hash'];c['number']=hex(int(e['header']['number'],16)+1);c['timestamp']=hex(int(e['header']['timestamp'],16)+1);c['hash']=h['encoded_header'](c,'london-16',p)[1]
a={'schema':'caw-first-transaction-anchor/1','parentHeader':e['header'],'header':c,'rawTransactions':b['captures'][-1]['raw_transactions'],'selection':{'profile':'london-16','parentHash':e['header']['hash'],'blockHash':c['hash'],'chainId':'0x7a69','transactionIndex':'0x0','transactionHash':b['history']['blocks'][-1]['transactions'][0]['receipt']['transactionHash']}}
d={'schema':'caw-replay-dependencies/1','header':e['header'],'selection':{'profile':'london-16','parentHash':e['header']['hash'],'dependencies':[{'address':e['proof']['address'],'storageKeys':['0x'+format(int(s['key'],16),'064x') for s in e['proof']['storageProof']],'expectedCodeHash':e['proof']['codeHash']}]},'witnesses':[{'proof':e['proof'],'code':e['code']}]}
x={'schema':'caw-replay-input-binding/1','anchor':a,'dependencies':d}
out=Path(sys.argv[1]);assert not out.exists();out.write_text(json.dumps({'syntheticChild':True,'executionValid':False,'input':x},indent=2)+'\n')
