"""One signed public-test call to locally seeded code/storage on an owned local Anvil; no public RPC."""
from pathlib import Path
import argparse,hashlib,json,runpy,time
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'experiments/paid-action/paid_node.py'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='ecd540dfd3414b28cbb9d085254cc2be3de42ea7f13033afb40b72c6884a4160'
BASE=runpy.run_path(str(source))
RAW='0xf8678085174876e800830186a09447ecac8221f18970c48cf48aaa3cbe8167bbbe73808082f4f6a05c2799359d8ccffbeb2f847b9946b776b1be0f62fb27f378a817bfb0bdcea70ea07d9f730beda51da29db6725a2caa4ac25a4bb45e333af5c719b54eef0578a0ce'
TX='0xdd69a50eab143e9849f2de171200c2a55b059b1fb3394064bf076e9109921abb'
ACCOUNTS=['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76','0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73','0x'+'00'*20]
CODE='0x60005460010160005500'
SLOT='0x'+'00'*32
VALUE='0x'+'00'*31+'07'
class Node(BASE['Node']):
 def __init__(self,anvil,work):
  super().__init__(anvil,'synthetic',work);self.phase='setup';self.funded=set();self.heights=set();self.code_set=False;self.slot_set=False
 def _params(self,method,params):
  if method=='eth_chainId' and params==[]:return
  if method=='anvil_setBalance' and self.phase=='setup' and type(params)is list and len(params)==2 and params[0] in ACCOUNTS and params[0] not in self.funded and params[1]=='0xde0b6b3a7640000':
   self.funded.add(params[0]);return
  if method=='anvil_setCode' and self.phase=='setup' and not self.code_set and params==[ACCOUNTS[1],CODE]:self.code_set=True;return
  if method=='anvil_setStorageAt' and self.phase=='setup' and not self.slot_set and params==[ACCOUNTS[1],SLOT,VALUE]:self.slot_set=True;return
  if method=='evm_mine' and params==[] and self.phase=='setup' and self.funded==set(ACCOUNTS) and self.code_set and self.slot_set:self.phase='parent';return
  if method=='eth_getBlockByNumber' and params==['latest',False]:return
  if method=='eth_getProof' and type(params)is list and len(params)==3 and params[0] in ACCOUNTS and params[1]==([SLOT] if params[0]==ACCOUNTS[1] else []) and params[2] in self.heights:return
  if method=='eth_getCode' and type(params)is list and len(params)==2 and params[0] in ACCOUNTS and params[1] in self.heights:return
  if method=='eth_sendRawTransaction' and params==[RAW] and self.phase=='ready':self.phase='submitted';self.transaction_count+=1;return
  if method in ('eth_getTransactionReceipt','eth_getRawTransactionByHash') and params==[TX] and self.phase=='submitted':return
  raise RuntimeError('TRANSFER_SCOPE_REFUSED')
def selftest():
 n=Node(Path('unused'),Path('unused'))
 for method,p in [('eth_sendTransaction',[]),('anvil_impersonateAccount',[ACCOUNTS[0]]),('eth_getProof',[ACCOUNTS[0],[],'latest']),('eth_sendRawTransaction',[RAW]),('evm_mine',[])]:
  try:n._params(method,p)
  except RuntimeError:pass
  else:raise AssertionError(method)
 for a in ACCOUNTS:n._params('anvil_setBalance',[a,'0xde0b6b3a7640000'])
 n._params('anvil_setCode',[ACCOUNTS[1],CODE]);n._params('anvil_setStorageAt',[ACCOUNTS[1],SLOT,VALUE])
 n._params('evm_mine',[]);n.phase='ready';n._params('eth_sendRawTransaction',[RAW])
 try:n._params('eth_sendRawTransaction',[RAW])
 except RuntimeError:pass
 else:raise AssertionError('repeat submission')
 assert n.transaction_count==1
def main():
 p=argparse.ArgumentParser();p.add_argument('--anvil',type=Path);p.add_argument('--output',type=Path);p.add_argument('--self-test',action='store_true');a=p.parse_args()
 selftest()
 if a.self_test:print('scope checks passed');return
 assert a.anvil and a.output and a.output.parent.is_dir() and not a.output.exists()
 n=Node(a.anvil,a.output.parent/'owned-node');result={'schema':'caw-signed-contract-capture/1','status':'incomplete','rawTransaction':RAW,'transactionHash':TX,'accounts':ACCOUNTS,'localOnly':True,'publicChainAuthenticated':False}
 try:
  with n:
   for i,account in enumerate(ACCOUNTS):n.rpc('setup'+str(i),'anvil_setBalance',[account,'0xde0b6b3a7640000'])
   n.rpc('setup.code','anvil_setCode',[ACCOUNTS[1],CODE]);n.rpc('setup.slot','anvil_setStorageAt',[ACCOUNTS[1],SLOT,VALUE])
   n.rpc('setup.mine','evm_mine',[])
   def capture(label):
    h=n.rpc(label+'.header','eth_getBlockByNumber',['latest',False]);n.heights.add(h['number']);rows=[]
    for i,account in enumerate(ACCOUNTS):
     rows.append({'proof':n.rpc(label+'.proof'+str(i),'eth_getProof',[account,[SLOT] if i==1 else [],h['number']]),'code':n.rpc(label+'.code'+str(i),'eth_getCode',[account,h['number']])})
    again=n.rpc(label+'.again','eth_getBlockByNumber',['latest',False]);assert again==h,'HEADER_CHANGED'
    return {'header':h,'witnesses':rows}
   result['parent']=capture('parent');n.phase='ready'
   assert n.rpc('submit','eth_sendRawTransaction',[RAW])==TX
   receipt=None
   for i in range(20):
    receipt=n.rpc('receipt'+str(i),'eth_getTransactionReceipt',[TX])
    if receipt:break
    time.sleep(.05)
   assert receipt and receipt['status']=='0x1' and receipt['transactionIndex']=='0x0'
   result['receipt']=receipt;result['child']=capture('child')
   assert result['child']['header']['parentHash']==result['parent']['header']['hash']
   assert result['child']['header']['transactions']==[TX]
   assert result['child']['header']['miner']==ACCOUNTS[2]
   assert n.rpc('raw','eth_getRawTransactionByHash',[TX])==RAW
   result['status']='captured'
 finally:
  result['nodeReceipt']=n.receipt();result['requests']=n.calls
  a.output.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'status':result['status'],'transactionHash':TX}))
if __name__=='__main__':main()
