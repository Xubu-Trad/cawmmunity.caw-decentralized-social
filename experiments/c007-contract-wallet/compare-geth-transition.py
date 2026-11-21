"""Bounded second-client transition comparison, not consensus/header validation."""
from pathlib import Path
import json,hashlib,subprocess,shutil,sys,time,os,platform

def resource_preflight(output):
 # Check the actual destination filesystem on every Linux host. WSL must
 # additionally retain the existing Windows host-drive guard; no fallback.
 if platform.system()!='Linux':raise RuntimeError('LINUX_REQUIRED')
 destination=output.resolve()
 while not destination.exists():destination=destination.parent
 if not destination.is_dir():raise RuntimeError('OUTPUT_PARENT_NOT_DIRECTORY')
 targets=[destination]
 wsl=any(s in platform.release().lower()for s in ['microsoft','wsl'])
 if wsl:
  host=Path('/mnt/c')
  if not os.path.ismount(host):raise RuntimeError('WSL_HOST_DRIVE_UNAVAILABLE')
  targets.append(host)
 disks=[]
 for target in targets:
  free=shutil.disk_usage(target).free
  if free<2*1024**3:raise RuntimeError('DISK_FLOOR: '+str(target))
  disks.append({'path':str(target),'freeBytes':free})
 lines=Path('/proc/meminfo').read_text().splitlines()
 entries=[s.split()for s in lines if s.startswith('MemAvailable:')]
 if len(entries)!=1 or len(entries[0])!=3 or entries[0][2]!='kB':raise RuntimeError('MEMORY_OBSERVATION_UNAVAILABLE')
 available=int(entries[0][1])*1024
 if available<768*1024**2:raise RuntimeError('MEMORY_FLOOR')
 return {'platform':'WSL'if wsl else'Linux','disks':disks,'availableMemoryBytes':available}

# This revision reproduces the frozen combined-guard fixture, not arbitrary provider data.
INPUT_DIGESTS={'acquired-history.json': '5394383c6a762cd3000f92d4e11ee5f2a8c286e31aec92a02ffd3b4cf600f530', 'genesis.json': '7a113bfbcce39f22659ab8021ed687553b51924930206c1f7e15dd5bdd7a2a11', 'transaction-result.json': '3e5303829549690c2b0d58dbcea72f789007c82cb336ec12e8a93c4cfa3edc04', 'blocks.json': '802e17206fb0f38c40de4c8926aca70165b6979f7cb64b0fabc6c36e02e75526'}

def load_selected(p,digest):
 # Hash and parse the same bounded read; never reopen after verification.
 with p.open('rb')as f:data=f.read(8*1024**2+1)
 if len(data)>8*1024**2:raise ValueError('SELECTED_INPUT_SIZE')
 if hashlib.sha256(data).hexdigest()!=digest:raise ValueError('SELECTED_INPUT_DIGEST')
 return json.loads(data)
def selected_inputs(inputs,blocks_path):
 return tuple(load_selected(inputs/n,INPUT_DIGESTS[n])for n in ['acquired-history.json','genesis.json','transaction-result.json'])+(load_selected(blocks_path,INPUT_DIGESTS['blocks.json']),)

def load(p):
 assert p.stat().st_size<8*1024**2
 return json.loads(p.read_text())
