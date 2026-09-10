# 两地采集与数据增长

## 数据流

DMIT Channel Worker 领取候选/来源 → PostgreSQL 平台预算 → 按域名路由 → SSH 加密连接 → 杭州只读 Shop API 服务 → 原始响应回 DMIT → 完整性验证 → 原始快照 → 分类、去重和发布。

杭州服务没有数据库凭据，也不独立创建商家或报价。请求失败时延后任务，不自动退回 DMIT 出口。原有完整快照继续保留；部分分页不会覆盖最新完整批次。同一平台多个入口仍按 platform_kind + merchant_id 去重。

`COLLECTOR_CN_HOSTS` 指定路由域名；`COLLECTOR_CN_ENDPOINT` 是 Docker 可达的内网 SSH 转发地址；`COLLECTOR_CN_TOKEN` 仅保存在服务器配置。非指定域名继续使用 DMIT。当前只开放 wzyp 的 Shop/info、goodsList、goodsInfo；不允许任意 URL、重定向或修改店铺的接口。

杭州运行 `scripts/collector-egress/server.mjs`，仅绑定 127.0.0.1:17890。DMIT 的 `priceai-cn-tunnel.service` 自动重连，杭州的 `priceai-egress.service` 自动启动。独立 SSH 密钥只允许转发到该端口，无 shell、Agent 转发或额外端口权限。凭据、机器指纹和恢复备份见本地 SSH 交接目录，不进入 Git。

## 准入与更新

- 平台单并发。杭州 LDXP 使用 `LDXP_PLATFORM_INTERVAL_MS=3000`，转发服务同时设 `COLLECTOR_CN_INTERVAL_MS=3000`；其他平台仍使用生产全局间隔5.5秒。
- 默认不设每日请求总量上限（`SHOP_API_PLATFORM_DAILY_REQUESTS=0`），仍记录每个实际请求；正整数可恢复应急预算限制。连续三次验证页熔断，遵守 Retry-After。
- 取消 `LDXP_DAILY_CANDIDATES`，该旧配置不再生效。每轮领取最多50个到期来源和20个候选，刷新与准入独立提交到共享平台队列；批次数不限制每天商家数。轮次间隔5秒，旧自动失败每轮最多恢复100个。
- 正常目录统一在完整采集成功后12小时到期；按上次成功时间从旧到新调度。目标是所有启用来源在滚动24小时内有完整成功快照，预留约12小时处理排队和重试。每店包含多次分页请求，不能将店铺数当请求数。
- 24小时覆盖报告包含启用来源总数、成功数、缺失数、出口受阻数和重试数。完整采集失败不算成功，不以部分目录更新成功时间；平台不可达、无效商家和适配缺失不能保证当天成功，必须保留差额。
- 自动准入复用本次探测得到的店铺身份，省去试采前重复的Shop/info；仅匹配同一canonical URL且适配器已注册时复用，URL安全检查与完整试采不省略，手动提交仍正常探测。
- Shop API 准入完整试采最多12页；超出则等待审核，不把部分结果当完整目录。完整试采通过审核后直接晋升为正式快照，不重复拉取目录。其他适配器保持原上限。
- `COLLECTOR_GROWTH_RECOVERY=true` 才启用旧自动 WAF/无相关商品决策的分批恢复。保留旧证据及审计，不自动批准或覆盖人工决策。

## 并发与增量发布

- `CHANNEL_PLATFORM_CONCURRENCY=4`：最多4个独立平台同时执行。平台别名共用同一队列；同平台的刷新、准入串行，底层各平台限速、请求租约、WAF/Retry-After保护继续生效。
- 调度锁独占一个 PostgreSQL 连接；业务任务使用连接池，避免并发事务共用同一连接。出错或停止时等待所有任务结束，再释放锁。
- 每完成3家完整采集/获批，或自上次积累变更等待30秒，即触发一次发布，不等整轮结束。发布任务串行，新到达的变更进入下一次发布，整轮结束补发不足3家的结果。
- 发布失败保留待发布计数并重试；没有变更时不发布。仍使用原有完整快照与原子代际切换，页面不会展示半份商品目录。
- `candidate_vetted` 每店完成立即记录，`source_crawled` 和 `channels_published` 增加耗时，用于区分采集与发布瓶颈。

## 自主发现（2026-09-10）

