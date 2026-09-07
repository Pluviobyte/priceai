# Dokploy 部署与官方订阅采集

生产仓库 Pluviobyte/priceai 的 main 分支。Web 和官方采集 Worker 是同一个 PriceAI 项目内的两个独立 Application；数据库沿用当前 PostgreSQL。

| 服务 | Dockerfile | 启动方式 | 网络 |
|---|---|---|---|
| PriceAI Web | Dockerfile | deploy/start-web.sh：迁移后启动 Next.js | 内部 3000，绑定 priceai.io 与 www |
| PriceAI Official Worker | Dockerfile.worker | npm run start:official --workspace @price-radar/worker | 无域名、无对外端口；包含 Chromium 与系统依赖 |

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
