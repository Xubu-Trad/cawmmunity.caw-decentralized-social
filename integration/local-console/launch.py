from pathlib import Path
import argparse,subprocess,socket,urllib.request,json,time,os,shutil,sys,hashlib
from receipt_poll import rpc_result,wait_for_receipt
p=argparse.ArgumentParser();p.add_argument('--geth',required=True);p.add_argument('--capture',required=True);p.add_argument('--genesis',required=True);p.add_argument('--selection',required=True);p.add_argument('--registry-proof',required=True);p.add_argument('--output',required=True);p.add_argument('--smoke',action='store_true');a=p.parse_args()
if sys.flags.optimize:raise SystemExit('OPTIMIZED_PYTHON_UNSUPPORTED')
o=Path(a.output).resolve();src=Path(__file__).resolve().parent
if o.exists():raise SystemExit('OUTPUT_EXISTS')
if shutil.disk_usage(o.parent).free<2*1024**3:raise SystemExit('DISK_GUARD')
if int(dict(x.split(':',1)for x in Path('/proc/meminfo').read_text().splitlines())['MemAvailable'].split()[0])<1024**2:raise SystemExit('MEMORY_GUARD')
o.mkdir();capture=json.loads(Path(a.capture).read_text());genesis=json.loads(Path(a.genesis).read_text());selected=json.loads(Path(a.selection).read_text());reg=json.loads(Path(a.registry_proof).read_text());assert len(capture['blocks'])==22
(o/'genesis.json').write_text(json.dumps(genesis))
with socket.socket()as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
url=f'http://127.0.0.1:{port}'
def rpc(method,params):
 req=urllib.request.Request(url,json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),{'Content-Type':'application/json'});v=json.load(urllib.request.urlopen(req,timeout=5));return rpc_result(method,v)
q=subprocess.run([a.geth,'--datadir',str(o/'data'),'init',str(o/'genesis.json')],capture_output=True,timeout=30);(o/'init.log').write_bytes(q.stdout+q.stderr);assert q.returncode==0
node=None;web=None;receipt_polls=[]
try:
 with (o/'node.log').open('wb')as log:
  node=subprocess.Popen([a.geth,'--dev','--datadir',str(o/'data'),'--http','--http.addr','127.0.0.1','--http.port',str(port),'--http.api','eth,net,web3','--maxpeers','0','--nodiscover','--cache','64','--ipcdisable'],stdout=log,stderr=log,env={**os.environ,'GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'})
  for _ in range(100):
   assert node.poll()is None
   try:g=rpc('eth_getBlockByNumber',['0x0',False]);break
   except OSError:time.sleep(.1)
  else:raise RuntimeError('START_TIMEOUT')
  assert g['hash']==capture['blocks'][0]['block']['hash'],'GENESIS_MISMATCH'
  for b in capture['blocks'][1:11]:
   assert len(b['rawTransactions'])==1
   tx=rpc('eth_sendRawTransaction',[b['rawTransactions'][0]]);assert tx==b['receipts'][0]['transactionHash']
   receipt=wait_for_receipt(rpc,tx,receipt_polls)
   assert receipt and receipt['status']=='0x1'
  names={'AccountOwnerWalletResearch':'wallet','FundedAdmissionResearch':'custody','AdmissionTokenFixture':'token'}
  contracts={names[d['name']]:{'address':d['address'],'codeHash':d['expectedCodeHash']}for d in selected['contracts']};contracts['registry']={'address':reg['proof']['address'],'codeHash':reg['proof']['codeHash']}
  config={'rpcUrl':url,'genesisHash':g['hash'],'contracts':contracts,'controller':next(d['controller']for d in selected['contracts']if d['name']=='AccountOwnerWalletResearch')};(o/'console.json').write_text(json.dumps(config,indent=2))
  # Separate unpaid posting capability; never replaces the preserved custody runtime.
  q=subprocess.run(['node','--max-old-space-size=256',str(src/'build-posting.mjs'),str(o/'posting-build')],capture_output=True,text=True,timeout=90);(o/'posting-build.log').write_text(q.stdout+q.stderr);assert q.returncode==0,'POSTING_BUILD'
  q=subprocess.run(['node','--max-old-space-size=128',str(src/'deploy-posting.mjs'),str(o/'console.json'),str(o/'posting-build/posting-artifact.json'),str(o/'posting-deployment')],capture_output=True,text=True,timeout=90);(o/'posting-deployment.log').write_text(q.stdout+q.stderr);assert q.returncode==0,'POSTING_DEPLOYMENT'
  config=json.loads((o/'posting-deployment/console.json').read_text());(o/'console.json').write_text(json.dumps(config,indent=2))
  if a.smoke:
   q=subprocess.run(['node','--max-old-space-size=256',str(src/'smoke.mjs'),str(o/'console.json')],capture_output=True,text=True,timeout=90);(o/'result.json').write_text(q.stdout);(o/'stderr.txt').write_text(q.stderr);print(q.stdout,q.stderr);assert q.returncode==0
  else:
   web=subprocess.Popen(['node','--max-old-space-size=128',str(src/'server.mjs'),str(o/'console.json')]);print('Local research RPC:',url,flush=True);print('No real funds. Controller address:',config['controller'],flush=True);code=web.wait(); assert code==0, "CONSOLE_EXIT"
finally:
 for process in [web,node]:
  if process and process.poll()is None:process.terminate();process.wait(timeout=15)
 (o/'receipt-polls.json').write_text(json.dumps(receipt_polls,indent=2)+'\n')
 (o/'service.json').write_text(json.dumps({'stopped':all(x is None or x.poll()is not None for x in [web,node])}))

