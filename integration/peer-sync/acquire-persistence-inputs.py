"""Acquire reviewed persistence inputs only; never install or execute them."""
import argparse,hashlib,json,urllib.request
from pathlib import Path
BASE='https://raw.githubusercontent.com/Xubu-Trad/cawmmunity.caw-decentralized-social/'
INPUTS={'integration/peer-sync/fixture/SHA256.json': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '5571f203eb4a4a6f76f59152371bbc76e92104192b2779216214f1f93b653e12', 'size': 358}, 'integration/peer-sync/fixture/blocks.rlp.hex.txt': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': 'ad675efcb6dca9abc65ea51cdd1716e0fe906b00fee93ddb2dce8244fc8e988a', 'size': 207969}, 'integration/peer-sync/fixture/capture.json': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '332fe6093493df66d4aaa21fcfc4f377beef8f4a53155861634fb58ef902f32d', 'size': 54049}, 'integration/peer-sync/fixture/genesis.json': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '131785d5b4376eb45086c21ee3861f93ed891740ba831ccab465ac63990e30cc', 'size': 544}, 'integration/peer-sync/fixture/proof-request.json': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '0ecf14d06bd3510aecabf34f2f0a8cb1f3f91f58fb6876ce1ad00a895f3ce897', 'size': 1350}, 'integration/peer-sync/reproduce-persistence.py': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': 'a57d968746a17df64cca8bf332da9261d711f4d9ca7d57440a03fbb9edbe7c6c', 'size': 2507}, 'integration/peer-sync/run-header-sync.py': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': 'e3d9acaeb6ab56dde281cb88a39454022d990be2eb2530b1af66c5d4705240be', 'size': 12311}, 'integration/core-baseline-v1/check-geth-header-proof.mjs': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '5c1376304f97cbabc6e5a1eb60c957b3ed9716b43b4fd034fd0221f7a2e7147e', 'size': 1391}, 'reference/header-bound-state-proof.mjs': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '244e2f468d02b362246ae8e8bc659801b233c7257d774a695d40e9c1d2428955', 'size': 3918}, 'public/bounded-json.mjs': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '73312692245add67ea140ef1393efe9577d337d917867f9edca02ce82af8b051', 'size': 6122}, 'reference/ethereum-execution-header.mjs': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': 'dd69f58be27f861939432a2a140298fde3be1393e8d9bbd8b6dfb88c69cb34eb', 'size': 9631}, 'reference/keccak256.mjs': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '6ed8268eb811eddb3345ebb47e824346c00585d6bed2ec3767e1783d31615edf', 'size': 2961}, 'reference/ethereum-state-proof.mjs': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '56c2278447b1eccef6a29dbeb4da7777ad5330fe5bb67655c1ed9f8564af628f', 'size': 12928}, 'evidence/registry-later-20261109/result.json': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': 'de87ecd043b5ceee7089b9e68e01bbca328bf1a3ceeb62c44730ff1078c66120', 'size': 4974}, 'integration/peer-sync/run-header-sync-early-trace.py': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': 'b1e3ed5c18eb72a0ad7e8abe984b6bdedacd7b559eb2c40f4c4d6dc4c85151d4', 'size': 12586}, 'integration/peer-sync/tracing-capability.py': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '2d7b1d2d8f2fdbc254d13cc8885f50bf13a17b3d18b6708a1c5f35dc4cafb232', 'size': 2481}, 'integration/peer-sync/test-tracing-failures.py': {'commit': '5ced0bcc0427672c959b54cb3b7d8ba5fad4b586', 'sha256': '4bd32d472fc897e21b7ef513b61c9bf106cb3427fae2d2735aaf8a37aecfc811', 'size': 2218}, 'integration/peer-sync/reproduce-traced-persistence.py': {'commit': '7c1d9922bdfd4a43359bdcc85986b761797a71e4', 'size': 3406, 'sha256': 'e402bedd64784de801b6dcb7b4a838b8a49104d3753d32807dfada7b1e04794e'}, 'integration/peer-sync/traced-persistence-preflight.py': {'commit': '7c1d9922bdfd4a43359bdcc85986b761797a71e4', 'size': 3075, 'sha256': '46872cfdebd4780f98ae9e01f257384bcc3a076046c4884d0852a62e20877ed2'}, 'evidence/traced-inputs-20261112/inputs.json': {'commit': '7c1d9922bdfd4a43359bdcc85986b761797a71e4', 'size': 2825, 'sha256': 'e9a5bdbadef4c2a6cab825b1e6f98cf90614eded7bcc939f124507e0b836a85f'}}

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
