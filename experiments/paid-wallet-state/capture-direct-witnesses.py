"""Add fixed sender and fee-recipient witnesses to the direct native control."""
from pathlib import Path
import hashlib,runpy,json

def witnesses(node,header,sender):
 out=[]
 for address in (sender,header['miner']):
  assert address in (sender,'0x'+'00'*20)
  params=[address,[],header['number']];assert node.account_permission is None
  node.account_permission=params
  try:proof=node.rpc('direct.account.proof','eth_getProof',params)
  finally:node.account_permission=None
  code=node.rpc('direct.account.code','eth_getCode',[address,header['number']])
  out.append({'proof':proof,'code':code})
 return {'header':header,'witnesses':out}

if __name__=='__main__':
 here=Path(__file__).resolve().parent
 assert hashlib.sha256((here/'capture-direct-native.py').read_bytes()).hexdigest()=='4559f84f8d4d583d58342309c82c663ec55cfb368671ea1c416c76bb2d29c583'
 direct=runpy.run_path(str(here/'capture-direct-native.py'))
 def proof_node(module):
  class Node(direct['proof_node'](module)):
   account_permission=None
   def _params(self,method,params):
    if method=='eth_getProof' and self.account_permission is not None:
     expected=self.account_permission;self.account_permission=None
     if self.phase!='prefix' or self._lease_active or self._body_active or params!=expected:raise RuntimeError('DIRECT_ACCOUNT_SCOPE')
     return
    return super()._params(method,params)
  return Node
 body=direct['BODY']
 for old,new in [("            parent_proof=node.native_proof(parent)","            parent_proof=node.native_proof(parent)\n            before=witnesses(node,parent,A)"),("            child_proof=node.native_proof(child)","            child_proof=node.native_proof(child)\n            after=witnesses(node,child,A)"),("            result['submissions']=writer.signed_submissions","            result['directNative']['parentWitnesses']=before\n            result['directNative']['childWitnesses']=after\n            result['submissions']=writer.signed_submissions")]:
  assert body.count(old)==1;body=body.replace(old,new)
 path=here/'run_wallet_state.py';raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()=='b53b902e949b40d9e7e0502d544f9364d2c2c4370ba38464801090df941c3907'
 fixture=(here/'mined.json').read_bytes();assert hashlib.sha256(fixture).hexdigest()=='a10d102b0c2af32ee0958439e489adb372ec204de8622e3845372aa852c5242b'
 text=raw.decode();start=text.index('        with node:');end=text.index('    except Exception as error:',start);text=text[:start]+body+text[end:]
 old='node = node_module.SignedNode(';assert text.count(old)==1;text=text.replace(old,'node = proof_node(node_module)(')
 exec(compile(text,str(path)+'[direct-witnesses]','exec'),{'__name__':'__main__','__file__':str(path),'intent':json.loads(fixture)['intent'],'NATIVE':direct['NATIVE'],'proof_node':proof_node,'witnesses':witnesses})
