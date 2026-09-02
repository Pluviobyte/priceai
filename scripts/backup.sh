#!/usr/bin/env bash
set -euo pipefail

backup_dir=${1:-}
if [[ -z "$backup_dir" || "$backup_dir" == "/" || "$backup_dir" == "$HOME" ]]; then
  echo "usage: scripts/backup.sh /explicit/safe/backup-directory" >&2
  exit 2
fi
mkdir -p "$backup_dir/objects"
backup_dir=$(cd "$backup_dir" && pwd)
bucket=${OBJECT_STORAGE_BUCKET:-price-radar-snapshots}
access_key=${OBJECT_STORAGE_ACCESS_KEY:-minio}
secret_key=${OBJECT_STORAGE_SECRET_KEY:-minio-secret}

docker compose exec -T postgres pg_dump -U price_radar -d price_radar -Fc > "$backup_dir/postgres.dump"
docker run --rm --network ai-price-radar_default --entrypoint /bin/sh \
  -v "$backup_dir/objects:/backup" minio/mc:latest -c \
  "mc alias set source http://minio:9000 '$access_key' '$secret_key' >/dev/null && mc mirror --overwrite source/'$bucket' /backup"

(
  cd "$backup_dir"
  find postgres.dump objects -type f -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS
  printf '{"schemaVersion":1,"createdAt":"%s","database":"price_radar","bucket":"%s"}\n' "$(date -u +%FT%TZ)" "$bucket" > manifest.json
)
echo "backup created: $backup_dir"
