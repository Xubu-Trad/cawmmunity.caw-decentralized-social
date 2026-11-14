from pathlib import Path
import urllib.request,subprocess,json,hashlib,lzma,re,tarfile,io,argparse
p=argparse.ArgumentParser();p.add_argument('--runtime',required=True,type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--keyring',type=Path,default=Path('/usr/share/keyrings/ubuntu-archive-keyring.gpg'));a=p.parse_args()
O=a.output;O.mkdir(exist_ok=False)
old=a.runtime;meta=json.loads((old/'provenance.json').read_text());key=a.keyring
def sha(b):return hashlib.sha256(b).hexdigest()
def get(url,name):
 b=urllib.request.urlopen(url,timeout=60).read();(O/name).write_bytes(b);return b
release=get('https://archive.ubuntu.com/ubuntu/dists/noble/InRelease','InRelease')
q=subprocess.run(['gpgv','--status-fd','1','--keyring',str(key),str(O/'InRelease')],capture_output=True,timeout=30);(O/'signature.log').write_bytes(q.stdout+q.stderr);assert q.returncode==0,q.stderr
valid=re.findall(r'\[GNUPG:\] VALIDSIG (\S+)',q.stdout.decode());assert valid
text=release.decode();section=text.split('SHA256:\n',1)[1].split('\nSHA512:',1)[0]
match=re.search(r'^ ([0-9a-f]{64})\s+(\d+)\s+main/binary-amd64/Packages.xz$',section,re.M);assert match
index=get(meta['packagesIndex'],'Packages.xz');assert sha(index)==match[1] and len(index)==int(match[2]);assert sha(index)==meta['indexSha256']
data=lzma.decompress(index).decode();packages=[]
for item in meta['packages']:
 block=next(x for x in data.split('\n\n')if x.startswith('Package: '+item['name']+'\n'))
 field=lambda name:re.search('^'+name+': (.+)$',block,re.M).group(1)
 assert field('Version')==item['version'] and field('SHA256')==item['sha256']
 deb=old/(item['name']+'.deb');assert sha(deb.read_bytes())==item['sha256']
 payload=subprocess.check_output(['dpkg-deb','--fsys-tarfile',str(deb)],timeout=30);count=0
 with tarfile.open(fileobj=io.BytesIO(payload))as tar:
  for member in tar:
   if member.isfile():
    local=old/'root'/member.name
    assert local.is_file() and sha(local.read_bytes())==sha(tar.extractfile(member).read()),member.name
    count+=1
 packages.append({'name':item['name'],'version':item['version'],'sha256':item['sha256'],'matchedExtractedRegularFiles':count})
altered=release.replace(b'Origin: Ubuntu',b'Origin: Ubuntx',1);assert altered!=release;(O/'altered-InRelease').write_bytes(altered)
q=subprocess.run(['gpgv','--keyring',str(key),str(O/'altered-InRelease')],capture_output=True,timeout=30);assert q.returncode!=0;(O/'altered-signature.log').write_bytes(q.stdout+q.stderr)
result={'signatureVerifiedAgainstInstalledKeyring':True,'signers':valid,'keyringSha256':sha(key.read_bytes()),'releaseSha256':sha(release),'packagesIndexSha256':sha(index),'matchesPreservedIndex':True,'packages':packages,'alteredSignedMetadataRejected':True,'scope':'signed repository provenance for three preserved runtime packages and extracted regular-file consistency; not current patch status or source reproducibility','limitations':['Installed Ubuntu archive keyring is a trust assumption.','Base noble release is historical; this is not a security-update assessment.','Symlinks, all actually loaded libraries, compiler provenance and kernel are not attested.','Geth/Reth executable provenance remains separate.']}
(O/'result.json').write_text(json.dumps(result,indent=2)+'\n')
(O/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[Ubuntu-noble-InRelease,retained-runtime-provenance] TRANSFORM="gpgv and signed-index/package/extracted-file comparison" SHA256={sha(p.read_bytes())} SIZE={p.stat().st_size} PATH={p.name}'for p in O.iterdir()if p.is_file())+'\n');print(json.dumps(result))
