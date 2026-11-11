from pathlib import Path
import json,subprocess,socket,urllib.request,time,os,shutil,hashlib,hmac,base64
import argparse
import threading,signal,re as regex,datetime
ap=argparse.ArgumentParser(description='Local synthetic Geth-to-Reth peer acquisition; no public finality claim.')
ap.add_argument('--geth',required=True)
ap.add_argument('--reth-command',required=True,help='JSON array containing trusted Reth executable and optional runtime loader arguments')
ap.add_argument('--fixture',required=True,type=Path)
ap.add_argument('--output',required=True,type=Path)
args=ap.parse_args();S=args.fixture.resolve();O=args.output.resolve()
if O.exists(): raise RuntimeError('Output must be a fresh path')
if not O.parent.is_dir(): raise RuntimeError('Output parent must exist')
if shutil.disk_usage(O.parent).free<2*1024**3: raise RuntimeError('Need 2 GiB free')
mem=dict(x.split(':',1)for x in Path('/proc/meminfo').read_text().splitlines())
if int(mem['MemAvailable'].split()[0])<1024**2: raise RuntimeError('Need 1 GiB available memory')
manifest=json.loads((S/'SHA256.json').read_text())
for name,digest in manifest.items():
 if Path(name).name!=name: raise RuntimeError('Unsafe fixture path')
 if hashlib.sha256((S/name).read_bytes()).hexdigest()!=digest: raise RuntimeError('Fixture digest mismatch: '+name)
reth_command=json.loads(Path(args.reth_command).read_text())
if not isinstance(reth_command,list) or not reth_command or not all(isinstance(x,str) for x in reth_command): raise RuntimeError('Invalid trusted command array')
O.mkdir();(O/'genesis.json').write_bytes((S/'genesis.json').read_bytes())
(O/'blocks.rlp').write_bytes(bytes.fromhex((S/'blocks.rlp.hex.txt').read_text().strip()))
# Split complete top-level RLP blocks without changing any block bytes.
raw=(O/'blocks.rlp').read_bytes();pos=0;ends=[]
while pos<len(raw):
 tag=raw[pos]
 if tag<0xc0: raise RuntimeError('Expected RLP list')
 if tag<=0xf7: size=1+tag-0xc0
 else:
  n=tag-0xf7;size=1+n+int.from_bytes(raw[pos+1:pos+1+n],'big')
 if pos+size>len(raw): raise RuntimeError('Truncated block')
 pos+=size;ends.append(pos)
if len(ends)!=28: raise RuntimeError('Expected 28 fixture blocks')
(O/'prefix.rlp').write_bytes(raw[:ends[14]])
for directory,blocks in [('source-data','prefix.rlp'),('replacement-data','blocks.rlp')]:
 for label,tail in [('init',['init',str(O/'genesis.json')]),('import',['import',str(O/blocks)])]:
  q=subprocess.run([args.geth,'--datadir',str(O/directory),'--cache','64']+tail,capture_output=True,timeout=180,env={**os.environ,'GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'})
  (O/(directory+'-'+label+'.log')).write_bytes(q.stdout+q.stderr)
  if q.returncode: raise RuntimeError('Source '+label+' failed')
ports=[]
for _ in range(9):
 with socket.socket()as s:s.bind(('127.0.0.1',0));ports.append(s.getsockname()[1])
secret=os.urandom(32);(O/'jwt.hex').write_text(secret.hex());(O/'jwt.hex').chmod(0o600);processes=[];logs=[];calls=[];start=time.monotonic()
def rpc(port,m,a,auth=False):
 headers={'Content-Type':'application/json'}
 if auth:
  enc=lambda b:base64.urlsafe_b64encode(b).rstrip(b'=');s=enc(b'{"alg":"HS256","typ":"JWT"}')+b'.'+enc(json.dumps({'iat':int(time.time())}).encode());headers['Authorization']='Bearer '+(s+b'.'+enc(hmac.new(secret,s,hashlib.sha256).digest())).decode()
 req=urllib.request.Request(f'http://127.0.0.1:{port}',json.dumps({'jsonrpc':'2.0','id':1,'method':m,'params':a}).encode(),headers);v=json.load(urllib.request.urlopen(req,timeout=5));calls.append({'method':m,'response':v});assert 'error'not in v,v;return v['result']
def launch(cmd,name):
 f=(O/(name+'.log')).open('wb');logs.append(f);p=subprocess.Popen(cmd,stdout=f,stderr=f,start_new_session=True,env={**os.environ,'RAYON_NUM_THREADS':'2','TOKIO_WORKER_THREADS':'2','GOMEMLIMIT':'256MiB','GOMAXPROCS':'2'});processes.append(p);return p
def ready(p,port):
 for _ in range(300):
  assert p.poll()is None,'NODE_EXIT'
  try:assert rpc(port,'eth_chainId',[])=='0x7a69';return
  except OSError:time.sleep(.1)
 raise RuntimeError('START_TIMEOUT')
