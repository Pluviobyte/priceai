#!/usr/bin/env bash
set -euo pipefail

backup_dir=${1:-}
drill_database="price_radar_restore_drill"
drill_bucket="price-radar-restore-drill"
RESTORE_DATABASE="$drill_database" RESTORE_BUCKET="$drill_bucket" CONFIRM_RESTORE="$drill_database" scripts/restore.sh "$backup_dir"
source_counts=$(docker compose exec -T postgres psql -U price_radar -d price_radar -Atc "select (select count(*) from sources)||':'||(select count(*) from raw_offer_snapshots)||':'||(select count(*) from publish_generations)")
restored_counts=$(docker compose exec -T postgres psql -U price_radar -d "$drill_database" -Atc "select (select count(*) from sources)||':'||(select count(*) from raw_offer_snapshots)||':'||(select count(*) from publish_generations)")
if [[ "$source_counts" != "$restored_counts" ]]; then
  echo "restore count mismatch: source=$source_counts restored=$restored_counts" >&2
  exit 1
fi
docker compose exec -T postgres dropdb -U price_radar "$drill_database"
echo "restore drill passed: $restored_counts"
