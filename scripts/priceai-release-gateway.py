#!/usr/bin/env python3
"""Root-owned forced SSH command. Accepts only PriceAI image manifests on stdin.

Dokploy 0.28.8 configuration is persisted in its database; its local deployment
webhook performs the actual Swarm rollout and writes normal deployment records.
No shell command, environment override or arbitrary image is accepted from CI.
"""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

STATE = Path('/etc/priceai-release')
OBSERVER = Path('/run/priceai-release-observer.json')
APPS = [
    ('web', '2p6cPHkJktKqz1gXz0e34', 'priceai-priceai-web-pbcibz', None),
    ('worker', 'sGr4c80QiSDR7eYYrg7y5', 'priceai-priceai-official-worker-kshd6w',
     '/usr/bin/tini -g -- node --import tsx apps/worker/src/official-subscriptions.ts'),
    ('worker', 'q3bsdOprKtrvLr7wGIkBX', 'priceai-priceai-channel-worker-to7sxy',
     '/usr/bin/tini -g -- node --import tsx apps/worker/src/channel-worker.ts'),
]


def run(args, data=None, timeout=120):
    result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        # Commands may contain registry credentials or configuration. Never echo them.
        raise RuntimeError(f'{args[0]} operation failed (exit {result.returncode})')
    return result.stdout.strip()


def sql(query):
    cid = run(['docker', 'ps', '-q', '-f', 'name=dokploy-postgres'])
    if not cid or '\n' in cid:
        raise RuntimeError('Dokploy database unavailable')
    return run(['docker', 'exec', '-i', cid, 'psql', '-U', 'dokploy', '-d', 'dokploy',
                '-At', '-v', 'ON_ERROR_STOP=1'], query)


