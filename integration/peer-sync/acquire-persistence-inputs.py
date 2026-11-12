"""Acquire reviewed persistence inputs only; never install or execute them."""
import argparse,hashlib,json,urllib.request
from pathlib import Path
BASE='https://raw.githubusercontent.com/Xubu-Trad/cawmmunity.caw-decentralized-social/'
INPUTS={'integration/peer-sync/fixture/SHA256.json': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '5571f203eb4a4a6f76f59152371bbc76e92104192b2779216214f1f93b653e12', 'size': 358}, 'integration/peer-sync/fixture/blocks.rlp.hex.txt': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': 'ad675efcb6dca9abc65ea51cdd1716e0fe906b00fee93ddb2dce8244fc8e988a', 'size': 207969}, 'integration/peer-sync/fixture/capture.json': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '332fe6093493df66d4aaa21fcfc4f377beef8f4a53155861634fb58ef902f32d', 'size': 54049}, 'integration/peer-sync/fixture/genesis.json': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '131785d5b4376eb45086c21ee3861f93ed891740ba831ccab465ac63990e30cc', 'size': 544}, 'integration/peer-sync/fixture/proof-request.json': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '0ecf14d06bd3510aecabf34f2f0a8cb1f3f91f58fb6876ce1ad00a895f3ce897', 'size': 1350}, 'integration/peer-sync/reproduce-persistence.py': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '221e6ea9470197c582a9d07b73eea9eaedaa6b63537dfd98d329304d1912af8e', 'size': 2753}, 'integration/peer-sync/run-header-sync.py': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': 'ed77d24fdb3b69e5984fabaf119b55a38af53f7387cdd2ee165f91e1d8cf458c', 'size': 12437}, 'integration/core-baseline-v1/check-geth-header-proof.mjs': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '5c1376304f97cbabc6e5a1eb60c957b3ed9716b43b4fd034fd0221f7a2e7147e', 'size': 1391}, 'reference/header-bound-state-proof.mjs': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '244e2f468d02b362246ae8e8bc659801b233c7257d774a695d40e9c1d2428955', 'size': 3918}, 'public/bounded-json.mjs': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '73312692245add67ea140ef1393efe9577d337d917867f9edca02ce82af8b051', 'size': 6122}, 'reference/ethereum-execution-header.mjs': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': 'dd69f58be27f861939432a2a140298fde3be1393e8d9bbd8b6dfb88c69cb34eb', 'size': 9631}, 'reference/keccak256.mjs': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '6ed8268eb811eddb3345ebb47e824346c00585d6bed2ec3767e1783d31615edf', 'size': 2961}, 'reference/ethereum-state-proof.mjs': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '56c2278447b1eccef6a29dbeb4da7777ad5330fe5bb67655c1ed9f8564af628f', 'size': 12928}, 'evidence/registry-later-20261109/result.json': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': 'de87ecd043b5ceee7089b9e68e01bbca328bf1a3ceeb62c44730ff1078c66120', 'size': 4974}, 'integration/peer-sync/run-header-sync-early-trace.py': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '7620c76e2909b6698b4be94a5d84f1b7aa791f3cde6173b22d5a4299127ee357', 'size': 12712}, 'integration/peer-sync/tracing-capability.py': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': '8a8b6a3f5ba316025f9a75d02beb014eb7e98b4e1dcc5a207edb5e7dc8c3c15a', 'size': 2607}, 'integration/peer-sync/test-tracing-failures.py': {'commit': 'e250e4061dd822c1a3dc9bf7627343753ebc7ba3', 'sha256': 'd17364be26784bb612c4c014bccf0e999f4a6f4a4ddb297b0d2a70223ad6b008', 'size': 2344}, 'integration/peer-sync/reproduce-traced-persistence.py': {'commit': 'dbf8c39b798b1a37fa886b7b492d3e90d43c4fce', 'sha256': 'e75db7365ce60de12f648bbae1db6607ad07073ab3ee2013e3101c2242d64588', 'size': 3532}, 'integration/peer-sync/traced-persistence-preflight.py': {'commit': 'dbf8c39b798b1a37fa886b7b492d3e90d43c4fce', 'sha256': '69eea5fbe832aeb6fa8c2a69ac381a4ecb78549ae4189e2e1b43add2e713235f', 'size': 3201}, 'evidence/traced-inputs-20261112/inputs.json': {'commit': 'dbf8c39b798b1a37fa886b7b492d3e90d43c4fce', 'sha256': '3a0d48b5134c87efd8ef379ec770dfe4f81c4e78508b86f93c62986ff9baea09', 'size': 2825}}

def download(url,maximum):
    with urllib.request.urlopen(url,timeout=45) as response:
        return response.read(maximum)

def acquire(output,fetch=download):
    output=Path(output).resolve()
    output.mkdir(exist_ok=False)  # Never reuse a partial or successful evidence directory.
    records=[]
    try:
        for name,item in INPUTS.items():
            path=Path(name)
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('INVALID_PINNED_PATH')
            url=BASE+item['commit']+'/'+name
            data=fetch(url,item['size']+1)
            if len(data)!=item['size'] or hashlib.sha256(data).hexdigest()!=item['sha256']:
                raise ValueError('DOWNLOAD_MISMATCH: '+name)
            target=output/name;target.parent.mkdir(parents=True,exist_ok=True)
            with target.open('xb') as f:f.write(data)
            records.append({'path':name,**item})
        result={'status':'inputs-verified','verifiedFiles':len(records),
                'scope':'download integrity only; no tools installed, code executed or recovery established'}
    except BaseException as e:
        result={'status':'blocked','verifiedFiles':len(records),'error':str(e)}
        raise
    finally:
        (output/'ACQUISITION.json').write_text(json.dumps(result,indent=2)+'\n')
        (output/'PROVENANCE.txt').write_text('\n'.join(
            f'PARENTS=[{BASE}{r["commit"]}/{r["path"]}] TRANSFORM="pinned public download" SHA256={r["sha256"]} SIZE={r["size"]} PATH={r["path"]}' for r in records)+'\n')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);a=p.parse_args()
    print(json.dumps(acquire(a.output)))
