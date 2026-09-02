#!/usr/bin/env bash
set -euo pipefail

backup_dir=${1:-}
target_database=${RESTORE_DATABASE:-}
target_bucket=${RESTORE_BUCKET:-}
if [[ -z "$backup_dir" || ! -f "$backup_dir/postgres.dump" || ! -f "$backup_dir/SHA256SUMS" ]]; then
  echo "usage: RESTORE_DATABASE=name RESTORE_BUCKET=name CONFIRM_RESTORE=name scripts/restore.sh /backup" >&2
  exit 2
fi
if [[ -z "$target_database" || -z "$target_bucket" || "${CONFIRM_RESTORE:-}" != "$target_database" ]]; then
  echo "explicit RESTORE_DATABASE, RESTORE_BUCKET and matching CONFIRM_RESTORE are required" >&2
  exit 2
fi
backup_dir=$(cd "$backup_dir" && pwd)
(cd "$backup_dir" && shasum -a 256 -c SHA256SUMS)

docker compose exec -T postgres createdb -U price_radar "$target_database" 2>/dev/null || true
docker compose exec -T postgres pg_restore -U price_radar -d "$target_database" --clean --if-exists --no-owner --no-privileges < "$backup_dir/postgres.dump"
access_key=${OBJECT_STORAGE_ACCESS_KEY:-minio}
secret_key=${OBJECT_STORAGE_SECRET_KEY:-minio-secret}
docker run --rm --network ai-price-radar_default --entrypoint /bin/sh \
  -v "$backup_dir/objects:/backup:ro" minio/mc:latest -c \
  "mc alias set target http://minio:9000 '$access_key' '$secret_key' >/dev/null && mc mb --ignore-existing target/'$target_bucket' >/dev/null && mc mirror --overwrite /backup target/'$target_bucket'"
echo "restore completed: database=$target_database bucket=$target_bucket"
