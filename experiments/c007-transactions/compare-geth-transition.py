"""Bounded second-client transition comparison, not consensus/header validation."""
from pathlib import Path
import json,hashlib,subprocess,shutil,sys,time,os

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
 inputs,blocks_path,evm_path,out=map(Path,sys.argv[1:]);assert not out.exists();out.mkdir(parents=True)
 assert shutil.disk_usage('/mnt/c').free>=2*1024**3,'HOST_DISK_FLOOR'
 available=int(next(x.split()[1]for x in Path('/proc/meminfo').read_text().splitlines()if x.startswith('MemAvailable:')));assert available>=768*1024
 assert hashlib.sha256(evm_path.read_bytes()).hexdigest()=='d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da','PINNED_BINARY'
 captured=load(inputs/'acquired-history.json');genesis=load(inputs/'genesis.json');expected=load(blocks_path)['records'];previous=load(inputs/'transaction-result.json')
 assert captured['chainId']=='0x7a69' and len(expected)==26 and len(captured['blocks'])==27
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
  report={'schema':'caw-geth-transition-comparison/1','blocks':26,'successes':sum(x['status']=='0x1'for x in rows),'reverts':sum(x['status']=='0x0'for x in rows),'finalStateRoot':rows[-1]['stateRoot'],'allIntermediateStateRootsMatched':True,'allTransactionAndReceiptRootsMatched':True,'nativeAccountsMatched':4,'controls':controls,'engine':'Geth evm 1.17.10-stable-1df30b18','comparisonEngine':'EthereumJS 10.1.3','scope':'Shanghai state transitions under supplied synthetic block contexts; not Geth header or consensus validation','originalAnvilChainRepaired':False,'pgpBinarySignatureVerified':False}
  dump(out/'summary.json',report);print(json.dumps(report))
 finally:
  dump(out/'resource-receipt.json',{'peakRss':peak,'seconds':time.monotonic()-start})
  (out/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[{inputs},{blocks_path}] TRANSFORM="Geth t8n comparison" SHA256={hashlib.sha256(p.read_bytes()).hexdigest()} SIZE={p.stat().st_size} PATH={p}'for p in out.rglob('*')if p.is_file())+'\n')
