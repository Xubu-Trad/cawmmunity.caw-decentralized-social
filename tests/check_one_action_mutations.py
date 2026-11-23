"""Run two isolated guard-removal controls; preserve each failure in a new lane."""
from pathlib import Path
import hashlib
import json
import resource
import subprocess
import sys


def limits():
    resource.setrlimit(resource.RLIMIT_AS, (512*1024**2, 512*1024**2))
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: python3 -I -B tests/check_one_action_mutations.py NEW_OUTPUT_DIRECTORY')
    root = Path(__file__).resolve().parents[1]
    output = Path(sys.argv[1])
    output.mkdir(parents=True, exist_ok=False)
    module = Path('experiments/paid-action/one_action_model.py')
    test = Path('tests/test_one_action_model.py')
    source = (root/module).read_text()
    controls = [
        ('epoch', "require(a.epoch == epoch, 'EPOCH')",
         "require(True, 'EPOCH')", 'test_payer_transfer_return_rejects_old_epoch'),
        ('nonce', "require(a.nonce == intent.nonce, 'NONCE')",
         "require(True, 'NONCE')", 'test_post_cancel_order'),
    ]
    rows = []
    for name, old, new, expected in controls:
        if source.count(old) != 1:
            raise RuntimeError('mutation target must be unique')
        lane = output/name
        (lane/module).parent.mkdir(parents=True)
        (lane/test).parent.mkdir(parents=True)
        mutated = source.replace(old, new)
        (lane/module).write_text(mutated)
        (lane/test).write_bytes((root/test).read_bytes())
        result = subprocess.run([sys.executable, '-I', '-B', str(test)], cwd=lane,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                timeout=30, preexec_fn=limits)
        (lane/'tests.log').write_bytes(result.stdout)
        text = result.stdout.decode()
        if result.returncode != 1 or 'FAIL: '+expected not in text or '\nERROR:' in text:
            raise RuntimeError('expected behavioral failure not observed: '+name)
        # Keep raw failures locally; the public derivative replaces only the
        # absolute control-directory prefix in Python traceback filenames.
        public = text.replace(str(lane.resolve())+'/', '<CONTROL_DIRECTORY>/').encode()
        (lane/'tests.public.log').write_bytes(public)
        rows.append({'name': name, 'replace': old, 'with': new,
                     'mutatedSourceSha256': hashlib.sha256(mutated.encode()).hexdigest(),
                     'testSha256': hashlib.sha256((root/test).read_bytes()).hexdigest(),
                     'rawLogSha256': hashlib.sha256(result.stdout).hexdigest(),
                     'publicLogSha256': hashlib.sha256(public).hexdigest(),
                     'publicLogTransform': 'Replace absolute lane prefix with <CONTROL_DIRECTORY>/',
                     'exitCode': result.returncode, 'expectedFailure': expected})
    (output/'controls.json').write_text(json.dumps(rows, indent=2)+'\n')
    print('PASS: 2 guard-removal controls failed at expected behavioral assertions')


if __name__ == '__main__':
    main()
