import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { requiresRelease } from './release-changes.mjs';

test('repository documentation does not require deployment', () => {
  assert.equal(requiresRelease(['README.md', 'README.en.md', 'docs/images/demo.png', 'LICENSE']), false);
  assert.equal(requiresRelease([]), false);
});
test('runtime documentation, lockfiles, workflow and unknown changes require deployment', () => {
  for (const path of ['apps/web/README.md', 'package-lock.json', '.dockerignore', '.github/workflows/production.yml', 'Dockerfile.worker', 'deploy/start-web.sh', 'new-config.json']) {
    assert.equal(requiresRelease(['README.md', path]), true, path);
  }
});
test('all workspace manifests are copied before dependency installation', () => {
  const manifests = ['package.json', 'package-lock.json'];
  for (const root of ['apps', 'packages']) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        try { readFileSync(`${root}/${entry.name}/package.json`); manifests.push(`${root}/${entry.name}/package.json`); } catch {}
      }
    }
  }
  for (const file of ['Dockerfile', 'Dockerfile.worker']) {
    const content = readFileSync(file, 'utf8');
    const dependencies = content.slice(0, content.indexOf('RUN npm ci'));
    for (const path of manifests) assert.ok(dependencies.includes(path), `${file} is missing ${path}`);
    assert.ok(content.indexOf('COPY . .') > content.indexOf('RUN npm ci'));
  }
});
