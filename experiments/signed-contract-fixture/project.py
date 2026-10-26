"""Project a completed local capture without publishing its request log."""
import argparse, hashlib, json
from pathlib import Path

def project(source):
    raw = source.read_bytes()
    f = json.loads(raw)
    assert f['schema'] == 'caw-signed-contract-capture/1'
    assert f['status'] == 'captured' and f['localOnly'] is True
    assert f['publicChainAuthenticated'] is False
    assert len(f['accounts']) == 3 and len(set(f['accounts'])) == 3
    for state in ('parent', 'child'):
        assert [w['proof']['address'] for w in f[state]['witnesses']] == f['accounts']
        assert [len(w['proof']['storageProof']) for w in f[state]['witnesses']] == [0,1,0]
    keys = ('schema','status','rawTransaction','transactionHash','accounts','localOnly',
            'publicChainAuthenticated','parent','child','receipt')
    result = {k: f[k] for k in keys}
    result['rawCaptureSha256'] = hashlib.sha256(raw).hexdigest()
    return (json.dumps(result, indent=2) + '\n').encode()

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('capture', type=Path)
    p.add_argument('output', type=Path)
    a = p.parse_args()
    data = project(a.capture)
    with a.output.open('xb') as out:
        out.write(data)
    print('PARENTS=[' + str(a.capture) + '] TRANSFORM="project completed capture" SHA256='
          + hashlib.sha256(data).hexdigest() + ' SIZE=' + str(len(data)) + ' PATH=' + str(a.output))
