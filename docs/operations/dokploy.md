# Dokploy 部署与官方订阅采集

生产仓库 Pluviobyte/priceai 的 main 分支。Web、官方采集 Worker 和渠道采集 Worker 是同一个 PriceAI 项目内的三个独立 Application；数据库沿用当前 PostgreSQL。

| 服务 | Dockerfile | 启动方式 | 网络 |
|---|---|---|---|
| PriceAI Web | Dockerfile | deploy/start-web.sh：迁移后启动 Next.js | 内部 3000，绑定 priceai.io 与 www |
| PriceAI Official Worker | Dockerfile.worker | npm run start:official --workspace @price-radar/worker | 无域名、无对外端口；包含 Chromium 与系统依赖 |
| PriceAI Channel Worker | Dockerfile.worker | npm run start:channels --workspace @price-radar/worker | 无域名、无对外端口；只需 PostgreSQL |

## 卡网自动发现、检测与采集（Channel Worker）

Channel Worker 是第三个 Application，复用 Dockerfile.worker，Docker build target 选择 `channels` 即可；也可沿用默认镜像并把启动命令改为 `npm run start:channels --workspace @price-radar/worker`。它不依赖 Redis、对象存储或外部定时器，部署后即自动运行，每 `CHANNEL_WORKER_TICK_MS`（默认 60 秒）执行一次 channel cycle：

1. 目录导入到期（默认 24 小时）时读取 PriceAI 商家目录、AI号探、卡网大全、Aibijia 的公开店铺列表和 16688 源头广场，只写入 `source_candidates`，按店铺身份去重并记录被哪些目录收录；
2. 修复仍指向退役域名（如 pay.ldxp.cn → wzyp.cn）的 Shop API 来源入口；
3. 自动检测 `CANDIDATE_VETTING_BATCH`（默认 5）个候选：URL 安全 → 平台探测 → 身份去重 → 试采 → AI 相关度与质量画像 → approve / review / reject，结论写入候选、`source_quality_profiles` 与 `audit_logs`；
4. 采集 `CHANNEL_CRAWL_BATCH`（默认 20）个到期来源，有完整快照时发布新代次；
5. 刷新到期的来源质量画像。

跨容器由 PostgreSQL advisory lock 7410318（官方订阅）和 7410319（channel cycle）互斥；CLI 手动执行同样受锁保护。健康检查读取 `/tmp/worker-heartbeat`，官方 Worker 与 Channel Worker 都会写它。

环境变量：`WORKER_DATABASE_URL`（或 `DATABASE_URL`）；可选 `SOURCE_DISCOVERY_ENABLED`（false 时只采集不发现）、`SOURCE_DIRECTORY_PROVIDERS`、`SOURCE_DIRECTORY_IMPORT_INTERVAL_MS`、`CANDIDATE_VETTING_BATCH`、`CHANNEL_CRAWL_BATCH`、`CHANNEL_WORKER_TICK_MS`、`COLLECTOR_HOST_MIN_INTERVAL_MS`。迁移 0018 由 Web 启动脚本执行；迁移未生效时 channel cycle 返回 `migration_0018_pending` 并在下一轮重试。

首次上线耗时取决于接口耗时、分页、超时与冷却；60 秒是两轮之间的等待时间，不是每轮执行时限，不保证 1000 个候选能在 3–4 小时内完成，通过的店铺立即进入采集，随后按现有自适应周期刷新。人工只需处理 `/admin/discovery` 中的 review 项与 `/admin/submissions`。

不想常驻进程时，可用 Dokploy Schedule 在 Worker 容器内执行 `cd /app && npm run cli --workspace @price-radar/worker -- channel-cycle`，效果相同；原有 `refresh-channels` 仍可用于只采集已启用来源。

官方 Worker 设置 WORKER_DATABASE_URL（或者 DATABASE_URL）连接当前 PostgreSQL，OFFICIAL_SUBSCRIPTION_REFRESH_INTERVAL_MS=86400000。不需要 Redis、对象存储或其他平台定时器。普通渠道爬虫和它的 Browser Worker 仍是另外的进程；它们不再负责官方订阅的日常调度。

