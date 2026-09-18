# 发布快照维护

本阶段发布兼容代码与小型元数据迁移，不启用历史删除或vacuum调参。生产最终状态以文末验收记录为准；工具存在不代表清理已经启用。

## 发布与实时数据

`publishLatestSnapshots` 仍更新 `offers`、检查/确认时间、分类、风险、新鲜度和价格历史。在写入完整发布快照前计算独立 `content_hash`，相同则保留当前 generation。先决定版本再写实时状态，每条报价只更新一次，不创建临时版本或追加一次全目录UPDATE。历史快照的确认时间不随实时检查刷新。

指纹包含商品身份、商品/商家名称、价格/币种、库存、标题/价格原文、描述/分类、URL、商品属性、可用性、新鲜度、分类置信度和隔离原因；排除采集时钟及 raw 行 ID。集合顺序不影响指纹。`manifest_hash` 继续表示对象存储文件的校验值。价格不变但新鲜度跨过六小时/二十四小时阈值会形成新版本。首个升级后发布建立指纹，不扫描或回填历史快照。

该优化减少重复全量快照，不等于消除发布中的其他读写；若全目录频繁有实际变化，去重率可能很低。观察 `channels_refreshed` 和 `channels_published` 的比例，不能预先宣称从每天364代降到20代。实时页面读取 `offers`；历史 Feed 的确认时间表示该历史版本的观察时间。

新增版本在发布时计算价格/币种/库存状态/可用状态差异。后台读缓存的差异，不再对60代逐项自连接历史表。旧代没有预计算数据时显示“未记录”，不在生产批量回填。后台快照数来自发布记录，配合索引存在性检查，不是每次执行精确 COUNT。

## 过期与并发

`snapshot_state` 为 retained / pruning / pruned。第一次删除和标记 pruning 在同一短事务中完成；中断后仍保持 pruning，可以续跑，不能把部分快照当成完整快照。历史 Feed 在一致性读事务里检查状态并读取数据：过期410，不存在404，未标记过期但数据不完整503，合法空版本仍正常返回。已缓存的历史 Feed 不主动远程撤回。

发布、两条回滚入口及清理事务共用非阻塞 advisory lock `(718231,1)`。维护不能和不支持该协议的旧程序混跑；必须先完成 Web/Worker 升级再启用维护。当前/前一版本、pinned版本始终保护；直接管理员SQL更改指针或pin时也需遵守同一个事务锁。初期不开放新管理写入口。

## 保留策略需要预览确认

预览只读版本元数据、表大小和系统统计，不对3400万行明细执行聚合。

提供 JSON 参数（下例仅用于评估，不是已批准的生产期限）：

```json
{"denseHours":24,"checkpointDays":7,"maxRetainedRows":5000000}
```

规则：近期全部保留；更早在时间窗内每个UTC自然日、每渠道保留最新检查点；额外保护当前/前一版本、pin和保留版本的直接前驱。未知或存在多渠道歧义的旧代保守保留。旧代渠道仅按已知发布链推导，不写库，不按时间猜测。published状态即使不在当前指针也不自动清理。

`maxRetainedRows` 是按发布时 `offer_count` 估算的预算，既不是当前磁盘占用上限，也不把被保护版本强制挤掉。超出预算时停止执行，调整密集保留窗口/检查点目标或另行增加容量。目录变大仍需复核预算。

```sh
# 使用服务器上已有的受保护凭据注入 MAINTENANCE_DATABASE_URL，勿复制到日志。
node --import tsx scripts/snapshot-retention.mts --policy /受保护路径/retention-policy.json
```

## 执行限制

只有显式附加 `--apply --generation <预览中的UUID>` 才会写库。每次调用最多处理该一个版本的5批，每批最多200行，间隔1秒，语句超时3秒、锁等待200毫秒；没有定时器、自动重试或自动扩大批次。每批重新核对规则、指针、pin和容量预算，并记录 `publication.snapshot_prune` 审计。SIGINT/SIGTERM在当前有界批次后停止。

执行必须在Linux宿主机，数据库连接为loopback（可通过仅绑定localhost的受控连接），避免读取笔记本或容器视角的错误余量。工具不自动开放数据库端口或安装代理。

每批前检查：可用内存至少1GiB，Docker所在文件系统可用至少20GiB，1分钟负载不超过可用核数的0.75倍，短时CPU忙碌不超过80%、iowait不超过5%；当前库无锁等待、其他超过60秒的事务，目标表无正在运行的vacuum。门槛只是初期保守停止条件，不能替代业务延迟/健康观察，也不能保证零影响。

## Vacuum 是独立的上线门槛

执行工具会核对 autovacuum 已开启、表级未禁用，删除触发阈值（threshold + factor × reltuples）不超过10万，且 `vacuum_truncate=false`，否则拒绝清理。工具不会自动 ALTER TABLE 或运行 VACUUM。

实际启用前还需只读检查：有效 cost_delay/cost_limit、插入触发参数、worker槽位、冻结年龄、长事务、复制槽/WAL和现有vacuum耗时。结合业务基线确定表级参数，使用短锁等待设置，禁止强推等待DDL。调低触发阈值必须同时控制vacuum I/O；不要每批删除后强制vacuum，也不以取消防回卷vacuum作为限流手段。

普通vacuum主要让空间复用，堆与索引应分开观察。不承诺磁盘17GB立即下降，不自动重建、REINDEX或VACUUM FULL，不删除数据库卷。

## 上线阶段与验收

