#!/usr/bin/env bash
set -euo pipefail
: "${WEB_IMAGE:?}" "${WORKER_IMAGE:?}" "${EXPECTED_RELEASE:?}"
cleanup() { docker rm -f priceai-web-smoke >/dev/null 2>&1 || true; }
trap cleanup EXIT
for image in "$WEB_IMAGE" "$WORKER_IMAGE"; do
  docker pull "$image"
  actual=$(docker run --rm "$image" node scripts/release-fingerprint.mjs)
  test "$actual" = "$EXPECTED_RELEASE"
done
docker run --rm --init "$WORKER_IMAGE" node --input-type=module -e '
  import { chromium } from "playwright";
  import { access } from "node:fs/promises";
  await access("apps/worker/src/official-subscriptions.ts");
  await access("apps/worker/src/channel-worker.ts");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent("<h1>PriceAI browser smoke</h1>");
  if (await page.textContent("h1") !== "PriceAI browser smoke") throw Error("Browser smoke failed");
  await browser.close();
'
docker run -d --name priceai-web-smoke --network host \
  -e DATABASE_URL=postgres://priceai:ci-only-password@127.0.0.1:5432/priceai_ci \
  "$WEB_IMAGE"
ready=false
for attempt in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health > /tmp/priceai-smoke-health.json; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" != true ]; then
  docker logs priceai-web-smoke
  exit 1
fi
node -e 'const h=require("/tmp/priceai-smoke-health.json");if(h.release!==process.env.EXPECTED_RELEASE||h.database!=="ok")process.exit(1)'
# A running HTTP process must become unready if its database disappears.
if [ -n "${CI_POSTGRES_CONTAINER:-}" ]; then
  docker stop "$CI_POSTGRES_CONTAINER"
  status=$(curl -sS --max-time 10 -o /tmp/priceai-smoke-unready.json -w '%{http_code}' http://127.0.0.1:3000/api/health)
  test "$status" = 503
  node -e 'const h=require("/tmp/priceai-smoke-unready.json");if(h.status!=="degraded"||h.database!=="unavailable")process.exit(1)'
  docker start "$CI_POSTGRES_CONTAINER"
fi