聚合站目录只是发现渠道之一。以下渠道不依赖任何第三方 API，部署后由 Channel Worker 在发现阶段按间隔自动运行（`AUTONOMOUS_DISCOVERY_INTERVAL_MS`，默认 24 小时，GitHub 为 7 倍间隔），产出的只是候选地址与证据，准入、去重、安全检查、试采与发布全部沿用现有流程。

| 渠道 | provider | 数据来源 | 过滤 |
|---|---|---|---|
| 自有采集链接图 | `crawled_catalog_links` | 各启用来源最新完整快照的商品描述里的链接与裸域名 | 剔除本店链接、工具站（接码、2FA、邮箱、文档、代码托管、短链、大厂域名）、无店铺路径的平台首页 |
| Telegram 公开频道 | `telegram_public_channels` | 商品描述与商家公开联系方式里出现的 `t.me` 频道，读取 `t.me/s/<频道>` 公开页，最多 3 页，并沿帖子里的频道链接扩展一层 | 邀请链接不读；同样的工具站过滤 |
| GitHub 主题 README | `github_topic_readmes` | 主题页列出的仓库 README（默认 chatgpt-daichong、chatgpt-plus-pay、chatgpt-china 等） | 仓库地址本身不作为候选 |
| 16688 货源广场全类目 | `16688_source_marketplace` | 全部类目；AI 类目外只对名称像 AI 商品的货源查询店铺 | 名称关键词见 `isAiRelatedGoodsName` |

发现阶段的两道过滤：一是工具站域名（接码、2FA、邮箱、文档、代码托管、短链、网盘、动态域名、大厂域名），二是“像店铺”的判断：平台域名必须带店铺或商品路径，其他域名要有购买类路径（shop、buy、product、goods、order、cdk、pay）或链接附近出现购买、发卡、卡密、备用、分店等词。不满足的链接不发起任何请求。

### 首轮结果（2026-09-10 14:49 北京时间，提交 371e7bc / c6b6399）

| 渠道 | 读取 | 线索 | 新候选 |
|---|---:|---:|---:|
| 自有采集链接图 | 540 家来源的最新完整快照 | 654 | 545 |
| Telegram 公开频道 | 15 个频道、235 条帖子 | 15 | 6 |
| GitHub 主题 README | 33 个仓库 | 82 | 39 |
| 16688 全类目 | AI 类目外 13 件 AI 商品 | 13 | 1（12 家已是来源） |

首轮约 50 分钟内全部 592 条候选完成一次准入判定：通过 12 家（独角 4、LDXP 2、Kami 2、catfk 1、单页代充站 3），待适配 392，拒绝 41，待人工 21，出口受阻 13（网盘与云手机站），重复 4，113 条因探测暂时失败延后到 1 小时后自动重试。通过的商家全部在售 AI 权益商品（ChatGPT Go/Plus/Pro 卡充、Claude、Codex 额度、Gemini），全部经完整试采与相关性判定，没有人工审核记录被自动覆盖，平台限速状态 waf_streak=0、无熔断。待适配里 353 条是页面没有机器可读商品（非店铺或自定义站点），说明链接图的精度约为“每 8 条线索 1 家可采店铺”；第二次提交加入了邮箱、接码、网盘域名过滤与主机名校验，第三次提交加入购买语境判断以减少无效探测。

命令：`discover-links`、`discover-telegram [频道,...]`、`discover-github [主题,...]`、`enumerate-16688 all`。开关：`LINK_DISCOVERY_ENABLED`、`TELEGRAM_DISCOVERY_ENABLED`、`GITHUB_DISCOVERY_ENABLED`、`SIXTEEN688_ALL_CATEGORIES`。每次运行记录在 `discovery_runs`，候选的 `discovery_evidence` 保留提到它的商品或帖子地址。渠道效果用 `discovery_runs.candidate_count` 与候选后续状态衡量。

## 识别与展示

产品置信度与交付模式分开：明确产品可收录；产品身份冲突继续隔离，交付冲突显示待确认，不参加参考最低价和商家低价排名。补充已观察到的 GPT-Plus、Claude 5x/20x 等写法。普通账号与明确付费套餐分开，周边商品使用独立分类。

