from pathlib import Path
import argparse,json,hashlib
p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
assert not a.output.exists() and a.input.stat().st_size<8*1024*1024
raw=a.input.read_bytes();f=json.loads(raw)
assert f['status']=='pass' and f['owned_listener_released'] and f['source_pins_unchanged_after_run']
assert f['node']['stop_reason'] is None and f['node']['upstream_forwarded_count']==0 and not f['node']['token_code_replaced']
assert not any(c['request']['method'] in ('anvil_impersonateAccount','eth_sendTransaction','anvil_setCode') for c in f['rpc'])
out={'schema':'caw-direct-native-fixture/1','rawCaptureSha256':hashlib.sha256(raw).hexdigest(),'localOnly':True,'writerSuppliedRaw':True,'tokenInstalled':False,'productionAccepted':False,'directNative':f['directNative']}
with a.output.open('x',encoding='utf-8') as stream:json.dump(out,stream,indent=2);stream.write('\n')