Web 保持 INITIALIZE_OFFICIAL_SUBSCRIPTIONS=false，先部署 Web 使迁移 0017 生效，再部署官方 Worker。停用 Web 原先每小时执行 refresh-subscriptions 的 Dokploy Schedule。首次启动没有完整成功记录时扫描全部地区；随后每分钟判断是否到期，按完整成功运行时间计 24 小时。各个页面的 checked_at 不影响调度。失败保留历史价格，失败或部分国家访问/解析失败（partial）的运行一小时后重试；不把源码/镜像缺少浏览器、整源无数据或抛出异常记成成功。

入口共享 PostgreSQL advisory lock 7410318，跨容器、CLI 与调度互斥；获取锁后恢复上次中断的 running 请求。operator_job_requests 保存范围、来源计数、错误与完成时间。Web 的 POST /api/cron/official-subscriptions 仅可选登记手动请求，需要 OFFICIAL_PRICE_REFRESH_SECRET；不执行 HTTP 长任务，不依赖外部定时服务。CLI 使用同一个运行器：

```sh
npm run cli --workspace @price-radar/worker -- refresh-subscriptions
# 只做重点地区诊断，不延后全量调度：
npm run cli --workspace @price-radar/worker -- refresh-subscriptions featured
```

生产验收：Web /api/health 返回正常；Worker Docker 健康检查有心跳；operator_job_requests 中观察完整运行结果，并按来源查看 official_subscription_checks 的 HTTP 状态、最终 URL、解析数量与证据。应用页面返回 404 或接口没有国家配置，只说明该公开来源未提供记录，不能证明账号不能购买。浏览器遇持续访问拒绝停止该批请求，记录失败，不绕过登录或验证码。

价格规则：保留 Apple JSON、国家地址校验、Google 明确月价和 OpenAI 明确 month 配置；禁止 null/空字符串变成免费价格。不同渠道金额相同和其他套餐金额相同都不足以确认周期/重复身份，必须保留待核验。旧推断证据在读取层同样不参与比较，重新采集逐步更新证据。Plus 已存在年付配置线索，Apple 无明确周期的 Plus 名称不能再按旧的“仅月付”文档认定。

Google 的本币 ISO 代码优先于 Apple 商店币种，不能把 BOB、CRC、DZD、GEL、GHS、PYG 等回退成 USD。Ultra 5x/20x 按各语言的明确倍数词绑定价格，包括拼写数字与中文前置“每月”；没有倍数标签仍不推断。2026-09-08 检查发现 CI/SN 的官网把 3,100 和 61,401 标成 USD；Google 个人月价超过 USD 1,000 时登记 price_anomaly 交人工复核，不猜测正确币种、不参与比价。该阈值是异常检查规则，不是官方定价上限。

首页直接读取正式发布代次中的渠道报价和官方订阅库。官方列采用美国官网、明确月付、48 小时内核验且汇率有效的参考价；渠道列仅接收 CNY、30 天、非共享的代充/成品号/兑换码，必须明确有货并在 24 小时内核验。最低价对应的商家、交付方式和时间来自同一条记录，价格带和报价数限定同一交付方式。各来源查询独立降级，渠道失败不遮蔽官方价格。

渠道数据通过 Dokploy 在 Worker 容器内定时执行 `cd /app && npm run cli --workspace @price-radar/worker -- refresh-channels`。命令扫描已启用来源并正式发布通过检查的快照，保留采集运行记录与数据库原始商品记录；无需 Redis 或 S3。不要为了填满首页放宽周期、币种、库存或时效规则。


## 远端环境切换检查

- 先部署 Web 执行迁移，再部署渠道 Worker；数据库 URL 必须属于目标环境，开发和生产不能共用候选队列。
- 推荐第三个 Application 使用 `Dockerfile.worker` 的 `channels` target。已有官方 Worker 保持默认 target（`official`），避免错误启动渠道入口。
- 也可在仓库根目录执行 `docker compose -f deploy/compose.channels.yml up -d --build`，该文件接入现有 `dokploy-network`，不暴露端口、不启用本地 synthetic DNS。
- 常驻渠道 Worker 生效后，停用旧的“渠道报价每小时采集发布” `refresh-channels` Schedule，避免两套调度重复采集；保留官方订阅 Worker。
- 重启中断的检测在两小时后自动回队；有明确重检日期的拒绝/适配器待补项到期回队。CLI 与后台操作仍需避免对同一个候选重复人工执行。
- 验收检查日志的 `channel_worker_started`、`candidate_vetted`、`source_crawled` 和 `channels_published`，并核对数据库最新发布代次，而非仅看容器心跳。
