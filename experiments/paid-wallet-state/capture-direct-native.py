"""Minimal direct precompile call under the unchanged signed local harness."""
from pathlib import Path
import hashlib,json
NATIVE='0x'+'00'*19+'01'
def proof_node(module):
 class ProofNode(module.SignedNode):
  native_permission=None
  def native_proof(self,header):
   assert self.phase=='prefix' and self.native_permission is None
   params=[NATIVE,[],header['number']];self.native_permission=params
   try:return self.rpc('native.proof','eth_getProof',params)
   finally:self.native_permission=None
  def _params(self,method,params):
   if method=='eth_getProof':
    expected=self.native_permission;self.native_permission=None
    if self.phase!='prefix' or self._lease_active or self._body_active or expected is None or params!=expected:raise RuntimeError('DIRECT_NATIVE_PROOF_SCOPE')
    return
   return super()._params(method,params)
 return ProofNode

BODY='''        with node:
            writer = Writer(node,k,build)
            node.rpc('gas','anvil_setBalance',[A,'0xde0b6b3a7640000'])
            node.rpc('parity_simulation_gas','anvil_setBalance',[D,'0xde0b6b3a7640000'])
            result['setup']=writer.send('direct.setup',A,A,'0x',returned='0x')
            parent=writer.header('direct.parent')
            parent_proof=node.native_proof(parent)
            need(writer.header('direct.parent_stable')==parent,'PARENT_MOVED')
            signature=bytes.fromhex(intent['signature'][2:])
            data=intent['digest']+base.word(signature[64]).hex()+signature[:64].hex()
            row=writer.send('direct.native',A,NATIVE,data,returned='0x'+base.word(A).hex())
            child=writer.header('direct.child')
            child_proof=node.native_proof(child)
            need(writer.header('direct.child_stable')==child,'CHILD_MOVED')
            need(child['parentHash']==parent['hash'] and child['transactions']==[row['receipt']['transactionHash']],'DIRECT_INTERVAL')
            result['directNative']={'parent':parent,'parentProof':parent_proof,'child':child,'childProof':child_proof,'row':row,'submission':writer.signed_submissions[-1],'intent':intent}
            result['submissions']=writer.signed_submissions
            verify_pins()
            result['source_pins_unchanged_after_run']=True
            result['status']='pass'
'''
if __name__=='__main__':
 here=Path(__file__).resolve().parent;path=here/'run_wallet_state.py';raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='b53b902e949b40d9e7e0502d544f9364d2c2c4370ba38464801090df941c3907','RUNNER_PIN'
 fixture=(here/'mined.json').read_bytes();assert hashlib.sha256(fixture).hexdigest()=='a10d102b0c2af32ee0958439e489adb372ec204de8622e3845372aa852c5242b','INTENT_SOURCE_PIN'
 intent=json.loads(fixture)['intent']
 text=raw.decode();start=text.index('        with node:');end=text.index('    except Exception as error:',start)
 text=text[:start]+BODY+text[end:]
 old='node = node_module.SignedNode(';assert text.count(old)==1;text=text.replace(old,'node = proof_node(node_module)(')
 exec(compile(text,str(path)+'[direct-native-control]','exec'),{'__name__':'__main__','__file__':str(path),'intent':intent,'NATIVE':NATIVE,'proof_node':proof_node})
