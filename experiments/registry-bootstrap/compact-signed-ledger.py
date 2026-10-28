from pathlib import Path
import json,hashlib,argparse
p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args();assert not a.output.exists(),'NEW_OUTPUT_REQUIRED'
assert a.input.stat().st_size<8*1024*1024;raw=a.input.read_bytes();f=json.loads(raw)
assert f['status']=='pass' and f['owned_listener_released'] and f['source_pins_unchanged_after_run']
assert f['node']['stop_reason'] is None and f['node']['non_impersonated_submission'] and f['node']['upstream_forwarded_count']==0
assert not any(x['request']['method'] in ['anvil_impersonateAccount','eth_sendTransaction'] for x in f['rpc'])
out={'schema':'caw-joint-signed-ledger-capture/1','rawCaptureSha256':hashlib.sha256(raw).hexdigest(),'localOnly':True,'syntheticToken':True,'impersonatedActors':False,'ownedListenerReleased':True,'upstreamForwardedCount':0,'productionAccepted':False,'branches':{}}
for name,b in f['branches'].items():out['branches'][name]={'ledger':b['ledger'],'captures':[c['capture'] for c in b['body_captures']],'unleasedPaidProofRefused':b['paid_unleased_refused_before_transport']}
p=a.output;p.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8');print(p.stat().st_size)

