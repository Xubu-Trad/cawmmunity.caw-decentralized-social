"""Project a completed local run into bounded public verifier inputs; no RPC."""
import argparse,hashlib,json
from pathlib import Path
def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--sha256',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 assert a.input.stat().st_size<=8*1024*1024 and not a.output.exists()
 raw=a.input.read_bytes();assert hashlib.sha256(raw).hexdigest()==a.sha256
 source=json.loads(raw);assert source['status']=='pass' and source['owned_listener_released']
 assert source['schema']=='caw-paid-signed-state-acquisition-run/1'
 assert source['signing']['impersonation_enabled'] is False and source['node']['upstream_forwarded_count']==0
 assert not any(row['request']['method'] in ('eth_sendTransaction','anvil_impersonateAccount','anvil_autoImpersonateAccount') for row in source['rpc'])
 result={'schema':'caw-executed-signed-state-fixture/1','rawCaptureSha256':a.sha256,
  'inputManifestSha256':source['input_manifest_sha256'],'localOnly':True,'syntheticToken':True,
  'nonImpersonatedSubmissions':True,'publicChainCertification':False,'branches':{}}
 policy={'schema':'caw-paid-post-policy/1','profile':'paid-action-v1-eoa-65-low-s','assumedEoaOwners':source['signing']['public_test_accounts']}
 for name in ('left','right'):
  branch=source['branches'][name];collected=branch['collectors']['number'];other=branch['collectors']['hash']
  assert collected['history']==other['history'] and collected['manifest']==other['manifest']
  state=branch['registry_state'];assert state['unleased_proof_refused_before_transport']
  assert state['evidence']['header']['hash']==collected['manifest']['end_block_hash']
  result['branches'][name]={'schema':'caw-paid-registry-state-history/1','history':collected['history'],'manifest':collected['manifest'],
   'captures':[row['capture'] for row in branch['body_captures']],'policy':policy,'stateEvidence':state['evidence'],'stateSelection':state['selection']}
 encoded=(json.dumps(result,indent=2)+'\n').encode();assert len(encoded)<2*1024*1024
 with a.output.open('xb') as f:f.write(encoded)
 print(json.dumps({'sha256':hashlib.sha256(encoded).hexdigest(),'bytes':len(encoded),'branches':2}))
if __name__=='__main__':main()
