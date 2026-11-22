#!/usr/bin/env python3
"""Fresh, pinned console verification run. Linux/Python stdlib only.

Executes reviewed repository tests and npm's integrity-checked lock installation.
No chain node, wallet, signing or external RPC is used. Registry access is needed
for npm installation; test HTTP servers bind only to loopback.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import sys

COMMIT = '03a2da645eae94f32c5e6f33db21f9974117ca40'
MANIFEST_SHA256 = '87a8fdb35a8662c3493dcace3f11a370281b41dbc543da0e2fd55e6ea45aad5e'
PROFILE = 'integration/local-console'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def inputs(source, manifest):
    data = manifest.read_bytes()
    if len(data) > 1024 * 1024 or digest(data) != MANIFEST_SHA256:
        raise ValueError('MANIFEST_IDENTITY')
    value = json.loads(data)
    if value['schema'] != 'caw-console-reproduction-inputs/1' or value['commit'] != COMMIT:
        raise ValueError('SOURCE_SELECTION')
    rows = value['files']
    if not 1 <= len(rows) <= 256:
        raise ValueError('INPUT_COUNT')
    seen = set()
    for row in rows:
        rel = PurePosixPath(row['path'])
        if rel.is_absolute() or '..' in rel.parts or '\\' in row['path'] or row['path'] in seen:
            raise ValueError('INPUT_PATH')
        seen.add(row['path'])
        path = source.joinpath(*rel.parts)
        if any(source.joinpath(*rel.parts[:i]).is_symlink() for i in range(1, len(rel.parts) + 1)):
            raise ValueError('INPUT_SYMLINK')
        if not path.is_file() or path.stat().st_size != row['size'] or row['size'] > 4 * 1024 * 1024:
            raise ValueError('INPUT_SIZE: ' + row['path'])
        raw = path.read_bytes()
        if digest(raw) != row['sha256']:
            raise ValueError('INPUT_HASH: ' + row['path'])
    return rows

def run(source, manifest, output):
    if platform.system() != 'Linux':
        raise ValueError('LINUX_REQUIRED')
    source, manifest = source.resolve(strict=True), manifest.resolve(strict=True)
    output = output.absolute()
    parent = output.parent.resolve(strict=True)
    output = parent / output.name
    if output.exists() or output.is_symlink() or output == source or source in output.parents:
        raise ValueError('FRESH_EXTERNAL_OUTPUT_REQUIRED')
    rows = inputs(source, manifest)  # Fail before executing or creating output.
    for volume in [parent] + ([Path('/mnt/c')] if Path('/mnt/c').exists() else []):
        if shutil.disk_usage(volume).free < 2 * 1024 ** 3:
            raise ValueError('DISK_GUARD_2GIB')
    available = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))) * 1024
    if available < 1024 ** 3:
        raise ValueError('MEMORY_GUARD_1GIB')
    node, npm = shutil.which('node'), shutil.which('npm')
    if not node or not npm:
        raise ValueError('NODE_AND_NPM_REQUIRED')
    env = {key: value for key, value in os.environ.items() if key.upper() not in ['NODE_OPTIONS', 'NODE_PATH'] and not key.upper().startswith('NPM_CONFIG_')}
    env['LC_ALL'] = 'C'
    if subprocess.check_output([node, '--version'], env=env, timeout=10, text=True).strip() != 'v20.20.2':
        raise ValueError('NODE_20_20_2_REQUIRED')
    if subprocess.check_output([npm, '--version'], env=env, timeout=10, text=True).strip() != '10.8.2':
        raise ValueError('NPM_10_8_2_REQUIRED')
    output.mkdir()
    work = output / 'source'
    work.mkdir()
    for row in rows:
        dest = work / row['path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((source / row['path']).read_bytes())
    inputs(work, manifest)
    for name in ['user.npmrc', 'global.npmrc']:
        (output / name).write_text('')
    env.update({'NPM_CONFIG_USERCONFIG': str(output / 'user.npmrc'), 'NPM_CONFIG_GLOBALCONFIG': str(output / 'global.npmrc'), 'NPM_CONFIG_CACHE': str(output / 'npm-cache'), 'NPM_CONFIG_REGISTRY': 'https://registry.npmjs.org/'})
    result = {'schema': 'caw-console-reproduction-result/1', 'sourceCommit': COMMIT, 'manifestSHA256': MANIFEST_SHA256,
              'sourceFiles': len(rows), 'node': '20.20.2', 'npm': '10.8.2', 'python': platform.python_version(),
              'nodeExecutableSHA256': digest(Path(node).resolve().read_bytes()),
              'freshDependencyDirectory': True, 'freshNpmCache': True, 'steps': [], 'status': 'RUNNING',
              'scope': 'Recorded synthetic history, local HTTP/minimal-DOM checks. Not fresh EVM execution, browser reproduction, public-chain finality or independent-operator certification.'}
    def command(name, args, timeout):
        log = output / (name + '.log')
        with log.open('wb') as stream:
            process = subprocess.Popen(args, cwd=work, env=env, stdout=stream, stderr=stream, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                result['steps'].append({'name': name, 'status': 'TIMEOUT'})
                raise ValueError('STEP_TIMEOUT: ' + name)
        result['steps'].append({'name': name, 'exitCode': code, 'logSHA256': digest(log.read_bytes())})
        if code:
            raise ValueError('STEP_FAILED: ' + name)
        return log.read_text()
    try:
        command('install', [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', PROFILE], 180)
        # Installed package identities must agree with the pinned transitive lock.
        lock = json.loads((work / PROFILE / 'package-lock.json').read_text())
        installed = []
        for path, item in lock['packages'].items():
            if not path:
                continue
            pkg = work / PROFILE / path / 'package.json'
            if json.loads(pkg.read_text())['version'] != item['version']:
                raise ValueError('INSTALLED_VERSION: ' + path)
            installed.append({'path': path, 'version': item['version'], 'integrity': item.get('integrity')})
        result['dependencies'] = installed
        evidence = 'evidence/posting-history-20261113'
        for name, file, args, count in [
            ('strict-reader', 'test-posting-history.mjs', [evidence + '/capture.json', evidence + '/selection.json'], 15),
            ('console', 'test-console-history.mjs', [evidence], 12),
            ('interruption', 'test-console-interruption.mjs', [evidence], 11)]:
            report = json.loads(command(name, [node, PROFILE + '/' + file] + args, 40))
            observed = report.get('negativeControlsPassed', report.get('passed'))
            if observed != count:
                raise ValueError('RESULT_COUNT: ' + name)
            result['steps'][-1]['checksPassed'] = observed
        files = ['test-wallet-provider.mjs', 'test-withdrawal-plan.mjs', 'test-account-transfer-plan.mjs', 'test-post-plan.mjs', 'test-withdrawal-journal.mjs', 'test-receipt-status.mjs']
        text = command('actions', [node, '--test'] + [PROFILE + '/' + file for file in files], 40)
        if not re.search(r'^# tests 340$', text, re.M) or not re.search(r'^# pass 340$', text, re.M) or not re.search(r'^# fail 0$', text, re.M):
            raise ValueError('ACTION_RESULT_COUNT')
        result['steps'][-1]['checksPassed'] = 340
        inputs(work, manifest)
        result['pinnedFilesUnchangedAfterRun'] = True
        result['status'] = 'PASS'
    except Exception as error:
        result['status'] = 'FAIL'
        result['error'] = str(error)
        raise
    finally:
        (output / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
        artifacts = [output / 'result.json'] + sorted(output.glob('*.log'))
        (output / 'PROVENANCE.txt').write_text(''.join('PARENTS=[' + COMMIT + ',' + MANIFEST_SHA256 + '] TRANSFORM="fresh pinned console reproduction" SHA256=' + digest(p.read_bytes()) + ' SIZE=' + str(p.stat().st_size) + ' PATH=' + p.name + '\n' for p in artifacts))
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.source, args.manifest, args.output), indent=2))
    except Exception as error:
        print('REPRODUCTION_FAILED: ' + str(error), file=sys.stderr)
        sys.exit(1)
