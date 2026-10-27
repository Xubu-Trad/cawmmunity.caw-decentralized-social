"""Windows-only, sequential guarded worker and result inspection. No network access required."""
from pathlib import Path
import hashlib,json,os,runpy,shutil,subprocess,sys,time,secrets

def main():
    assert os.name=='nt','WINDOWS_GUARD_REQUIRED'
    assert len(sys.argv)==5,'Supply repository, pinned Node executable, input and new evidence directory'
    repo,node,input_path,out=map(lambda s:Path(s).resolve(),sys.argv[1:])
    engine=Path(__file__).resolve().parent
    assert not out.exists(),'OUTPUT_EXISTS'
    out.mkdir(mode=0o700)
    source='81c71fc5cbeda8eebe8207a3a4a83320a796df5946d2d6017c8f06114a65ec0f'
    executor='73f50a25dced2047c87c30a4337bcdd6a9730c1352c2164ee998ae36df55fc50'
    sha=lambda b:hashlib.sha256(b).hexdigest()
    guard_path=repo/'experiments/paid-action/paid_node.py'
    assert sha(guard_path.read_bytes())=='ecd540dfd3414b28cbb9d085254cc2be3de42ea7f13033afb40b72c6884a4160','GUARD_PIN'
    Guard=runpy.run_path(str(guard_path))['_WindowsGuard']
    with input_path.open('rb') as f:data=f.read(1048577)
    assert len(data)<=1048576,'INPUT_LIMIT'
    (out/'input.json').write_bytes(data)
    manifests={}
    for name,digest in [('source-manifest.json',source),('executor-selection.json',executor)]:
        with (engine/name).open('rb') as f:b=f.read(131073)
        assert len(b)<=131072 and sha(b)==digest,'MANIFEST_IDENTITY'
        manifests[name]=json.loads(b)
    expected={'inputSha256':sha(data),'sourceManifestSha256':source,'executorManifestSha256':executor,'sourceFiles':21,'executorFiles':2}
    for key,path in [('engineLockSha256','pnpm-lock.yaml'),('adapterSourceSha256','witness-adapter.mjs'),('outcomeSourceSha256','replay-outcome.mjs'),('bindingSourceSha256','bound-replay.mjs')]:
        expected[key]=next(x['sha256'] for x in manifests['source-manifest.json']['files'] if x['root']=='engine' and x['path']==path)
    request=secrets.token_hex(16)
    env={k:os.environ[k] for k in ('SystemRoot','WINDIR') if k in os.environ}
    env.update(TEMP=str(out),TMP=str(out),PATH=str(node.parent),CI='true')
    def child(name,args):
        guard=Guard();process=None;lock=None;start=time.monotonic();peak=0
        try:
            assert guard.available()>=768*1024**2,'STARTUP_MEMORY_FLOOR'
            assert shutil.disk_usage(out).free>=2*1024**3,'STARTUP_DISK_FLOOR'
            lock=guard.open_binary(node);assert hashlib.file_digest(lock,'sha256').hexdigest()=='5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5','NODE_PIN'
            stdout=out/(name+'-stdout.txt');stderr=out/(name+'-stderr.txt')
            with stdout.open('xb') as o,stderr.open('xb') as err:
                process=subprocess.Popen([str(node),'--max-old-space-size=256',*args],cwd=engine,env=env,stdin=subprocess.DEVNULL,stdout=o,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW,close_fds=True)
                guard.attach(process)
                while process.poll() is None:
                    peak=max(peak,guard.memory(process));assert time.monotonic()-start<300,'DEADLINE'
                    assert stdout.stat().st_size+stderr.stat().st_size<10*1024**2,'OUTPUT_LIMIT'
                    time.sleep(.05)
            receipt={'exitCode':process.returncode,'signal':None if process.returncode==0 else 'not-success','seconds':round(time.monotonic()-start,3),'observedPeakBytes':peak}
            (out/(name+'-receipt.json')).write_text(json.dumps(receipt)+'\n')
            assert process.returncode==0,'CHILD_FAILED'
            return {'exitCode':process.returncode,'signal':None}
        finally:
            guard.close()
            if process and process.poll() is None:process.kill();process.wait(timeout=5)
            if lock:lock.close()
    completion=child('worker',['selected-executor-cli.mjs',str(repo),str(out/'input.json'),source,executor,str(out/'result.json'),request])
    def bounded(path,n):
        with path.open('rb') as f:b=f.read(n+1)
        assert len(b)<=n,'RECORD_LIMIT'
        return b.decode('utf-8',errors='strict')
    packet={'text':bounded(out/'result.json',16384),'stdout':bounded(out/'worker-stdout.txt',65536),'completion':completion,'requestId':request,'expected':expected}
    (out/'inspection-input.json').write_text(json.dumps(packet),encoding='utf-8')
    child('inspector',['inspect-owned-output.mjs',str(repo),str(out/'inspection-input.json'),str(out/'inspection.json')])
    report=json.loads(bounded(out/'inspection.json',16384))
    assert report['recordMatchesSelection'] is True and report['executionAuthenticated'] is False
    print(json.dumps({'completed':True,'kind':report['kind'],'resultSha256':sha(packet['text'].encode()),'requestId':request,'executionAuthenticated':False,'productionAccepted':False}))

if __name__=='__main__':main()
