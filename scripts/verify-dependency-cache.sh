#!/usr/bin/env bash
set -euo pipefail
# After the initial CI builds, change a real source input and prove that npm and
# browser layers remain cached. This probe image is never pushed or deployed.
probe=apps/worker/ci-cache-probe.txt
trap 'rm -f "$probe"' EXIT
printf 'source change used only for cache validation\n' > "$probe"
docker buildx build --progress=plain --file Dockerfile.worker --target worker . > /tmp/priceai-worker-cache.log 2>&1
docker buildx build --progress=plain --file Dockerfile --target dependencies . > /tmp/priceai-web-cache.log 2>&1
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  for (const [path, patterns] of [
    ["/tmp/priceai-worker-cache.log", [/RUN npm ci/, /RUN npx playwright install/]],
    ["/tmp/priceai-web-cache.log", [/RUN npm ci/]],
  ]) {
    const lines = readFileSync(path, "utf8").split("\n");
    for (const pattern of patterns) {
      const header = lines.find(line => /^#\d+ \[/.test(line) && pattern.test(line));
      const step = header?.match(/^#\d+/)?.[0];
      if (!step || !lines.some(line => line === `${step} CACHED`)) {
        console.error(lines.join("\n"));
        throw Error(`Dependency cache was not reused: ${pattern}`);
      }
    }
  }
  console.log("Source change reused Web npm, Worker npm and Chromium installation layers.");
'
