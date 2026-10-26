from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
pins={'shared-signed-transfer-replay.mjs': '1da7db78e17f3d241d4987cdc62dd7422aeee431eb180f4b4c75ec17ab912c45', 'shared-missing-witness-replay.mjs': '1e548cee6e1e44d0cc726f6fedc07eebe3f0abf287f36dce9371e5a90bd10554', 'shared-signed-contract-replay.mjs': 'b6462d1b2869960916fa47e413486a5af581d0bde623665569e19de47ff968fa', 'shared-signed-revert-replay.mjs': 'fd04f11476d2670ad342061793282ec77e770b955082abd68ec178e6b947dcd7', 'shared-signed-clear-replay.mjs': '40a83f53c0dccc883947d8a0b96ffeed8d43d8d7fcbe5a9c48ab04e4e0876a84', 'shared-signed-cap-replay.mjs': '3dea6cabdc78b9d8b4e2c96b7635c6daf0cc207136832e4d17ebbff2a0d2dc01', 'shared-adapter-check.mjs': '21456f3e2a74f08fdf3181d81550411aa09cb1515e875c97be3b8f74b867aab7', 'manifest-replay-check.mjs': 'f0629d2c60ba6ccb10342e485aa8d06bfe8305982ee77b9fdcb8c6b311c6df7a'}
outputs={}
for name,expected in pins.items():
 raw=(root/name).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==expected,('SOURCE_CHANGED',name)
 text=raw.decode()
 count=0
 for package,factory in [('tx','createTxFromRLP'),('block','createBlockFromRPC')]:
  before="const {"+factory+"}=await import(pathToFileURL(vmRequire.resolve('@ethereumjs/"+package+"')));"
  after="const {"+factory+"}=await import(esmPackageEntry(vmRequire,'@ethereumjs/"+package+"'));"
  count+=text.count(before);text=text.replace(before,after)
 assert count in (0,2),(name,count)
 if count:text="import {esmPackageEntry} from './esm-package-entry.mjs';\n"+text
 for target in pins:text=text.replace("'./"+target+"'","'./esm-"+target+"'")
 outputs['esm-'+name]=text.encode()
for name in outputs:assert not (root/name).exists(),('OUTPUT_EXISTS',name)
assert not (root/'esm-comparison-sources.json').exists()
for name,data in outputs.items():(root/name).write_bytes(data)
record={'sourceSha256':pins,'generatedSha256':{n:hashlib.sha256(b).hexdigest() for n,b in outputs.items()},'resolverSha256':hashlib.sha256((root/'esm-package-entry.mjs').read_bytes()).hexdigest(),'transform':'Only tx/block import mode changed; local harness imports routed to generated counterparts. Original source files preserved.'}
(root/'esm-comparison-sources.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