try:
 geth=launch([args.geth,'--datadir',str(O/'source-data'),'--networkid','31337','--nodiscover','--netrestrict','127.0.0.0/8','--nat','none','--maxpeers','1','--port',str(ports[1]),'--http','--http.addr','127.0.0.1','--http.port',str(ports[0]),'--http.api','eth,net,web3,admin','--authrpc.port',str(ports[2]),'--ipcdisable','--cache','64','--verbosity','4'],'geth');ready(geth,ports[0]);info=rpc(ports[0],'admin_nodeInfo',[]);enode=info['enode'];enode=enode.split('@')[0]+'@127.0.0.1:'+str(ports[1]);target=json.loads((S/'capture.json').read_text())['blocks'][-1]['block'];assert rpc(ports[0],'eth_getBlockByNumber',['0x1c',False]) is None
 replacement_cmd=list(geth.args)
 for flag,value in [('--datadir',str(O/'replacement-data')),('--port',str(ports[7])),('--http.port',str(ports[6])),('--authrpc.port',str(ports[8]))]:replacement_cmd[replacement_cmd.index(flag)+1]=value
 replacement=launch(replacement_cmd,'replacement');ready(replacement,ports[6]);bi=rpc(ports[6],'admin_nodeInfo',[]);benode=bi['enode'].split('@')[0]+'@127.0.0.1:'+str(ports[7]);assert bi['id']!=info['id'];assert rpc(ports[6],'eth_getBlockByNumber',['0x1c',False])['hash']==target['hash']
 assert not (O/'destination-data').exists();cmd=reth_command+['node','--engine.persistence-threshold','14','--engine.memory-block-buffer-target','0','--engine.num-state-masking-blocks','0','--chain',str(O/'genesis.json'),'--datadir',str(O/'destination-data'),'--disable-discovery','--trusted-peers',enode+','+benode,'--trusted-only','--max-outbound-peers','0','--max-inbound-peers','1','--addr','127.0.0.1','--port',str(ports[4]),'--http','--http.addr','127.0.0.1','--http.port',str(ports[3]),'--http.api','eth,net,web3,admin','--authrpc.addr','127.0.0.1','--authrpc.port',str(ports[5]),'--authrpc.jwtsecret',str(O/'jwt.hex'),'--ipcdisable','--db.max-size','512MB','--db.growth-step','16MB','--db.rocksdb-block-cache-size','32MB','--log.file.max-files','0','--log.stdout.filter','info,reth_network=debug,engine::persistence=debug'];reth=launch(['strace','-f','-ttt','-yy','-e','trace=pwrite64,pwritev,write,writev,fsync,fdatasync,msync','-e','inject=pwrite64:delay_exit=100ms','-o',str(O/'writes.trace')]+cmd,'reth');ready(reth,ports[3]);ri=rpc(ports[3],'admin_nodeInfo',[]); re=ri['enode'].split('@')[0]+'@127.0.0.1:'+str(ports[4]); assert rpc(ports[0],'admin_addPeer',[re]);initial=rpc(ports[3],'eth_blockNumber',[]);assert initial=='0x0';assert rpc(ports[3],'eth_getBlockByNumber',['0x1c',False])is None
 prefix=json.loads((S/'capture.json').read_text())['blocks'][15]['block']
 pf={'headBlockHash':prefix['hash'],'safeBlockHash':'0x'+'00'*32,'finalizedBlockHash':'0x'+'00'*32}
 # Independent watcher: require persistence-start plus a destination file write, not only a head response.
 hit={};halt=threading.Event()
 def watch_write():
  try:
   while not halt.is_set():
    log=regex.sub(r'\x1b\[[0-9;]*m','',(O/'reth.log').read_text())
    started=[l for l in log.splitlines() if 'Saving range of blocks' in l and prefix['hash'] in l]
    if started:
     stamp=started[-1].split()[0];epoch=datetime.datetime.fromisoformat(stamp.replace('Z','+00:00')).timestamp()
     trace=(O/'writes.trace').read_text(errors='replace')
     matches=[]
     for line in trace.splitlines():
      m=regex.search(r'\b(\d{10}\.\d+)\s+(pwrite64|pwritev|write|writev)\(',line)
      if m and float(m.group(1))>=epoch and '/destination-data/static_files/static_file_headers_' in line:matches.append(line)
     if matches:
      os.killpg(reth.pid,signal.SIGSTOP)
      frozen=regex.sub(r'\x1b\[[0-9;]*m','',(O/'reth.log').read_text())
      completed=[l for l in frozen.splitlines() if 'Saved range of blocks' in l and prefix['hash'] in l]
      hit.update({'startMarker':started[-1],'writeRecord':matches[0],'targetFileFamily':'headers','completionMarkersBeforeKill':completed,'traceDelay':'pwrite64 exit delayed 100ms','claim':'write observed during persistence operation; no assertion of physical disk commit or kill inside kernel syscall'})
      (O/'write-window.json').write_text(json.dumps(hit,indent=2))
      os.killpg(reth.pid,signal.SIGKILL)
      return
    time.sleep(.001)
  except Exception as e:hit['watcherError']=repr(e)
 watcher=threading.Thread(target=watch_write,daemon=True);watcher.start()
 try:
  for _ in range(100):
   if hit or reth.poll()is not None:break
   try:rpc(ports[5],'engine_forkchoiceUpdatedV2',[pf,None],True)
   except (OSError,ValueError):pass
   time.sleep(.05)
  watcher.join(timeout=10)
 finally:halt.set();watcher.join(timeout=2)
 assert hit and 'watcherError' not in hit, 'WRITE_WINDOW_NOT_OBSERVED'
 reth.wait(timeout=20)
 assert reth.returncode==-9 and hit['completionMarkersBeforeKill']==[], 'MISSED_ACTIVE_PERSISTENCE_WINDOW'
 geth.terminate();geth.wait(timeout=20)
 old_identity=ri['enode'].split('@')[0]
 reth=launch(cmd,'reth-restarted');ready(reth,ports[3])
 assert rpc(ports[3],'admin_nodeInfo',[])['enode'].split('@')[0]==old_identity
 assert rpc(ports[3],'net_peerCount',[])=='0x0'
 recovered_head=int(rpc(ports[3],'eth_blockNumber',[]),16)
 assert 0<=recovered_head<=15
 for saved in json.loads((S/'capture.json').read_text())['blocks'][:recovered_head+1]:
  got=rpc(ports[3],'eth_getBlockByNumber',[saved['block']['number'],False])
  assert got['hash']==saved['block']['hash'] and got['stateRoot']==saved['block']['stateRoot']
 assert rpc(ports[3],'eth_getBlockByNumber',['0x1c',False]) is None
 fork={'headBlockHash':target['hash'],'safeBlockHash':'0x'+'00'*32,'finalizedBlockHash':'0x'+'00'*32};statuses=[]
 assert rpc(ports[5],'engine_forkchoiceUpdatedV2',[fork,None],True)['payloadStatus']['status']=='SYNCING'
 (O/'restart.json').write_text(json.dumps({'killSignal':9,'headAfterRestart':recovered_head,'matchingRetainedHeaders':recovered_head+1,'identityPreserved':True,'peersBeforeReplacement':0,'targetAbsent':True}))
 assert rpc(ports[6],'admin_addPeer',[re])
 for _ in range(40):
  assert geth.poll()is not None and replacement.poll()is None and reth.poll()is None;assert time.monotonic()-start<150
  v=rpc(ports[5],'engine_forkchoiceUpdatedV2',[fork,None],True);statuses.append(v['payloadStatus']['status']);h=rpc(ports[3],'eth_getBlockByNumber',['0x1c',False])
  if h and h['hash']==target['hash'] and v['payloadStatus']['status']=='VALID':break
  time.sleep(1)
 else:raise RuntimeError('SYNC_TIMEOUT')
 c=json.loads((S/'capture.json').read_text());matched=0
 for b in c['blocks']:
  got=rpc(ports[3],'eth_getBlockByNumber',[b['block']['number'],False]);assert got['hash']==b['block']['hash'] and got['stateRoot']==b['block']['stateRoot'];matched+=1
 source=json.loads((S/'proof-request.json').read_text());proof=rpc(ports[3],'eth_getProof',[source['proof']['address'],[x['key']for x in source['proof']['storageProof']],'0x1c']);(O/'evidence.json').write_text(json.dumps({'header':h,'proof':proof},indent=2));(O/'result.json').write_text(json.dumps({'sourceClient':'Geth','replacementPeerDifferentIdentity':True,'destinationRestarted':True,'persistenceTargetBlock':15,'prefixHeadObservedBeforeKill':False,'originalSourceStillStopped':geth.poll()is not None,'destinationClient':'Reth2.10.1','initialBlock':initial,'matchingHeaders':matched,'peerCount':rpc(ports[3],'net_peerCount',[]),'forkchoiceStatuses':statuses,'destinationFileImportUsed':False,'sourceInitializedFromPublicRlp':True,'targetHashExternallySelected':True,'consensusFinalityVerified':False},indent=2));print('P2P sync success',matched)
finally:
 for p in reversed(processes):
  if p.poll()is None:
   try:os.killpg(p.pid,signal.SIGCONT)
   except ProcessLookupError:pass
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=20)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=10)
 for f in logs:f.close()
 (O/'requests.json').write_text(json.dumps(calls));(O/'service.json').write_text(json.dumps({'allStopped':all(p.poll()is not None for p in processes),'seconds':time.monotonic()-start}))




files=[p for p in O.iterdir()if p.is_file()and p.name not in ['jwt.hex','PROVENANCE.txt']]
(O/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[fixture-manifest] TRANSFORM="public fixture source import and fresh destination peer sync" SHA256={hashlib.sha256(p.read_bytes()).hexdigest()} SIZE={p.stat().st_size} PATH={p.name}'for p in files)+'\n')
