#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be configured}"
npm run db:migrate

# Enable for the initial rollout; subsequent refreshes use the scheduler.
if [ "${INITIALIZE_OFFICIAL_SUBSCRIPTIONS:-false}" = "true" ]; then
  npm run cli --workspace @price-radar/worker -- refresh-subscriptions
fi

exec npm run start --workspace @price-radar/web -- --hostname 0.0.0.0 --port "${PORT:-3000}"
