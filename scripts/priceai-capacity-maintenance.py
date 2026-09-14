#!/usr/bin/env python3
"""Bound regenerable cache and old PriceAI images; never remove volumes."""
import fcntl
import json
from pathlib import Path
import subprocess
import sys

state = Path('/etc/priceai-release')
with open(state / 'release.lock', 'w') as lock:
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('Release active; maintenance deferred')
        sys.exit(0)
    subprocess.run(['docker', 'builder', 'prune', '--all', '--force', '--keep-storage', '4GB', '--filter', 'until=24h'], check=True)
    keep = set()
    for name in ['current.json', 'previous.json', 'pending.json']:
        path = state / name
        if path.exists():
            manifest = json.loads(path.read_text())
            keep.update([manifest['web'], manifest['worker']])
    if not (state / 'current.json').exists():
        sys.exit(0)
    images = subprocess.check_output(['docker', 'image', 'ls', '-q', '--filter',
        'label=org.opencontainers.image.source=https://github.com/Pluviobyte/priceai'], text=True).split()
    for image_id in set(images):
        image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image_id], text=True))[0]
        if set(image.get('RepoDigests') or []) & keep:
            continue
        for reference in (image.get('RepoTags') or []) + (image.get('RepoDigests') or []):
            if reference.startswith(('ghcr.io/pluviobyte/priceai-web:', 'ghcr.io/pluviobyte/priceai-web@',
                                     'ghcr.io/pluviobyte/priceai-worker:', 'ghcr.io/pluviobyte/priceai-worker@')):
                subprocess.run(['docker', 'image', 'rm', reference], check=False)
