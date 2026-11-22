from pathlib import Path
import os,sys,subprocess as s,shutil,socket,urllib.request,json,time,hashlib
root=Path(__file__).resolve().parent
src=root/'src'
script=src/'integration/local-console'
node=Path(shutil.which('node'))
geth=Path(os.environ['GETH_BIN']).resolve()
fixtures=src/'evidence'
load=lambda f:json.loads(f.read_text())
dump=lambda f,x:f.write_text(json.dumps(x,indent=2)+'\n')
assert not sys.flags.optimize
assert shutil.disk_usage(root).free>=2*1024**3,'DISK_GUARD'
if Path('/mnt/c').exists():assert shutil.disk_usage('/mnt/c').free>=2*1024**3,'HOST_DISK_GUARD'
mem=int(next(l for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')).split()[1])
assert mem>=1024**2,'MEMORY_GUARD'
assert hashlib.sha256(geth.read_bytes()).hexdigest()=='45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea'
assert s.check_output([node,'-v'],text=True).strip()=='v20.20.2'
mode=sys.argv[1]
out=root/'private'/mode;out.mkdir(parents=True)
dump(out/'guards.json',dict(memoryAvailableKiB=mem,diskAvailable=shutil.disk_usage(root).free))
def run(name,cmd,timeout=45):
 with (out/(name+'.log')).open('wb') as f:
  x=s.run(cmd,stdout=f,stderr=s.STDOUT,timeout=timeout)
 (out/(name+'.exit')).write_text(str(x.returncode)+'\n')
 assert x.returncode==0,name
run('build',[node,script/'build-posting.mjs',out/'build'])
header=fixtures/'wallet-headers-20261112'
genesis=header/'genesis.json';capture=load(header/'capture.json')['blocks']
selected=load(fixtures/'wallet-state-20261112/selection.json');reg=load(header/'evidence.json')['proof']
run('init',[geth,'--datadir',out/'data','init',genesis])
with socket.socket() as so:so.bind(('127.0.0.1',0));port=so.getsockname()[1]
url=f'http://127.0.0.1:{port}'
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def rpc(method,args):
 q=urllib.request.Request(url,json.dumps(dict(jsonrpc='2.0',id=1,method=method,params=args)).encode(),{'Content-Type':'application/json'})
 with opener.open(q,timeout=3) as f:x=json.load(f)
 if 'error' in x:raise RuntimeError(x['error'])
 return x['result']
cmd=[geth,'--dev','--dev.period','3','--datadir',out/'data','--http','--http.addr','127.0.0.1','--http.port',str(port),'--http.api','eth,net,web3','--maxpeers','0','--nodiscover','--netrestrict','127.0.0.0/8','--cache','64','--ipcdisable','--port','0','--authrpc.port','0']
dump(out/'node-command.json',list(map(str,cmd)))
with (out/'node.log').open('wb') as f:
 proc=s.Popen(cmd,stdout=f,stderr=s.STDOUT,env={**os.environ,'GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'})
try:
 for _ in range(80):
  assert proc.poll() is None,'GETH_EXIT'
  try:g=rpc('eth_getBlockByNumber',['0x0',False]);break
  except OSError:time.sleep(.1)
 else:raise RuntimeError('START_TIMEOUT')
 assert rpc('eth_chainId',[])=='0x7a69'
 assert g['hash']==capture[0]['block']['hash'],'GENESIS_MISMATCH'
 names={'AccountOwnerWalletResearch':'wallet','FundedAdmissionResearch':'custody','AdmissionTokenFixture':'token'}
 contracts={names[x['name']]:dict(address=x['address'],codeHash=x['expectedCodeHash']) for x in selected['contracts']}
 contracts['registry']=dict(address=reg['address'],codeHash=reg['codeHash'])
 config=dict(rpcUrl=url,genesisHash=g['hash'],contracts=contracts,controller=next(x['controller'] for x in selected['contracts'] if 'controller' in x))
 setup=[]
 for b in capture[1:11]:
  raw,=b['rawTransactions']; tx=rpc('eth_sendRawTransaction',[raw]);assert tx==b['receipts'][0]['transactionHash']
  for _ in range(120):
   try:r=rpc('eth_getTransactionReceipt',[tx])
   except RuntimeError as e:
    if 'transaction indexing is in progress' not in str(e):raise
    r=None
   if r:break
   time.sleep(.1)
  assert r and r['status']=='0x1'
  setup.append(dict(raw=raw,receipt=r))
  dump(out/'setup.json',setup)
 dump(out/'config.json',config)
 run('deploy',[node,script/'deploy-posting.mjs',out/'config.json',out/'build/posting-artifact.json',out/'deploy'])
 env=os.environ.copy()
 env.update(NO_PROXY='127.0.0.1',no_proxy='127.0.0.1',PUBLIC_FIXTURE_SIGNER='0x'+'3'.zfill(64))
 with (out/'lane.log').open('wb') as f:
  x=s.run([node,root/'lane.mjs',script,out,mode],stdout=f,stderr=s.STDOUT,env=env,timeout=40)
 (out/'lane.exit').write_text(str(x.returncode)+'\n')
 assert x.returncode==0,'LANE_FAILED'
 # Capture all preceding execution, including empty blocks; no state inferred from sparse proofs.
 end=int(load(out/'genuine-evidence.json')['bundle']['blocks'][0]['header']['number'],16)
 blocks=[]
 for n in range(end+1):
  b=rpc('eth_getBlockByNumber',[hex(n),False]);raws=[];receipts=[]
  for tx in b['transactions']:
   raws.append(rpc('eth_getRawTransactionByHash',[tx]));receipts.append(rpc('eth_getTransactionReceipt',[tx]))
  blocks.append(dict(block=b,rawTransactions=raws,receipts=receipts))
 dump(out/'capture.json',dict(blocks=blocks))
 shutil.copyfile(genesis,out/'genesis.json')
finally:
 if proc.poll() is None:
  proc.terminate()
  try:proc.wait(timeout=15)
  except s.TimeoutExpired:proc.kill();proc.wait(timeout=5)
 dump(out/'shutdown.json',dict(stopped=proc.poll() is not None,exit=proc.returncode))
 # Retain the isolated node database and failed evidence.
