import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The same source fingerprint in CI and the runtime image, independent of Git metadata.
const hash = createHash('sha256');
const ignored = new Set(['node_modules', 'dist', 'coverage', 'next-env.d.ts', 'playwright-report', 'test-results']);
function visit(path) {
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    if (entry.name.startsWith('.') || ignored.has(entry.name) || /\.(tsbuildinfo|log)$/.test(entry.name)) continue;
    const file = join(path, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.isFile()) hash.update(file).update('\0').update(readFileSync(file)).update('\0');
  }
}
for (const directory of ['apps', 'packages', 'deploy', 'scripts']) visit(directory);
for (const file of ['.dockerignore', 'Dockerfile', 'Dockerfile.worker', 'package.json', 'package-lock.json', 'tsconfig.base.json']) {
  hash.update(file).update('\0').update(readFileSync(file)).update('\0');
}
console.log(hash.digest('hex'));
