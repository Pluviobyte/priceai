import { readFileSync } from 'node:fs';
const status = JSON.parse(readFileSync(0, 'utf8'));
const failures = [];
if (status.diskUsedPercent >= 80 || status.freeGiB < 20) failures.push(`Disk ${status.diskUsedPercent}% used, ${status.freeGiB} GiB free`);
if (status.inodeUsedPercent >= 80) failures.push(`Inodes ${status.inodeUsedPercent}% used`);
for (const service of status.services) {
  if (service.replicas !== 1 || !service.healthy) failures.push(`${service.name} is not healthy`);
}
try {
  const response = await fetch('https://priceai.io/api/health', { signal: AbortSignal.timeout(10000) });
  const health = await response.json();
  if (!response.ok || health.status !== 'ok' || health.database !== 'ok') failures.push('Public readiness or database failed');
} catch { failures.push('Public readiness request failed'); }
console.log(JSON.stringify(status, null, 2));
if (failures.length) {
  for (const failure of failures) console.error(`::error::${failure}`);
  process.exitCode = 1;
}
