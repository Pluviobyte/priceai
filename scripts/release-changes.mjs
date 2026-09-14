import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function requiresRelease(paths) {
  // Only known repository documentation is excluded. Unknown paths fail open.
  return paths.some(path => !(/^(?:docs\/|README(?:\.[^/]+)?$|LICENSE(?:\.[^/]+)?$)/.test(path)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) throw new Error('A verified comparison base is required');
  const paths = execFileSync('git', ['diff', '--name-only', '-z', base, head], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const required = requiresRelease(paths);
  console.log(`Release required: ${required} (${paths.length} changed paths)`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `required=${required}\n`);
}