1. 本地/CI完成迁移、发布、Feed和清理并发验证；确认备份可恢复。
2. 一次发布兼容代码与小型generation表的元数据迁移（锁超时500ms，语句5s）；大快照表不改结构，不开始删除。
3. 观察实际去重率、发布耗时、版本行数，预览若干保留窗口。明确容量与历史覆盖再确定生产policy。
4. 检查并限速配置vacuum；少量批次验证业务延迟、磁盘等待、WAL和死元组增长，异常停止。
5. 经历实际vacuum和业务高峰，确认回收赶得上删除/新增后再考虑定时执行。首次200行通过不等于稳态验收。

回退代码可以保留新增字段。清理是不可逆的数据删除，不能靠回退镜像恢复被删快照；恢复需使用已验证备份。清理启用后不得回退到不识别pruning/pruned的旧Web或不使用并发锁的旧Worker。


## 兼容代码上线验收（2026-09-17 11:56 北京时间）

功能提交 `4900039371585a5ad5e43f6aabd6b4e95888b63e`，CI https://github.com/Pluviobyte/priceai/actions/runs/35178981057 最终第2次尝试成功；指纹 `f9cd4a902873da6b4979da2c5e3b51f489a25a90891ee1ddf4e018b99199e843`。Web与两个Worker精确镜像健康，公网status/database均ok，首页与卡网页面通过CI验收。

- Web digest `179cc50a5905af484eb8eecdb73c2b4a8decb55e5213e8dd336e1e4d0c683b6c`；Worker digest `d8cfaf50ff76cb475f8ecb28cdebebfd46cae7bc6207f4cc7ba8822f313a13ef`。current记录4900039，previous保留cadb8fe。
- 首次部署在Web/Official已更新时，宿主机I/O等待超过10%门槛，观察器主动阻止继续推进；不能称首次尝试成功。资源连续约70秒回落后，仅重试失败的部署作业，复用原镜像，临时定向恢复逻辑核实并跳过已健康的Web/Official，仅部署Channel。无第二轮构建；临时恢复逻辑随后撤销，网关恢复仓库版本。
- 发布前后约19分钟每5秒观察18个受保护容器（含PriceAI数据库及其他项目），没有检测到重启、退出或既有健康状态下降。无健康检查的容器仅验证运行状态。短时I/O尖峰在部署前也出现，不能据此归因或承诺零影响；门槛未放宽。末次资源：可用内存约2312MiB、磁盘约53.3GiB、CPU忙碌7.8%、iowait0.5%。新Channel上线后观察超过5分钟。
- 0027迁移提前通过旧Web连接使用Drizzle执行，id由27变28，锁等待500ms、语句5s；仅小型generation元数据表新增字段，不改大快照表结构。定向备份 `/var/backups/priceai/before-snapshot-metadata-20260917.dump`（157688字节，0600）已在本机临时库恢复验证3024条版本/1条指针；不是全库备份。
- 最终检查3025代均retained，快照统计n_tup_del=0；没有运行清理、修改vacuum参数或创建清理定时任务。当前约18GB历史快照不会因这次上线立即缩小。
- 新Channel进入持续调度并处理候选，观察期无新发布/去重事件、无新增发布错误；最近发布仍是03:39 UTC的旧代。没有额外触发全量发布来验证，实际去重率与生产保留期限仍待自然流量观测。16688的“未开启货源商品列表”仍属既有业务反馈。
- 本地214项通过、3项条件跳过；新增专项17项已验证，网关/观察器8项通过，CI类型、迁移、集成、构建、镜像及缓存复用全部通过。生产不构建。

原工作区3个未推送提交未包含在本次上线。部署使用独立分支codex/snapshot-retention-release；原工作区已合并线上优化，私有提交保留且未推送，旧未提交副本保留在命名stash中。后续不要从原工作区直接推送main而意外带上这些提交。


## New snapshot primary-key locality (2026-09-18)

A guarded collector recovery was paused twice when host I/O wait remained above 10% for three 5-second samples, even with relay requests spaced 15 seconds apart. A live activity sample caught snapshot insertion. Cumulative index statistics showed 8,140,670 reads on the snapshot primary key versus 129,836 and 5,587 on its two generation indexes. These observations identify random primary-key access as a candidate bottleneck, not proof that all publication cost comes from it.

New publication and legacy-backfill inserts now explicitly generate UUIDv7 IDs with a 48-bit publication timestamp and 74 per-row random bits from PostgreSQL gen_random_uuid(). The RFC variant is preserved. See RFC 9562 section 5.7: https://www.rfc-editor.org/rfc/rfc9562.html#name-uuid-version-7 . IDs within a millisecond are random, not strictly ordered. Existing UUIDs, constraints, publication IDs and API behavior remain unchanged. No migration, index rebuild, historical deletion or vacuum change is needed. Other insert paths retain the existing default.

Local PostgreSQL 17 benchmark, shared_buffers=16MB: two separately seeded one-million-row tables with random UUID primary keys and 64-character payloads, CHECKPOINT before each 16,000-row insertion. Random IDs: 10,090 shared block reads, 10,400 dirtied blocks, WAL 30,825,254 bytes, 110ms. Time-local IDs: 7 reads, 316 dirtied blocks, WAL 3,652,037 bytes, 27ms. This isolates index locality; it excludes production secondary indexes, foreign keys, concurrency and storage latency, so these are not production speedup claims.

Integration tests verify actual inserted snapshot UUID version/timestamp, per-row evaluation and 30,000 unique IDs across three timestamp boundaries, invalid timestamps, existing deduplication, rollback and bounded retention behavior. Deployment and guarded recovery results must be recorded separately; local evidence alone is not production acceptance.
