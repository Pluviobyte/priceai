#!/usr/bin/env python3
"""Temporary host observer. Read-only Docker/proc probes; only its heartbeat file is written."""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

HEARTBEAT = Path('/run/priceai-release-observer.json')
ROLLOUT = ('priceai-priceai-web-', 'priceai-priceai-channel-worker-', 'priceai-priceai-official-worker-')


def containers():
    result = subprocess.run(['docker', 'ps', '-q'], capture_output=True, text=True, check=True, timeout=5)
    ids = result.stdout.split()
    if not ids:
        raise RuntimeError('no_running_containers')
    template = '{{json .Id}} {{json .Name}} {{json .State.Running}} {{json .RestartCount}} {{json .State.OOMKilled}} {{with index .State "Health"}}{{json .Status}}{{else}}"none"{{end}}'
    result = subprocess.run(['docker', 'inspect', '--format', template, *ids], capture_output=True, text=True, check=True, timeout=5)
    rows = {}
    for line in result.stdout.splitlines():
        cid, name, running, restarts, oom, health = [json.loads(field) for field in line.split()]
        if not name.lstrip('/').startswith(ROLLOUT):
            rows[cid] = dict(name=name.lstrip('/'), running=running, restarts=restarts, oom=oom, health=health)
    return rows


def cpu():
    values = list(map(int, Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
    return sum(values), values[3], values[4]


def problems(baseline, current, memory, disk, busy, iowait):
    issues = []
    for cid, original in baseline.items():
        actual = current.get(cid)
        if not actual or not actual['running'] or actual['oom'] or actual['restarts'] != original['restarts']:
            issues.append('container_changed:' + original['name'])
        elif original['health'] == 'healthy' and actual['health'] != 'healthy':
            issues.append('health_changed:' + original['name'])
    if memory < 1024**3:
        issues.append('available_memory_below_1GiB')
    if disk < 20 * 1024**3:
        issues.append('disk_free_below_20GiB')
    if busy > 85:
        issues.append('cpu_busy_above_85_percent')
    if iowait > 10:
        issues.append('iowait_above_10_percent')
    return issues


def save(value):
    temporary = HEARTBEAT.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.chmod(0o600)
    temporary.replace(HEARTBEAT)


def main():
    stopping = False
    def stop(*_):
        nonlocal stopping
        stopping = True
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    save({'at': time.time(), 'healthy': False, 'issues': ['baseline_sampling']})
    baseline = containers()
    previous = cpu()
    latched = []
    try:
        while not stopping:
            time.sleep(5)
            current = containers()
            current_cpu = cpu()
            total = max(1, current_cpu[0] - previous[0])
            busy = 100 * (1 - (current_cpu[1] - previous[1]) / total)
            iowait = 100 * (current_cpu[2] - previous[2]) / total
            previous = current_cpu
            memory = int(next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))) * 1024
            disk = shutil.disk_usage('/var/lib/docker').free
            issues = problems(baseline, current, memory, disk, busy, iowait)
            # Latch service changes: recovery alone must not silently resume deployment.
            latched = sorted(set(latched + [issue for issue in issues if issue.startswith(('container_', 'health_'))]))
            record = dict(at=time.time(), healthy=not (issues or latched), issues=sorted(set(issues + latched)),
                          protectedContainers=len(baseline), availableMiB=round(memory/2**20),
                          freeGiB=round(disk/2**30,1), cpuBusy=round(busy,1), iowait=round(iowait,1), load1=os.getloadavg()[0])
            save(record)
            print(json.dumps(record), flush=True)
    finally:
        save({'at': time.time(), 'healthy': False, 'issues': ['observer_stopped']})


if __name__ == '__main__':
    main()