def dump(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def tx_list(raw):
 b=bytes.fromhex(raw.removeprefix('0x'));assert b[0]>=0xc0,'legacy-only scope'
 n=len(b);length=n.to_bytes((n.bit_length()+7)//8,'big')
 return '0x'+((bytes([0xc0+n])if n<56 else bytes([0xf7+len(length)])+length)+b).hex()
def compare(result,expected):
 assert not result.get('rejected'),'unexpected rejected transaction'
 for key,want in [('stateRoot',expected['stateRoot']),('txRoot',expected['transactionsRoot']),('receiptsRoot',expected['receiptsRoot'])]:assert result[key]==want,key
 assert int(result['gasUsed'],0)==int(expected['gasUsed']),'gasUsed'

if __name__=='__main__':
 if not __debug__:raise RuntimeError('OPTIMIZED_PYTHON_UNSUPPORTED: assertions must remain enabled')
 inputs,blocks_path,evm_path,out=(Path(x).resolve()for x in sys.argv[1:]);assert not out.exists()
 startup=resource_preflight(out);out.mkdir(parents=True)
 assert hashlib.sha256(evm_path.read_bytes()).hexdigest()=='d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da','PINNED_BINARY'
 captured,genesis,previous,block_data=selected_inputs(inputs,blocks_path);expected=block_data['records']
 assert captured['chainId']=='0x7a69' and len(expected)==29 and len(captured['blocks'])==30
 alloc={a:{'balance':v['balance'],'nonce':'0x0'}for a,v in genesis['alloc'].items()};assert len(alloc)==3 and all(list(v)==['balance']for v in genesis['alloc'].values())
 initial=out/'genesis-alloc.json';dump(initial,alloc);prestate=initial;rows=[];peak=0;start=time.monotonic()
 def execute(name,pre,env,raw,chain=31337):
  global peak
  lane=out/name;lane.mkdir();dump(lane/'env.json',env);dump(lane/'txs.rlp',tx_list(raw))
  command=[str(evm_path),'t8n','--state.fork=Shanghai','--state.chainid='+str(chain),'--state.reward=-1','--input.alloc='+str(pre),'--input.env='+str(lane/'env.json'),'--input.txs='+str(lane/'txs.rlp'),'--output.basedir='+str(lane),'--output.alloc=alloc.json','--output.result=result.json','--output.body=body.rlp']
  dump(lane/'command.json',command)
  with(lane/'stdout.log').open('wb')as stdout,(lane/'stderr.log').open('wb')as stderr:
   p=subprocess.Popen(command,stdout=stdout,stderr=stderr,env={**os.environ,'GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'},start_new_session=True)
   try:
    while p.poll()is None:
     try:rss=int(next(x.split()[1]for x in Path(f'/proc/{p.pid}/status').read_text().splitlines()if x.startswith('VmRSS:')))*1024
     except(FileNotFoundError,StopIteration):rss=0
     peak=max(peak,rss);assert rss<512*1024**2;assert time.monotonic()-start<180;time.sleep(.02)
   finally:
    if p.poll()is None:os.killpg(p.pid,15);p.wait(timeout=10)
  assert p.returncode==0,(name,p.returncode,(lane/'stderr.log').read_text())
  return lane,load(lane/'result.json')
 try:
  for i,(source,want)in enumerate(zip(captured['blocks'][1:],expected),1):
   h=source['block'];assert len(source['rawTransactions'])==1;assert h['withdrawals']==[]
   env={'currentCoinbase':h['miner'],'currentGasLimit':h['gasLimit'],'currentNumber':hex(i),'currentTimestamp':hex(int(want['timestamp'])),'currentRandom':h['mixHash'],'currentBaseFee':hex(int(want['baseFeePerGas'])),'withdrawals':[],'blockHashes':{str(j+1):x['hash']for j,x in enumerate(expected[:i-1])}}
   lane,r=execute(f'block-{i:02}',prestate,env,source['rawTransactions'][0]);compare(r,want)
   assert load(lane/'body.rlp')==tx_list(source['rawTransactions'][0]),'SIGNED_BYTES_CHANGED'
   assert r['logsBloom']==h['logsBloom'];assert len(r['receipts'])==1
   assert r['receipts'][0]['status']==source['receipts'][0]['status']
   rows.append({'number':i,'stateRoot':r['stateRoot'],'gasUsed':r['gasUsed'],'status':r['receipts'][0]['status']});prestate=lane/'alloc.json'
  final=load(prestate)
  for account in previous['nativeAccounts']:
   a=final.get(account['address'],final.get(account['address'][2:]));assert a is not None
   assert int(a['balance'],0)==int(account['balance']);assert int(a.get('nonce','0x0'),0)==int(account['nonce'],0)
  controls=[]
  for field in ['stateRoot','transactionsRoot','receiptsRoot','gasUsed']:
   wrong={**expected[-1],field:'0' if field=='gasUsed' else '0x'+'11'*32}
   try:compare(r,wrong)
   except AssertionError:controls.append('comparison_'+field)
   else:raise AssertionError('comparison accepted corruption')
  first=captured['blocks'][1];env=load(out/'block-01/env.json')
  for name,pre,chain in [('wrong_chain',initial,31338),('spent_nonce',out/'block-01/alloc.json',31337)]:
   lane,bad=execute(name,pre,env,first['rawTransactions'][0],chain);assert len(bad.get('rejected',[]))==1 and not bad['receipts'];controls.append(name)
  report={'schema':'caw-geth-transition-comparison/1','blocks':29,'successes':sum(x['status']=='0x1'for x in rows),'reverts':sum(x['status']=='0x0'for x in rows),'finalStateRoot':rows[-1]['stateRoot'],'allIntermediateStateRootsMatched':True,'allTransactionAndReceiptRootsMatched':True,'nativeAccountsMatched':4,'controls':controls,'engine':'Geth evm 1.17.10-stable-1df30b18','comparisonEngine':'EthereumJS 10.1.3','scope':'Shanghai state transitions under supplied synthetic block contexts; not Geth header or consensus validation','originalAnvilChainRepaired':False,'binarySignatureVerifiedByThisRunner':False,'inputSelection':'frozen fixture digests; not chain authentication','inputDigests':INPUT_DIGESTS}
  dump(out/'summary.json',report);print(json.dumps(report))
 finally:
  dump(out/'resource-receipt.json',{'startup':startup,'peakRss':peak,'seconds':time.monotonic()-start})
  (out/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[{inputs},{blocks_path}] TRANSFORM="Geth t8n comparison" SHA256={hashlib.sha256(p.read_bytes()).hexdigest()} SIZE={p.stat().st_size} PATH={p}'for p in out.rglob('*')if p.is_file())+'\n')
