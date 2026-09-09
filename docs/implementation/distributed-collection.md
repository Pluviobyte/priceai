# 两地采集与数据增长

## 数据流

DMIT Channel Worker 领取候选/来源 → PostgreSQL 平台预算 → 按域名路由 → SSH 加密连接 → 杭州只读 Shop API 服务 → 原始响应回 DMIT → 完整性验证 → 原始快照 → 分类、去重和发布。

杭州服务没有数据库凭据，也不独立创建商家或报价。请求失败时延后任务，不自动退回 DMIT 出口。原有完整快照继续保留；部分分页不会覆盖最新完整批次。同一平台多个入口仍按 platform_kind + merchant_id 去重。

`COLLECTOR_CN_HOSTS` 指定路由域名；`COLLECTOR_CN_ENDPOINT` 是 Docker 可达的内网 SSH 转发地址；`COLLECTOR_CN_TOKEN` 仅保存在服务器配置。非指定域名继续使用 DMIT。当前只开放 wzyp 的 Shop/info、goodsList、goodsInfo；不允许任意 URL、重定向或修改店铺的接口。

杭州运行 `scripts/collector-egress/server.mjs`，仅绑定 127.0.0.1:17890。DMIT 的 `priceai-cn-tunnel.service` 自动重连，杭州的 `priceai-egress.service` 自动启动。独立 SSH 密钥只允许转发到该端口，无 shell、Agent 转发或额外端口权限。凭据、机器指纹和恢复备份见本地 SSH 交接目录，不进入 Git。

## 准入与更新

- 平台单并发，请求默认至少间隔 5 秒；生产使用 5.5 秒。
- 默认不设每日请求总量上限（`SHOP_API_PLATFORM_DAILY_REQUESTS=0`），仍记录每个实际请求；正整数可恢复应急预算限制。连续三次验证页熔断，遵守 Retry-After。
- 取消 `LDXP_DAILY_CANDIDATES`，该旧配置不再生效。每轮领取最多50个到期来源和20个候选，刷新与准入独立提交到共享平台队列；批次数不限制每天商家数。轮次间隔5秒，旧自动失败每轮最多恢复100个。
- 正常目录统一在完整采集成功后12小时到期；按上次成功时间从旧到新调度。目标是所有启用来源在滚动24小时内有完整成功快照，预留约12小时处理排队和重试。每店包含多次分页请求，不能将店铺数当请求数。
- 24小时覆盖报告包含启用来源总数、成功数、缺失数、出口受阻数和重试数。完整采集失败不算成功，不以部分目录更新成功时间；平台不可达、无效商家和适配缺失不能保证当天成功，必须保留差额。
- Shop API 准入完整试采最多12页；超出则等待审核，不把部分结果当完整目录。完整试采通过审核后直接晋升为正式快照，不重复拉取目录。其他适配器保持原上限。
- `COLLECTOR_GROWTH_RECOVERY=true` 才启用旧自动 WAF/无相关商品决策的分批恢复。保留旧证据及审计，不自动批准或覆盖人工决策。

## 并发与增量发布

- `CHANNEL_PLATFORM_CONCURRENCY=4`：最多4个独立平台同时执行。平台别名共用同一队列；同平台的刷新、准入串行，底层5.5秒限速、请求租约、WAF/Retry-After保护继续生效。
- 调度锁独占一个 PostgreSQL 连接；业务任务使用连接池，避免并发事务共用同一连接。出错或停止时等待所有任务结束，再释放锁。
- 每完成3家完整采集/获批，或自上次积累变更等待30秒，即触发一次发布，不等整轮结束。发布任务串行，新到达的变更进入下一次发布，整轮结束补发不足3家的结果。
- 发布失败保留待发布计数并重试；没有变更时不发布。仍使用原有完整快照与原子代际切换，页面不会展示半份商品目录。
- `candidate_vetted` 每店完成立即记录，`source_crawled` 和 `channels_published` 增加耗时，用于区分采集与发布瓶颈。

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
