"""Fresh local Geth capture from published signed synthetic inputs, not public-chain authentication."""
from pathlib import Path
import argparse,json,hashlib,subprocess,urllib.request,socket,time,os,shutil,sys
if sys.flags.optimize:raise SystemExit('OPTIMIZED_PYTHON_UNSUPPORTED')
p=argparse.ArgumentParser()
for k in ['geth','capture','genesis','expected','output']:p.add_argument('--'+k,required=True)
a=p.parse_args();o=Path(a.output).resolve();assert not o.exists(),'OUTPUT_EXISTS';assert shutil.disk_usage(o.parent).free>=2*1024**3,'DISK_GUARD'
if Path('/mnt/c').exists():assert shutil.disk_usage('/mnt/c').free>=2*1024**3,'HOST_DISK_GUARD'
assert int(dict(x.split(':',1)for x in Path('/proc/meminfo').read_text().splitlines())['MemAvailable'].split()[0])>=1024**2,'MEMORY_GUARD'
assert hashlib.sha256(Path(a.geth).read_bytes()).hexdigest()=='45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea','GETH_BYTES'
old=json.loads(Path(a.capture).read_text());expected=json.loads(Path(a.expected).read_text());assert len(old['blocks'])==22
o.mkdir();shutil.copyfile(a.genesis,o/'genesis.json');node=None;calls=[]
with socket.socket()as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
def rpc(method,params):
 q=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),{'Content-Type':'application/json'})
 v=json.load(urllib.request.urlopen(q,timeout=5));assert v.get('jsonrpc')=='2.0'and v.get('id')==1
 if 'error'in v:
  if method=='eth_getTransactionReceipt'and v['error'].get('code')==-32000 and v['error'].get('message')=='transaction indexing is in progress':return None
  raise ValueError(v['error'])
 assert 'result'in v;return v['result']
try:
 q=subprocess.run([a.geth,'--datadir',str(o/'data'),'init',str(o/'genesis.json')],capture_output=True,timeout=30);(o/'init.log').write_bytes(q.stdout+q.stderr);assert q.returncode==0
 with(o/'node.log').open('wb')as log:
  node=subprocess.Popen([a.geth,'--dev','--datadir',str(o/'data'),'--http','--http.addr','127.0.0.1','--http.port',str(port),'--http.api','eth,net,web3','--maxpeers','0','--nodiscover','--cache','64','--ipcdisable'],stdout=log,stderr=log,env={**os.environ,'GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'})
  for _ in range(100):
   assert node.poll()is None
   try:g=rpc('eth_getBlockByNumber',['0x0',False]);break
   except OSError:time.sleep(.1)
  else:raise RuntimeError('START_TIMEOUT')
  assert g['hash']==old['blocks'][0]['block']['hash'];assert rpc('eth_chainId',[])=='0x7a69';blocks=[{'block':g,'rawTransactions':[],'receipts':[]}]
  for row in old['blocks'][1:]:
   assert len(row['rawTransactions'])==len(row['receipts'])==1
   tx=rpc('eth_sendRawTransaction',row['rawTransactions']);assert tx==row['receipts'][0]['transactionHash']
   for _ in range(100):
    receipt=rpc('eth_getTransactionReceipt',[tx])
    if receipt:break
    time.sleep(.1)
   else:raise RuntimeError('RECEIPT_TIMEOUT')
   assert receipt['status']==row['receipts'][0]['status'];b=rpc('eth_getBlockByNumber',[receipt['blockNumber'],False]);assert b['transactions']==[tx];assert b['stateRoot']==row['block']['stateRoot'],'STATE_ROOT_MISMATCH';assert b['parentHash']==blocks[-1]['block']['hash'];blocks.append({'block':b,'rawTransactions':row['rawTransactions'],'receipts':[receipt]})
  tip=blocks[-1]['block'];address='0x19a827174f66b3c66ad7063951d7b4f94f996e77'
  proof=rpc('eth_getProof',[address,[x['key']for x in expected['storage']],tip['number']]);assert rpc('eth_getBlockByNumber',[tip['number'],False])['hash']==tip['hash']
  (o/'capture.json').write_text(json.dumps({'blocks':blocks},indent=2));(o/'evidence.json').write_text(json.dumps({'header':tip,'proof':proof},indent=2));(o/'result.json').write_text(json.dumps({'transactions':21,'stateRootsMatch':21,'genesisMatches':True,'freshDatabase':True,'freshProof':True,'publicChainAuthenticated':False},indent=2))
finally:
 if node and node.poll()is None:node.terminate();node.wait(timeout=15)
 (o/'service.json').write_text(json.dumps({'stopped':node is None or node.poll()is not None}))
parents=[hashlib.sha256(Path(x).read_bytes()).hexdigest()for x in [a.capture,a.genesis,a.expected,a.geth]]
(o/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS={json.dumps(parents)} TRANSFORM="fresh local execution of published signed fixture" SHA256={hashlib.sha256(f.read_bytes()).hexdigest()} SIZE={f.stat().st_size} PATH={f.name}'for f in o.iterdir()if f.is_file())+'\n')
print((o/'result.json').read_text())