def quote(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def save(path, value):
    temporary = path.with_suffix('.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream)
    os.replace(temporary, path)


def rollback_manifest_path(state=STATE):
    # An interrupted/failed deployment has not advanced current.json. Restore
    # that last good release; after a successful deployment restore previous.
    return state / ('current.json' if (state / 'pending.json').exists() else 'previous.json')


def validate(payload):
    for field, length in [('sha', 40), ('release', 64)]:
        if not re.fullmatch('[a-f0-9]{' + str(length) + '}', payload.get(field, '')):
            raise ValueError('Invalid release identifier')
    for kind in ['web', 'worker']:
        if not re.fullmatch(r'ghcr\.io/pluviobyte/priceai-' + kind + r'@sha256:[a-f0-9]{64}', payload.get(kind, '')):
            raise ValueError('Only immutable PriceAI images are accepted')


def validate_registry_token(token):
    # GitHub can issue JWT/base64 tokens as well as the older ghs_ format.
    # Dokploy interpolates this into a quoted shell argument: exclude quotes,
    # substitutions, whitespace and control characters, not safe JWT punctuation.
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_./+=:-]{20,8192}', token):
        raise ValueError('A short-lived registry token is required')


def capacity():
    disk = shutil.disk_usage('/var/lib/docker')
    stat = os.statvfs('/var/lib/docker')
    used_percent = (1 - disk.free / disk.total) * 100
    inode_percent = (1 - stat.f_favail / stat.f_files) * 100
    return {'diskUsedPercent': round(used_percent, 1), 'freeGiB': round(disk.free / 2**30, 1),
            'inodeUsedPercent': round(inode_percent, 1)}


def observer_guard():
    # Optional administrator-started observer. Once present, fail closed on stale/error state.
    if OBSERVER.exists():
        observation = json.loads(OBSERVER.read_text())
        if time.time() - observation.get('at', 0) > 20 or observation.get('healthy') is not True:
            raise RuntimeError('Host observer paused deployment; inspect administrator monitoring log')


def status():
    result = capacity()
    result['services'] = []
    for _, _, service, _ in APPS:
        spec = json.loads(run(['docker', 'service', 'inspect', service]))[0]
        cids = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.swarm.service.name=' + service]).split()
        healthy = False
        if cids:
            containers = json.loads(run(['docker', 'inspect', *cids]))
            healthy = all(c['State'].get('Health', {}).get('Status') == 'healthy' for c in containers)
        result['services'].append({'name': service, 'healthy': healthy,
            'replicas': spec['Spec']['Mode']['Replicated']['Replicas'],
            'image': spec['Spec']['TaskTemplate']['ContainerSpec']['Image']})
    return result


def wait_service(service, image, timeout=360):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        observer_guard()
        spec = json.loads(run(['docker', 'service', 'inspect', service]))[0]
        update = spec.get('UpdateStatus', {}).get('State', '')
        if update in ('paused', 'rollback_paused', 'rollback_completed'):
            raise RuntimeError('Swarm rollout did not succeed: ' + service)
        current = spec['Spec']['TaskTemplate']['ContainerSpec']['Image']
        cids = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.swarm.service.name=' + service]).split()
        if current == image and len(cids) == 1:
            container = json.loads(run(['docker', 'inspect', cids[0]]))[0]
            if container['Config']['Image'] == image and container['State'].get('Health', {}).get('Status') == 'healthy':
                return
        time.sleep(5)
    raise RuntimeError('Service readiness timed out: ' + service)


def wait_public_health(release, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            request = urllib.request.Request('https://priceai.io/api/health', headers={
                'User-Agent': 'PriceAI-Release-Health/1.0', 'Cache-Control': 'no-cache',
            })
            with urllib.request.urlopen(request, timeout=10) as response:
                health = json.load(response)
            if health.get('release') == release and health.get('database') == 'ok' and health.get('status') == 'ok':
                return
        except (OSError, ValueError):
            pass
        time.sleep(5)
    raise RuntimeError('Public readiness did not match release within timeout')


def deploy(payload, registry_token):
    validate(payload)
    observer_guard()
    usage = capacity()
    if usage['freeGiB'] < 15 or usage['diskUsedPercent'] >= 85 or usage['inodeUsedPercent'] >= 85:
        raise RuntimeError('Insufficient deployment disk headroom: ' + json.dumps(usage))
    # Pull once with a short-lived GitHub token, without retaining a Docker login.
    with tempfile.TemporaryDirectory(prefix='priceai-registry-') as config:
        run(['docker', '--config', config, 'login', 'ghcr.io', '-u', 'Pluviobyte', '--password-stdin'], registry_token)
        for kind in ['web', 'worker']:
            observer_guard()
            run(['docker', '--config', config, 'pull', payload[kind]], timeout=600)
            observer_guard()
            image = json.loads(run(['docker', 'image', 'inspect', payload[kind]]))[0]
            labels = image['Config'].get('Labels', {})
            if labels.get('org.opencontainers.image.revision') != payload['sha'] or labels.get('io.priceai.release') != payload['release'] or image['Architecture'] != 'amd64':
                raise RuntimeError('Image provenance does not match manifest')
        print('Verified both image digests; starting sequential Dokploy deployment.', flush=True)
    ids = ','.join(quote(app[1]) for app in APPS)
    backup = json.loads(sql(f'SELECT json_agg(a) FROM application a WHERE "applicationId" IN ({ids});'))
    if len(backup) != 3:
        raise RuntimeError('Expected exactly three PriceAI applications')
    save(STATE / ('before-' + str(time.time_ns()) + '.json'), backup)
    previous = json.loads((STATE / 'current.json').read_text()) if (STATE / 'current.json').exists() else None
    save(STATE / 'pending.json', payload)
    docker_auth_path = Path('/var/lib/docker/volumes/dokploy/_data/config.json')
    original_auth = json.loads(docker_auth_path.read_text()).get('auths', {}).get('ghcr.io') if docker_auth_path.exists() else None
    try:
        for kind, app_id, service, command in APPS:
            observer_guard()
            entrypoint = '/usr/bin/tini -g --' if command else None
            args_sql = 'ARRAY[' + ','.join(quote(arg) for arg in command.removeprefix('/usr/bin/tini -g -- ').split()) + ']::text[]' if command else 'NULL'
            sql('UPDATE application SET "sourceType"=\'docker\', "autoDeploy"=false, '
                '"dockerImage"=' + quote(payload[kind]) + ', command=' + quote(entrypoint) + ', args=' + args_sql + ', '
                'username=\'Pluviobyte\', password=' + quote(registry_token) + ', "registryUrl"=\'ghcr.io\', '
                '"registryId"=NULL, replicas=1 WHERE "applicationId"=' + quote(app_id) + ';')
            before_ids = sql('SELECT "deploymentId" FROM deployment WHERE "applicationId"=' + quote(app_id) + ';').splitlines()
            token = sql('SELECT "refreshToken" FROM application WHERE "applicationId"=' + quote(app_id) + ';')
            if not token:
                raise RuntimeError('Missing Dokploy deployment webhook')
            sql('UPDATE application SET "autoDeploy"=true WHERE "applicationId"=' + quote(app_id) + ';')
            try:
                request = urllib.request.Request('http://127.0.0.1:3000/api/deploy/' + token,
                    data=json.dumps({'head_commit': {'id': payload['sha'], 'message': 'CI image release ' + payload['sha']}}).encode(),
                    headers={'Content-Type': 'application/json', 'X-GitHub-Event': 'push'}, method='POST')
                with urllib.request.urlopen(request, timeout=30) as response:
                    if response.status != 200:
                        raise RuntimeError('Dokploy refused deployment')
            finally:
                sql('UPDATE application SET "autoDeploy"=false WHERE "applicationId"=' + quote(app_id) + ';')
            deadline = time.monotonic() + 480
            while time.monotonic() < deadline:
                observer_guard()
                records = json.loads(sql('SELECT coalesce(json_agg(d),\'[]\'::json) FROM '
                    '(SELECT "deploymentId",status FROM deployment WHERE "applicationId"=' + quote(app_id) + ') d;'))
                new = [d for d in records if d['deploymentId'] not in before_ids]
                if any(d['status'] in ('error', 'cancelled') for d in new):
                    raise RuntimeError('Dokploy deployment failed: ' + service)
                if any(d['status'] == 'done' for d in new):
                    break
                time.sleep(5)
            else:
                raise RuntimeError('Dokploy deployment timed out: ' + service)
            wait_service(service, payload[kind])
            print(service + ': exact image healthy', flush=True)
        wait_public_health(payload['release'])
        observer_guard()
        if previous and previous != payload:
            save(STATE / 'previous.json', previous)
        save(STATE / 'current.json', payload)
        (STATE / 'pending.json').unlink()
    finally:
        # The token expires with the Actions job; do not leave it in Dokploy.
        sql('UPDATE application SET "autoDeploy"=false, username=NULL, password=NULL '
            'WHERE "applicationId" IN (' + ids + ');')
        if docker_auth_path.exists():
            config = json.loads(docker_auth_path.read_text())
            auths = config.setdefault('auths', {})
            if original_auth is None:
                auths.pop('ghcr.io', None)
            else:
                auths['ghcr.io'] = original_auth
            save(docker_auth_path, config)


def main():
    os.umask(0o077)
    STATE.mkdir(mode=0o700, exist_ok=True)
    raw = sys.stdin.buffer.read(16385)
    if len(raw) > 16384:
        raise ValueError('Manifest too large')
    incoming = json.loads(raw)
    action = incoming.get('action')
    if action == 'status':
        print(json.dumps(status()))
        return
    if action not in ('deploy', 'rollback'):
        raise ValueError('Unsupported action')
    registry_token = incoming.get('registryToken', '')
    validate_registry_token(registry_token)
    with open(STATE / 'release.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if action == 'rollback':
            payload = json.loads(rollback_manifest_path().read_text())
        else:
            payload = {key: incoming[key] for key in ['sha', 'release', 'web', 'worker']}
        deploy(payload, registry_token)
        print(json.dumps(status()))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # urllib/subprocess exception strings can include secret webhook URLs.
        if isinstance(error, (RuntimeError, ValueError)):
            print(str(error), file=sys.stderr)
        else:
            print('Release failed: ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
