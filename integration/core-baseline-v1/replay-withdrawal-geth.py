"""Replay the selected synthetic fixture. No network or consensus validation."""
from pathlib import Path
import argparse,copy,hashlib,json,os,platform,shutil,subprocess

def load(path):
 with path.open('rb') as f:data=f.read(2*1024**2+1)
 if len(data)>2*1024**2:raise ValueError('INPUT_SIZE')
 return json.loads(data),data

def dump(path,value):path.write_text(json.dumps(value,indent=2)+'\n')
def prefix(n,short,long):
 if n<56:return bytes([short+n])
 b=n.to_bytes((n.bit_length()+7)//8,'big');return bytes([long+len(b)])+b
def tx_list(raw):
 b=bytes.fromhex(raw.removeprefix('0x'))
 if b[0]!=2:raise ValueError('TYPE_2_ONLY')
 item=prefix(len(b),0x80,0xb7)+b
 return '0x'+(prefix(len(item),0xc0,0xf7)+item).hex()
def compare(got,want,body):
 assert not got.get('rejected'),'REJECTED'
 assert got['stateRoot']==want['stateRoot'],'STATE_ROOT'
 assert int(got['gasUsed'],0)==int(want['gasUsed']),'GAS'
 assert len(got['receipts'])==1,'RECEIPT_COUNT'
 receipt=got['receipts'][0]
 assert int(receipt['status'],0)==want['status'],'STATUS'
 assert [{k:x[k]for k in ['address','topics','data']}for x in (receipt['logs']or[])]==want['logs'],'LOGS'
 assert body==tx_list(want['rawTransaction']),'SIGNED_BYTES'

def main():
 if not __debug__:raise RuntimeError('OPTIMIZED_PYTHON_UNSUPPORTED')
 p=argparse.ArgumentParser();p.add_argument('fixture',type=Path);p.add_argument('evm',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
 if platform.system()!='Linux':raise RuntimeError('LINUX_REQUIRED')
 a.output=a.output.resolve();a.evm=a.evm.resolve()
 if a.output.exists():raise FileExistsError(a.output)
 parent=a.output.parent
 while not parent.exists():parent=parent.parent
 targets=[parent]
 if any(s in platform.release().lower()for s in ['microsoft','wsl']):
  if not os.path.ismount('/mnt/c'):raise RuntimeError('WSL_HOST_DRIVE_UNAVAILABLE')
  targets.append(Path('/mnt/c'))
 for path in targets:
  if shutil.disk_usage(path).free<2*1024**3:raise RuntimeError('DISK_FLOOR')
 mem=dict(x.split(':',1)for x in Path('/proc/meminfo').read_text().splitlines())
 if int(mem['MemAvailable'].split()[0])*1024<1024**3:raise RuntimeError('MEMORY_FLOOR')
 if hashlib.sha256(a.evm.read_bytes()).hexdigest()!='d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da':raise ValueError('BINARY_PIN')
 fixture,data=load(a.fixture)
 # This is a deliberately frozen experiment, not a general chain reader.
 if hashlib.sha256(data).hexdigest()!=FIXTURE_SHA256:raise ValueError('FIXTURE_PIN')
 rows=fixture['operations'];assert len(rows)==61
 a.output.mkdir(parents=True);dump(a.output/'initial.json',fixture['alloc'])
 def execute(name,pre,want,chain=31337):
  lane=a.output/name;lane.mkdir();dump(lane/'env.json',fixture['env']);dump(lane/'txs.rlp',tx_list(want['rawTransaction']))
  cmd=[str(a.evm),'t8n','--state.fork=Shanghai','--state.chainid='+str(chain),'--state.reward=-1','--input.alloc='+str(pre),'--input.env='+str(lane/'env.json'),'--input.txs='+str(lane/'txs.rlp'),'--output.basedir='+str(lane),'--output.alloc=alloc.json','--output.result=result.json','--output.body=body.rlp']
  with (lane/'stdout.log').open('wb')as out,(lane/'stderr.log').open('wb')as err:
   run=subprocess.run(cmd,stdout=out,stderr=err,timeout=30,env={**os.environ,'GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'})
  assert run.returncode==0,'ENGINE_EXIT'
  return lane,load(lane/'result.json')[0],load(lane/'body.rlp')[0]
 try:
  pre=a.output/'initial.json'
  for i,want in enumerate(rows):
   lane,got,body=execute(f'tx-{i:02}',pre,want);compare(got,want,body);pre=lane/'alloc.json'
  controls=[]
  for field,value in [('stateRoot','0x'+'11'*32),('gasUsed','0'),('status',1-rows[-1]['status']),('logs',[{'address':'0x'+'11'*20,'topics':[],'data':'0x'}])]:
   bad=copy.deepcopy(rows[-1]);bad[field]=value
   try:compare(got,bad,body)
   except AssertionError:controls.append(field)
   else:raise AssertionError('MUTATION_ACCEPTED')
  try:compare(got,rows[-1],'0xc0')
  except AssertionError:controls.append('signed_bytes')
  else:raise AssertionError('BODY_MUTATION_ACCEPTED')
  for name,pre,chain in [('wrong_chain',a.output/'initial.json',31338),('spent_nonce',a.output/'tx-00/alloc.json',31337)]:
   lane,bad,_=execute(name,pre,rows[0],chain)
   assert len(bad.get('rejected',[]))==1 and not bad['receipts'],name
   controls.append(name)
  report={'status':'FROZEN_WITHDRAWAL_GETH_COMPARISON_PASS','operations':61,'controls':controls,'finalStateRoot':got['stateRoot'],'fixtureSha256':FIXTURE_SHA256,'limits':'Comparison against retained EthereumJS states under repeated synthetic contexts; not consensus, independent audit or production acceptance.'}
  dump(a.output/'summary.json',report);print(json.dumps(report))
 finally:
  (a.output/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[sha256:{FIXTURE_SHA256}] TRANSFORM="bounded Geth replay" SHA256={hashlib.sha256(f.read_bytes()).hexdigest()} SIZE={f.stat().st_size} PATH={f}'for f in a.output.rglob('*')if f.is_file())+'\n')

FIXTURE_SHA256='4e199d2561d354a2f01718901ff18d774ede034d8d000c6957e66f2a4a654f9c'
if __name__=='__main__':main()
