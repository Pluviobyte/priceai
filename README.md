# AI Price Intelligence

面向 AI 订阅、账号、充值与 API 服务的价格情报和渠道核验平台。

## 当前状态

125 项产品功能已经实现。完整范围见 [方案总索引](./docs/plans/README.md)，逐项证据见 [验收矩阵](./docs/implementation/feature-acceptance.md)，生产验收边界见 [开发状态](./docs/implementation/status.md)。

## 本地启动

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run dev
# 另开终端
npm run dev:worker
npm run dev:browser-worker
```

## 工作区

```text
apps/web                    Next.js 前台与管理后台
apps/worker                 BullMQ 采集与发布 Worker
apps/browser-worker         隔离、低并发的 Playwright Worker
packages/schema             共享领域类型与验证
packages/database           PostgreSQL / Drizzle Schema
packages/collector-sdk      采集器公共接口与同源限速
packages/classifier         商品分类和属性抽取
packages/source-signatures  发卡系统探测与平台族店铺身份
packages/ranking            报价可用性与排序口径
packages/json-feed-collector 自定义 JSON 与商家直连 Feed
packages/shop-api-16688-collector 16688 店铺接口采集器
```

卡网来源由 Worker 自动发现并检测：每日读取公开店铺目录与 16688 源头广场得到候选，候选经安全检查、平台探测、身份去重、试采、AI 相关度与镜像/价格离群检测后自动启用、拒绝或转人工，随后进入现有采集与发布链路。生产用常驻 Channel Worker（`npm run start:channels --workspace @price-radar/worker`）或 Dokploy Schedule 执行 `channel-cycle`；手动命令见 [来源发现与自动检测](./docs/implementation/source-vetting.md)。

官方订阅价（Apple 各商店、Google 与 OpenAI 各国官网）由 Worker 每日扫描；本地可用 `npm run cli --workspace @price-radar/worker -- refresh-subscriptions` 立即执行一次（加 `featured` 只跑重点地区）。采集口径见 [官方订阅价自动化采集方案](./docs/research/official-price-collection-automation-2026-09-07.md)。

安全角色与备份恢复见 [运行手册](./docs/operations/security-and-recovery.md)。Grok、搜索、通知和 LLM 辅助能力需在 `.env` 中提供对应密钥；没有密钥时不会影响核心比价与发布链路。

生产部署与每日官方采集以 [Dokploy 运行手册](docs/operations/dokploy.md) 为准。Web 与采集服务独立部署，官方订阅调度不依赖外部定时端点。
