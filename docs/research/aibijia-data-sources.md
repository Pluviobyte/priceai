# Aibijia 数据源与收录机制调研

> 调研对象：<https://aibijia.org/>  
> 调研时间：2026-09-02（Asia/Shanghai）  
> 方法：只读取官网、官网公开数据文件、前端 JavaScript、公开店铺页面/API 以及项目方 GitHub；未登录、未提交表单、未联系项目方。

## 结论先行

Aibijia 不是一个由商家直接维护报价的开放目录。公开证据更符合下面这条链路：

1. 运营者先选定/审核一批商家或店铺 URL；
2. 私有的后端刷新任务读取这些店铺的公开页面或公开接口，将标题、价格、库存等字段适配为统一 JSON；
3. 上游结果按 ChatGPT、Gemini、Claude Code、Grok 四个产品桶筛选，写入 Cloudflare/R2 风格的静态数据文件；
4. 浏览器只在页面加载时读取 JSON、排序和过滤，不在前端抓商家，也没有轮询刷新；
5. “官方订阅”是另一条独立管线：批量抓取 51 个国家/地区的 App Store 公开页面，再用 Frankfurter 汇率换算成人民币。

其中，第 1 步的审核入口和“确有自动抓取/生成任务”有直接证据；第 2 步究竟调用接口还是解析网页，以及“按店铺 allowlist”“逐平台 adapter”“写入 R2”等细节，是由数据结构、上游公开接口和元数据作出的高可信推断。后端代码没有开源，因此无法证实具体调度器、抓取频率、阈值和去重实现。

## 1. 目前实际收录了什么

### 1.1 发卡/代充市场报价

