# Pricing display and collection status maintenance

Baseline: b97ff1b7811d08756d6a21ba81d49165524fd511. Production is Hostinger;
DMIT PriceAI remains stopped. Preserve other projects, database and tunnel services.

This release repairs the shared transit query's global 300-row truncation: provide
provider filtering and database pagination in model lists/API, an all-model link
from each provider, and complete data for station summary ranges. Preserve zero
prices. Avoid the price/probe cross-product in station statistics.

Separate ended-task success (including successful partial refreshes) from enabled
source full coverage in the last 24 hours. Exclude running tasks from the success
denominator, expose full/partial successes and failures. Public/admin anomaly
counts and queues use the same current full/per-type catalog and enabled sources.

Publication reconciles anomaly state by source/item/kind across raw snapshot IDs.
Reuse an existing representative, reopen it when the condition recurs, preserve
manual ignores (including legacy duplicates), and avoid writing unchanged state.
Select the current snapshot row when legacy duplicates would otherwise collide
with the snapshot/kind unique constraint. Keep legacy duplicates untouched until
separate bounded/audited reconciliation; no historical bulk update inside release
or publication, no deletion, migration, VACUUM FULL, reindex or discovery recovery.
No schema migration is needed for this release.

Validate on isolated PostgreSQL: >300 models with a second provider, pagination
completeness/zero values; full/partial/failed/running task statistics; latest type
snapshot anomaly selection; cross-snapshot identity reuse, ignore propagation,
recurrence, legacy uniqueness and unchanged tuple reuse. Run tests in CI.

Read-only Hostinger baseline 2026-09-23 ~04:00 UTC: 1118 successful runs (635 full,
483 partial), 14 failed, 449/449 enabled sources fully covered within 24h.
Published snapshots 5794MB including 2625MB indexes, about11.43M rows,929 retained
generations; 511 generations/7.53M rows in last24h, no prune audit or deleted tuple
stats. Actual autovacuum has run. These are samples, not a disk-usage forecast.
Retention policy, historical reconciliation and host SSH remain follow-up work;
this release does not claim their completion. Production acceptance is recorded
separately after CI and deployment.