`/channels` 默认 AI 订阅与账号；`/channels?catalog=resources` 展示邮箱、验证服务等周边及 API 额度。商品范围随筛选/分页保存。未知期限或交付方式的商品不合并成可比较最低价。ChatGPT Pro 5x/20x 分开；Gemini 等套餐不明的账号保留明确的待确认类别。已知 Shop API 返回店铺不存在时终止探测，不再从其他出口尝试不匹配的适配器。

## 验收和统计

Worker 每轮输出 `catalog_growth` 并保存 system_metric_samples。命令：

```
node --import tsx apps/worker/src/cli.ts growth-report
node --import tsx apps/worker/src/cli.ts recover-growth 30
```

目标600家商家、8,000条有效报价、5,000条24小时内核验且有明确库存的报价。有效报价排除隔离；历史快照不累加；网站和商家必须处于启用状态。增长指标是持续目标，不代表部署即完成。

## 测试与发布

GitHub Actions 包含全工作区类型检查/测试/构建，真实 PostgreSQL 平台预算、恢复与目录查询测试，以及杭州服务白名单、认证和请求间隔测试。按 main → CI → codex/production → Dokploy 的现有流程发布。

回退时先关闭 COLLECTOR_GROWTH_RECOVERY，并将 COLLECTOR_CN_HOSTS 清空、暂停 LDXP 任务，避免将大量国内来源转回不可达出口。通过原发布流程回退代码；不要清空原始商品或回退数据库迁移。Dokploy 原配置备份保存在 DMIT `/etc/priceai-egress/`（含凭据，禁止公开）。

## Continuous dispatch and scoped catalogs

The channel service continuously replenishes up to `CHANNEL_PLATFORM_CONCURRENCY`
independent platforms. A slow shop no longer blocks a new job on another platform.
The bounded CLI still uses its configured batch sizes. Due refreshes precede new
admissions; candidates retain priority within each platform. Maintenance runs
independently every minute. Automatically parked candidates are recovered only
when their platform has cleared, the exact parking audit is present, and no human
or later candidate decision supersedes that audit.

Apply migrations 0021 and 0022 before deploying this version. With
`COLLECTOR_SCOPED_REFRESH=true`, LDXP stores a validated snapshot pointer for each
of card/article/resource/equity. First collection and full scans due after 20 hours
cover all four types; intermediate refreshes cover known nonempty types. Partial
updates replace only their own types, including an explicitly verified empty type.
They do not update `last_success_at` or `latest_complete_run_id`. Publication uses
per-type pointers, with the legacy full snapshot as fallback for untyped rows.

The LDXP default page size is 200 (other deployments remain 100). Omitting
`goods_type` is not supported: live samples returned an empty result. The relay
accepts pages up to 200 and gzip-compresses response envelopes above 1 KiB when
requested. Pacing remains 3 seconds on Hangzhou until separately measured.

The default `SHOP_API_PLATFORM_COOLDOWN_MS` is 900000: repeated failed recovery
probes increase the cooldown fourfold (15 minutes, 1 hour, 4 hours, 16 hours,
24-hour cap). A successful probe resets the level. Retry-After still separately
extends the next permitted request time. No additional egress IP is required by
this change.

Measure candidate decisions by their completion audit timestamps, full catalog
successes by `crawl_runs.finished_at` with `complete_snapshot=true`, and scoped
updates separately. Neither an HTTP 200 nor a completed candidate decision is a
new merchant. Short-window hourly extrapolations must include the window length.

## Product-level admission and candidate corrections (2026-09-10)

Admission version `vetting-2026-09-10.1` accepts a complete mixed catalog with at
least one confidently identified product. Mirror/price checks still precede
approval; publication continues to classify and quarantine each offer separately.
An unavailable product or closed/suspended shop is a business rejection with a
scheduled recheck, while aborted probes follow transient retry handling.
Unknown `/item/` URLs are checked for a bounded public JSON unavailability message
before guessing Shop API endpoints; redirects are not followed by that check.

With growth recovery enabled, older low-relevance reviews, failed/incomplete
trials, transient reviews and adapter candidates are requeued once with an audit
and previous evidence retained. Human-reviewed candidates and price/mirror-only
reviews are excluded. This recheck does not approve or publish candidates directly.
Verified domain migrations require a validated destination and an audited candidate
transfer; a migration notice alone is not a reason to develop a new adapter.
