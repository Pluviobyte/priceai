# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/browser-worker/package.json apps/browser-worker/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/anomaly-detector/package.json packages/anomaly-detector/
COPY packages/browser-collector/package.json packages/browser-collector/
COPY packages/classifier/package.json packages/classifier/
COPY packages/collector-sdk/package.json packages/collector-sdk/
COPY packages/database/package.json packages/database/
COPY packages/dujiao-collector/package.json packages/dujiao-collector/
COPY packages/generic-html-collector/package.json packages/generic-html-collector/
COPY packages/json-feed-collector/package.json packages/json-feed-collector/
COPY packages/kami-collector/package.json packages/kami-collector/
COPY packages/object-storage/package.json packages/object-storage/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/price-channels/package.json packages/price-channels/
COPY packages/ranking/package.json packages/ranking/
COPY packages/schema/package.json packages/schema/
COPY packages/shop-api-16688-collector/package.json packages/shop-api-16688-collector/
COPY packages/shop-api-collector/package.json packages/shop-api-collector/
COPY packages/source-signatures/package.json packages/source-signatures/
RUN npm ci --include=dev && npm cache clean --force

FROM dependencies AS build
COPY . .
RUN npm run build --workspace @price-radar/web

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(8000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "deploy/start-web.sh"]
