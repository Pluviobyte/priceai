# 卡网来源发现与自动检测

> 实施日期：2026-09-08。对应 `packages/pipeline/src/{candidates,discovery-directories,discovery-platforms,vetting}.ts`、`packages/shop-api-16688-collector`、`apps/worker/src/{channel-cycle,channel-worker}.ts`、迁移 `0018_reflective_avengers`。

## 目标

把"店铺在哪"和"店铺卖什么价"彻底分开：店铺 URL 可以来自任何公开目录，但**每一条价格都只来自我们自己对店铺公开接口的采集**。竞品目录只提供候选，候选必须通过与人工投稿相同的门禁才能成为启用来源。

## 数据流

```text
公开目录 (PriceAI 商家目录 / AI号探 / 卡网大全 / Aibijia) ─┐
16688 源头广场 (平台自带的货源列表)                          ├→ source_candidates（按店铺身份去重，记录被哪些目录收录）
Grok / X、搜索引擎、聚合 feed、商家投稿                     ─┘
                                                                     ↓ 自动检测（每个 channel cycle 取 CANDIDATE_VETTING_BATCH 个）
   1 URL 安全（SSRF/私网/凭据）
   2 平台探测 → 采集器类型（shop_api / shop_api_16688 / kami / dujiao / generic_html …）
   3 身份解析（LDXP token、16688 shop_no、自建站 hostname）→ 已有来源即标记 duplicate
   4 复用投稿预检：建立 source_submissions → 试采 ≤50 页 → 完整性校验
   5 AI 相关度：试采商品跑分类器，统计命中标准产品的数量与占比
   6 质量画像：有货/缺货、无质保占比、风险事实、联系方式、与已收录店铺的目录重合、相对市场中位价的离群
   7 判定 approve / review / reject（规则见下）
   8 approve → sources.enabled=true 并立即排入采集；写审计日志；merchants.contact_public 填入平台公开联系方式
                                                                     ↓
                      现有调度 → 采集 → 分类 → 发布代次 → /channels 与首页
```

## 店铺身份

`packages/source-signatures/src/platforms.ts` 定义平台族：

| 平台族 | platform_kind | 域名 | 主域名 | 身份 |
|---|---|---|---|---|
| LDXP 链动小铺 | `ldxp_shop_api` | wzyp.cn、www.ldxp.cn、pay.ldxp.cn（已 301 到 wzyp.cn） | https://wzyp.cn | `/shop/<token>`，token 区分大小写、可含 `._-` |
| 16688 | `shop_api_16688` | www.16688.com.cn、16688.com.cn | https://www.16688.com.cn | `/shop/<shop_no>`，商品页 `/goods/<goods_no>` 经 `goods/detail` 反查 |
| 其他 Shop API 部署（如 catfk.com） | `shop_api@<host>` | 各自域名 | — | 独立 token 空间，不与 LDXP 合并 |
| 自建站（独角数卡 / 异次元 / 通用 HTML） | 采集器自身 kind | — | — | hostname |

LDXP 采集器现在按平台族做域名故障转移：请求首选上次成功的域名，失败或被重定向时依次尝试族内其他域名；`Shop/info` 返回的 `link` 决定规范入口 URL，`repairShopApiEntryUrls` 每个周期把仍指向退役域名或连续失败的来源重新解析。

## 判定规则（`decideVetting`）

| 条件 | 结论 |
|---|---|
| 试采不完整 | review（`trial_incomplete`） |
| 试采 0 件商品 | rejected，30 天后自动重检 |
| 0 件 AI 相关商品 | rejected，30 天后自动重检 |
| 与某个已启用来源目录重合 ≥ 90% | review（`catalog_mirror_suspected:<source>`） |
| ≥3 件可比商品且 ≥50% 低于市场中位价 40% | review（`prices_far_below_market`） |
| AI 相关 ≥ 3 件或占比 ≥ 30% | approved |
| 其他 | review（`low_ai_relevance`） |

探测、试采遇到主机忙/超时等瞬态错误时候选回到 pending，1 小时后重试；第三次仍失败转人工。所有结论写入 `source_candidates.vetting_result`、`source_quality_profiles` 与 `audit_logs`（actor `automatic_vetting`）。

`source_quality_profiles` 是事实画像，不是信用评分：无质保占比、缺货占比、目录重合等只在后台与商家页展示，不参与最低价。已启用来源每 7 天用最新完整快照重算，AI 相关商品归零的来源标记 `degraded` 供人工处理，不自动停用。

## 限速与礼貌

`packages/collector-sdk/src/throttle.ts` 提供进程级同源限速（默认 700ms ± 300ms 间隔、每主机 2 并发，429/503 触发 30 秒或 Retry-After 冷却），LDXP、16688、独角数卡、Kami 采集器和目录导入都经过它。数据库层的 `crawl_leases` 继续保证同一主机同一时间只有一个完整采集。

## 运行方式

| 场景 | 方式 |
|---|---|
| Dokploy 生产 | 新增 Application **Channel Worker**（Dockerfile.worker，启动命令 `npm run start:channels --workspace @price-radar/worker`）。每 `CHANNEL_WORKER_TICK_MS` 执行一次 channel cycle：目录导入（到期才做）→ 入口修复 → 检测一批候选 → 采集到期来源 → 发布 → 画像刷新。只需要 PostgreSQL；advisory lock 7410319 保证跨容器单飞。 |
| Dokploy Schedule | `cd /app && npm run cli --workspace @price-radar/worker -- channel-cycle` 与上面等价，适合不想常驻进程的部署。 |
| 本地 BullMQ Worker | `npm run dev:worker` 启动时和每 24 小时导入目录，每 5 分钟检测一批候选并刷新画像。 |
| 手动 | `import-directories`、`enumerate-16688 [all]`、`vet-candidates [n]`、`refresh-quality-profiles [n]`、`repair-entry-urls [n]`、`channel-cycle [force]` |

后台 `/admin/discovery` 显示候选的身份、被多少目录收录、自动检测结论、试采画像，并可"重新自动检测 / 转入人工预检 / 拒绝"；`/admin/submissions` 沿用原有审核；`/admin/sources` 显示每个来源的质量画像。

## 验证

```sh
npm run typecheck && npm test
npm run cli --workspace @price-radar/worker -- import-directories
npm run cli --workspace @price-radar/worker -- vet-candidates 3
npm run cli --workspace @price-radar/worker -- channel-cycle
```