在本次快照中，[`products.json`](https://data.aibijia.org/products.json) 含 4 个产品、207 条报价：

| 产品桶 | 报价数 |
|---|---:|
| ChatGPT | 171 |
| Gemini | 22 |
| Claude Code | 10 |
| Grok | 4 |

所有报价都被转换成同一个最小字段集：`platform_name`、`source_store_name`、`source_title`、`price`、`currency`、`status`、`url`、`display_tags`。本次 207 条全部为 CNY。

按上游域名计数：

| 上游域名 | 条数 | 数据中显示的平台/店铺形态 |
|---|---:|---|
| `pay.ldxp.cn` | 158 | LDXP 上的多个独立店铺 |
| `catfk.com` | 31 | 同一 LDXP 店铺系统的另一域名，含山姆AI、艾蜜莉、AI大本营 |
| `talkai.cyou` | 7 | RedeemGPT/ai-buy |
| `kapay.shop` | 4 | Auto Subscribe |
| `faka.redeemgpt.com` | 2 | RedeemGPT |
| `bei-bei.shop` | 2 | 贝贝商店 |
| `aisou.pro` | 2 | RedeemGPT 数据桶下的 Aisou智充 |
| `ultra.makelove.cloud` | 1 | RedeemGPT 数据桶下的单独域名 |

这里的 `platform_name` 并不总是商家品牌，也不总等于域名：例如多个 `catfk.com` 店铺都被标为 `LDXP`，而 `aisou.pro` 被标为 `RedeemGPT`。因此它更像“采集适配器/平台类型”，`source_store_name` 才是店铺展示名。这一点属于基于快照结构的推断，官网没有给字段定义。

### 1.2 官方订阅地区价

[`apple_subscriptions.json`](https://data.aibijia.org/apple_subscriptions.json) 是完全独立的数据源，覆盖 ChatGPT、Claude、Gemini、Grok 的 Apple App Store 内购价格。文件明确声明：

> `"source": "app_store_public_pages_sharded_merge"`

每个 App 都有 Apple `app_id`，并记录对 51 个国家/地区的抓取统计；每个地区项保留 `raw_title`、当地币价格、App Store URL、`fetched_at`、汇率来源和人民币换算价。汇率字段明确为 `fx_source: "frankfurter.dev"`，价格证据字段为 `price_evidence_source: "public_price_pairs"`。

这足以证实官方价来自 App Store 公开页面的自动化、多地区、分片抓取，而不是人工逐行录入。对应的官方原始页链接也直接保留在数据中，例如 [ChatGPT 美国 App Store 页](https://apps.apple.com/us/app/id6448311069)。

## 2. 商家/渠道如何进入

### 已证实：URL 投稿后人工审核

首页有“提交平台”表单，只有两个真实输入：平台 URL 和最多 500 字的推荐理由；前端将其 POST 到 `/api/source-submissions`。[首页 HTML](https://aibijia.org/) 的原文是：

> “提交后勿催……可能无法及时处理您的请求。”

更关键的是，[公开 `app.js`](https://aibijia.org/app.js?v=3a5df2b80cc9) 把成功文案写成：

> “已收到，审核后会在页面展示。”

项目早期 README 也写过“如果您有靠谱的信源（渠道靠谱、售后靠谱），欢迎分享到这里，网站有提交入口”。可在 [对应 GitHub 提交](https://github.com/ka-pi-ba-la/AIbijia/commit/42fb9d44e7f2d084ce0315873652cec69194cb3b) 查看。

因此可以确定：投稿只是候选源发现机制，不是提交后自动上线；运营者保留审核和收录决定权。

### 高可信推断：审核的是“店铺/源”，随后批量拉该店商品

LDXP 的公开前端提供店铺级接口：`/shopApi/Shop/goodsList` 接收店铺 `token` 并返回整个商品列表，条目含 `goods_key`、标题、价格和 `extend.stock_count`。接口名称和库存展示逻辑可在 [LDXP 公开前端 bundle](https://pay.ldxp.cn/package/shop/assets/index.32beeed8.js) 中看到；单品页如 [AI小店样例](https://pay.ldxp.cn/item/paet49) 的公开 `goodsInfo` 数据与 Aibijia 的标题、26.55 元价格、店名完全对应。

本次快照中仅“AI小店”就有 75 条 Aibijia 报价，而公开 `goodsList` 同时返回该店 82 个卡密商品。两边以 `goods_key`/URL 能一一对上绝大多数相关商品。这比“运营者人工逐条填 75 个单品”更符合“录入店铺 token/URL，然后批量抓取并过滤”的实现。

不过，后端源码没有公开，所以上述店铺级采集方式仍是高可信推断，不能写成已证实的内部实现。

## 3. 自动抓取、Feed、用户投稿、人工维护的证据权重

| 机制 | 判断 | 证据 |
|---|---|---|
| 自动抓取 | **确定存在** | GitHub 标题直接称“多平台抓取价格”；`meta.json` 有机器生成时间和 `local_refresh_to_r2`；App Store 数据有分片抓取统计、失败计数和每地区 `fetched_at`；市场字段与上游公开接口结构一致。 |
| 商家 Feed/API 推送 | **没有公开证据** | 投稿表单只收 URL/备注，没有 Feed URL、API key、Webhook 或商家后台；公开仓库也没有接入规范。不能排除私下合作，但无法证实。 |
| 用户投稿 | **确定存在，用于发现候选源** | 官网表单、服务条款“内容主要来自公开网络信息与用户投稿”、前端“审核后展示”。 |
| 人工维护 | **确定存在于准入/审核；逐条维护未证实** | 审核文案和早期 README 的“靠谱信源”要求表明有人把关；固定四类产品和少量店铺也体现选择性收录。价格/库存快照本身明显是自动刷新，不像逐条人工填写。 |

[服务条款](https://aibijia.org/terms/) 的准确原文是：“内容主要来自公开网络信息与用户投稿”。它没有宣称所有投稿都会收录，也没有披露商家 Feed。

## 4. 刷新方式与频率

### 能证实的

- 市场数据的 [`meta.json`](https://data.aibijia.org/meta.json) 在本次读取时为 `generated_at: 2026-09-02T14:29:47.716860+00:00`，207 条报价；HTTP `Last-Modified` 为 14:30:00 UTC。
- `products.json` 和 `meta.json` 的 HTTP 缓存策略是 `max-age=60, must-revalidate`。这只代表边缘缓存最多约 60 秒，**不等于每分钟抓一次上游**。
- 首页前端只在加载时并行 `fetch` 三个 JSON；没有针对价格数据的 `setInterval` 或定时轮询。因此用户打开页面后，报价不会自己持续刷新，需重新加载页面才能取新快照。
- 官方 App Store 快照本次的 `generated_at` 是 2026-09-01T20:34:33Z，各 App 的 `fetched_at` 集中在同一次分片任务中。

### 不能证实的

官网没有公布 cron 表或 SLA。单次观察不能推出“每 10 分钟/每 30 分钟/每天一次”。`local_refresh_to_r2` 只能说明有刷新并写入对象存储风格静态文件，不能证明由 GitHub Actions、Cloudflare Cron 还是自有服务器触发。

另外，`/robots.txt` 与 `/sitemap.xml` 本次都没有返回有效的 robots/sitemap 内容，而是落回首页 HTML，因此它们没有提供源清单、爬虫策略或更多数据入口。

合理的产品表述应是“定时生成快照，具体周期未公开”，而不是“实时”。

## 5. 标准化、分类、去重与库存

### 市场报价标准化

前端 [`normalizeOffer`](https://aibijia.org/app.js?v=3a5df2b80cc9) 只做轻量处理：价格转数字、把 `status === "out_of_stock"` 标为不可用、拼搜索文本。排序规则是“可用优先 → 价格升序 → 平台名”。`low_stock` 仍被视作可购买。

后端已经提前完成了主要标准化：

- 产品桶：`chatgpt`、`gemini`、`claude-code`、`grok`；
- 币种：市场报价统一 CNY；
- 库存：`in_stock`、`low_stock`、`out_of_stock` 三值枚举；
- 来源：平台、店铺、原始标题和直达 URL 分开保存；
- 风险标签：本次只出现 `无质保` 15 次、`缺货` 5 次。

市场报价没有标准套餐 ID、订阅时长、交付方式、账号类型、质保期或“每月等价成本”等字段；这些差异仍埋在 `source_title` 原文里。因此它做的是“同一 AI 品牌下的商品流聚合”，还不是严格的同规格 SKU 比价。

### 库存如何来

LDXP 店铺公开列表返回数值 `extend.stock_count`，其自己的前端按 0、1–5、6–19、20+ 显示“缺货/少量/一般/充足”。其他来源也在公开 HTML 中暴露库存，例如 [Aisou 商品页](https://aisou.pro/item/30) 的 `_var_item` 同时含 `price`、`stock`、`is_stock`，而 [RedeemGPT/ai-buy 商品页](https://talkai.cyou/item/46) 有 JSON-LD 和 `_var_item` 库存。

Aibijia 没保留数值，只保留三档状态。其快照与 LDXP `stock_count` 大体对应，所以“各 adapter 读取公开库存后映射为统一枚举”是高可信推断；但 Aibijia 的确切阈值未公开，且库存快速变化会造成快照与现页不一致，不能把 LDXP 自己的 UI 阈值当成 Aibijia 的规则。

### 去重

- 本次 207 条报价的 URL 全部唯一，说明最终输出至少没有完全重复 URL。
- 但前端没有去重代码，只接受后端数组并排序。
- 相同店铺、相同标题仍会以不同 URL 重复出现：本次有 5 组重复标题，其中一组同店同标题出现 3 次。

因此只能说“输出在 URL 层面已唯一”，不能证明有商品级/语义级去重。更可能的唯一键是原始 URL 或 `goods_key`，但这是推断。

### 官方订阅标准化

官方价比市场价结构化得多：固定 `plan.slug` 和中文标签、订阅周期、国家代码、当地币价格、汇率日期/来源、CNY 换算价、原始标题和 App Store URL。前端按 CNY 价格排序并计算相对最便宜地区的差额。

## 6. Affiliate、广告与商业关系

可以确认站内存在赞助、广告和联盟链接：

- 首页页脚把 PackyAPI 标为“赞助”，链接是 `https://www.packyapi.com/register?aff=pYGa`，`aff` 参数明确具有推广追踪性质；见 [官网首页](https://aibijia.org/)。
- GitHub README 有指向 `catfk.com`/山姆AI的广告位，并写明“商品及服务由广告商家提供，与本站无关”；该广告由题为“添加赞助商的链接和图片”的 [提交](https://github.com/ka-pi-ba-la/AIbijia/commit/d115d81ffb4ace40e4efcc30b7b7d9d362f5db77) 加入。
- 该广告商的商品同时出现在普通报价数据中，例如 `catfk.com/item/k2ml3f`；但市场报价链接本次都没有 query 参数，不能据此认定每次跳转都有返佣。
- 官网前端会把市场报价、官方 App Store、赞助位等外链点击统一 POST 到 `/api/outbound-clicks`，包括目标 `href`、产品、来源和页面位置；见 [公开 `app.js`](https://aibijia.org/app.js?v=3a5df2b80cc9)。这证实站点统计导流效果，但不等于所有链接都有佣金。

## 7. 事实与推断边界

### 可直接证实

- 两条独立数据管线：发卡/代充市场报价与 App Store 官方地区价。
- 市场快照当前覆盖 8 个上游域名、4 个产品桶、207 条 CNY 报价。
- 用户可以提交平台 URL，但需要审核后才展示。
- 存在自动抓取/生成；官方价抓 App Store 公共页并用 Frankfurter 汇率。
- 前端不抓源站、不持续轮询，只消费已经生成的静态 JSON。
- 市场库存被压成三态，没有数值库存和单报价更新时间。
- 存在赞助、广告、联盟参数和外链点击统计。

### 只能高可信推断

- 市场侧以“审核过的店铺 token/URL allowlist + 平台 adapter”运行。
- LDXP adapter 直接调用 `goodsList`/`goodsInfo`，其他 adapter 解析 HTML/JSON-LD/嵌入 JSON。
- 后端按关键词或规则把商品映射到四个产品桶，并抽取“无质保/缺货”标签。
- URL 或上游 `goods_key` 是主要去重键。

### 目前无法确认

- 具体刷新周期、失败重试、监控告警和历史价格留存。
- 商家是否能通过私下 Feed/API 接入、是否要付费收录、是否存在竞价排名。
- 每个平台的库存映射阈值和异常降级规则。
- 投稿审核标准、下架机制、店铺可信度评分与投诉如何影响收录。
- 普通报价跳转是否返佣；目前只能确认 PackyAPI 的 `aff` 链接和 README 广告。

## 8. 对自建同类平台最有价值的启示

Aibijia 最值得复制的不是页面，而是“源准入”和“抓取适配”分离：投稿只负责发现源，人工审核后将源加入 allowlist；每种店铺系统做一个 adapter；输出统一的不可变快照供前端消费。要做得比它更可信，至少应补上每条报价的 `observed_at`、数值库存/库存证据、规格化套餐 ID、抓取失败状态、来源页面证据和价格历史，并把广告/联盟关系显示在具体报价旁边。

## 主要一手资料

- [Aibijia 首页](https://aibijia.org/)
- [服务条款](https://aibijia.org/terms/)
- [公开前端 JavaScript](https://aibijia.org/app.js?v=3a5df2b80cc9)
- [市场报价 JSON](https://data.aibijia.org/products.json)
- [市场元数据 JSON](https://data.aibijia.org/meta.json)
- [App Store 官方订阅 JSON](https://data.aibijia.org/apple_subscriptions.json)
- [官方 GitHub 仓库](https://github.com/ka-pi-ba-la/AIbijia)
- [LDXP 公开店铺前端 bundle](https://pay.ldxp.cn/package/shop/assets/index.32beeed8.js)
- [Aisou 商品公开页](https://aisou.pro/item/30)
- [RedeemGPT/ai-buy 商品公开页](https://talkai.cyou/item/46)
