"""Construct synthetic, NOT executed receipts around retained signed bytes."""
from pathlib import Path
import sys,json,runpy,hashlib
root=Path(sys.argv[1]);history=Path(sys.argv[2]);receipt_cases=Path(sys.argv[3]);out=Path(sys.argv[4])
assert hashlib.sha256(history.read_bytes()).hexdigest()=='689f880143cdc55f3016dcad42b70bb188af35ad296305e4ee42a9f058a76742'
capture=json.loads(history.read_text());raw_tx=capture['blocks'][1]['rawTransactions'][0]
source=next(c for c in json.loads(receipt_cases.read_text())['cases'] if c['name']=='valid')
logs=[source['receipts'][0]['logs'][0],source['receipts'][2]['logs'][0]]
g=runpy.run_path(str(root/'reference/fixtures/generate-block-receipts-fixtures.py'))
primitive=root/'reference/fixtures/generate-ethereum-proof-fixtures.py'
assert hashlib.sha256(primitive.read_bytes()).hexdigest()==g['PRIMITIVE_SHA256']
p=runpy.run_path(str(primitive));raw=bytes.fromhex(raw_tx[2:]);tx_type=raw[0] if raw[0]<0x80 else 0
receipt=g['receipt'](tx_type,1,21000,logs,p)
case=g['case']('synthetic-receipts-around-retained-signed-bytes',[receipt],p)
header=case['header']
header['transactionsRoot']='0x'+p['Trie']([(p['rlp'](p['integer'](0)),raw)]).root.hex()
values=[p['integer'](int(header[k],16)) if k in g['HEADER_QUANTITIES'] else bytes.fromhex(header[k][2:])for k in g['HEADER_FIELDS']]
header['hash']='0x'+p['digest'](p['rlp'](values)).hex()
for r in case['receipts']:r['blockHash']=header['hash']
case['selection']['hash']=header['hash']
# Prior generator expected-header fields no longer apply after replacing body root.
case.pop('expected')
case.update({'synthetic':True,'executionClaimed':False,'rawTransactions':[raw_tx],
 'context':json.loads(receipt_cases.read_text())['selectionContext'],
 'sourceCaptureSha256':hashlib.sha256(history.read_bytes()).hexdigest(),
 'transactionHash':'0x'+p['digest'](raw).hex(),
 'warning':'Receipt logs are newly fabricated test vectors, NOT the recorded transaction outcome. The original retained capture is unchanged.'})
with out.open('x')as f:json.dump(case,f,indent=2);f.write('\n')
