from pathlib import Path
import argparse,subprocess,urllib.request,json,hashlib,tarfile,re
p=argparse.ArgumentParser();p.add_argument('--geth-dir',type=Path,required=True);p.add_argument('--reth-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();O=a.output;O.mkdir(exist_ok=False);home=O/'gpg-home';home.mkdir(mode=0o700)
def sha(path):
 h=hashlib.sha256()
 with path.open('rb')as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def get(url,path):path.write_bytes(urllib.request.urlopen(url,timeout=60).read())
specs=[('geth',a.geth_dir/'alltools.tar.gz',a.geth_dir/'geth','https://gethstore.blob.core.windows.net/builds/geth-alltools-linux-amd64-1.17.10-1df30b18.tar.gz','FDE5A1A044FA13D2F7ADA019A61A13569BA28146','https://geth.ethereum.org/downloads'),('reth',a.reth_dir/'client.tar.gz',a.reth_dir/'reth','https://github.com/paradigmxyz/reth/releases/download/v2.10.1/reth-v2.10.1-x86_64-unknown-linux-gnu.tar.gz','50FB7CC55B2E8AFA59FE03B7AA5ED56A7FBF253E','https://reth.rs/installation/binaries/')]
results=[]
for name,archive,binary,url,fpr,docs in specs:
 key=O/(name+'-key.asc');sig=O/(name+'.asc');ring=O/(name+'.gpg');get('https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x'+fpr,key);get(url+'.asc',sig)
 q=subprocess.run(['gpg','--homedir',str(home),'--batch','--with-colons','--show-keys',str(key)],capture_output=True,timeout=30);assert q.returncode==0
 fingerprints=[x.split(':')[9]for x in q.stdout.decode().splitlines()if x.startswith('fpr:')];assert fingerprints[0]==fpr,fingerprints
 subprocess.run(['gpg','--homedir',str(home),'--batch','--yes','--dearmor','--output',str(ring),str(key)],check=True,timeout=30)
 q=subprocess.run(['gpgv','--homedir',str(home),'--status-fd','1','--keyring',str(ring),str(sig),str(archive)],capture_output=True,timeout=40);(O/(name+'-verify.log')).write_bytes(q.stdout+q.stderr);assert q.returncode==0,q.stderr
 valid=[x for x in q.stdout.decode().splitlines()if x.startswith('[GNUPG:] VALIDSIG ')];assert any(fpr in x.split()for x in valid)
 with tarfile.open(archive)as tar:
  matches=[x for x in tar if x.isfile()and Path(x.name).name==name];assert len(matches)==1
  data=tar.extractfile(matches[0]).read();assert hashlib.sha256(data).hexdigest()==sha(binary)
 other=specs[1 if name=='geth' else 0][1]
 q=subprocess.run(['gpgv','--homedir',str(home),'--keyring',str(ring),str(sig),str(other)],capture_output=True,timeout=40);(O/(name+'-wrong-archive.log')).write_bytes(q.stdout+q.stderr);assert q.returncode!=0
 results.append({'client':name,'archiveSource':url,'keyFingerprintSource':docs,'primaryFingerprint':fpr,'archiveSha256':sha(archive),'binarySha256':sha(binary),'binaryMatchesSignedArchive':True,'signatureVerified':True,'wrongArchiveRejected':True,'validSignatureStatus':valid})
result={'clients':results,'scope':'publisher-key archive signatures and installed-file identity; not source-to-binary reproducible builds','limitations':['Publisher fingerprints were obtained from official HTTPS documentation; this is a trust assumption.','No client source compilation, security audit or freshness/patch approval is established.','No independent operator or public-chain verification is established.']}
(O/'result.json').write_text(json.dumps(result,indent=2)+'\n');(O/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[official-release-archives,publisher-key-docs] TRANSFORM="isolated-keyring signature and binary comparison" SHA256={sha(x)} SIZE={x.stat().st_size} PATH={x.name}'for x in O.iterdir()if x.is_file())+'\n');print(json.dumps(result))
