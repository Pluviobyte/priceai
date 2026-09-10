import { validateReleasePage } from './release-page-validation.mjs';

const expected = process.env.EXPECTED_RELEASE;
if (!/^[a-f0-9]{64}$/.test(expected ?? '')) throw new Error('EXPECTED_RELEASE is required');
const origin = 'https://priceai.io';
const deadline = Date.now() + 15 * 60_000;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${origin}/api/health?release=${expected}&t=${Date.now()}`, {
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    const health = response.ok ? await response.json() : null;
    if (health?.status === 'ok' && health.release === expected) {
      for (const path of ['/', '/channels', '/channels?view=merchants']) {
        const page = await fetch(origin + path, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        if (!page.ok) throw new Error(`${path}: HTTP ${page.status}`);
        const html = await page.text();
        validateReleasePage(path, html);
      }
      console.log(`Verified release ${expected} on ${origin}`);
      process.exit(0);
    }
    console.log(`Waiting for the checked release (HTTP ${response.status})`);
  } catch (error) {
    console.log(`Waiting for service readiness: ${error.message}`);
  }
  await new Promise(resolve => setTimeout(resolve, 15_000));
}
throw new Error('Release was not verified within 15 minutes; inspect Dokploy deployments and runtime logs.');
