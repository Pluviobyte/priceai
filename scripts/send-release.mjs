const { GITHUB_SHA: sha, EXPECTED_RELEASE: release, WEB_IMAGE: web, WORKER_IMAGE: worker, REGISTRY_TOKEN: registryToken } = process.env;
if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^[a-f0-9]{64}$/.test(release ?? '') || !registryToken) throw new Error('Incomplete release environment');
for (const [name, value] of [['web', web], ['worker', worker]]) {
  if (!new RegExp(`^ghcr\\.io/pluviobyte/priceai-${name}@sha256:[a-f0-9]{64}$`).test(value ?? '')) throw new Error(`Invalid ${name} digest`);
}
// Stdout is piped directly into the restricted SSH command; never log this payload.
process.stdout.write(JSON.stringify({ action: 'deploy', sha, release, web, worker, registryToken }));
