# PriceAI 与 Aibijia 的数据源收录机制拆解

> 调研时间：2026-09-02（Asia/Shanghai）  
> 调研对象：[PriceAI](https://priceai.cc/) 与 [Aibijia](https://aibijia.org/)  
> 目标：判断它们的数据从哪里来、如何进入库、如何更新，以及哪些结论只是基于公开接口和前端代码的推断。

## 一页结论

这类平台不是维护一张人工价目表，而是把两套完全不同的数据管线拼在一起：

1. **灰市/第三方商家报价**：先发现或接收商家 URL，再按发卡系统类型选择采集适配器，从商店 API 或商品页提取标题、价格、库存、商品链接；随后用关键词和规则把杂乱商品映射到 ChatGPT、Claude、Gemini、Grok 等标准商品。
2. **官方地区订阅价**：按 App ID、国家/地区和套餐抓取 App Store 等公开价格页，再做套餐识别、币种解析和人民币汇率换算。这条管线与商家报价是分开的。
3. **收录不是全自动**：两站都允许用户/商家提交平台链接。PriceAI 公开说明是“自动检查与试采集 + 集中审核”；Aibijia 只暴露了提交表单，并明确提醒可能无法及时人工处理。
4. **展示层吃的是快照，不是实时查询每个商家**：两站都先生成结构化快照，再由前端读取；PriceAI 还发布不可变版本快照和 `latest.json` 指针，Aibijia 则把 `products.json`、`meta.json`、`apple_subscriptions.json` 放在独立数据域名。
5. **PriceAI 的自动化程度明显更高**：其公开商家接口当时返回 448 个来源，其中 350 个归入 `shopApi` 采集组，约占 **78.1%**；还公开区分异次元/Kami、独角数卡、通用 HTML、自研等适配器。Aibijia 的公开快照只有最终结果，没有公开采集器类型，因此不能据此断言每个商家的具体抓取方式。

## 1. PriceAI：数据是怎么进来的

### 1.1 商家报价的来源

[公开商家目录接口](https://priceai.cc/api/merchants?limit=200&offset=0) 返回了来源入口、店铺 URL、采集器类型、采集成功时间、最新发现时间、商品数、库存数、健康状态和连续失败次数等字段。对 3 页共 448 个商家做汇总后：

| 采集器/采集组 | 数量 | 含义 |
|---|---:|---|
| `shopApi` 组 | 350 | 292 个通用 Shop API，加 58 个 `16688_shop_api` |
| `kami` | 29 | 异次元/Kami 类系统适配器 |
| `dujiao` | 23 | 独角数卡适配器 |
| 其他/自研 | 46 | 通用 HTML、Unicorn、贝贝、公开商品 API，以及未公开类型 |

这说明其主力不是用浏览器逐页“看价格”，而是先识别商店系统，再调用相应的机器可读接口；只有没有标准接口时才落到 HTML 解析或专站适配器。

公开商家页还显示了 `healthy`、`retrying`、`failing` 等状态，以及 `lastSuccessAt`、`latestSeenAt`、`consecutiveFailures`。因此可以确认它不仅采价格，也持续监测源是否还活着。

### 1.2 新商家如何被收录

[商家频道页](https://priceai.cc/channels) 的前端代码公开了 `POST /api/submissions` 的申请表单，字段包括：

- 店铺首页/入口 URL，而不是单个商品链接；
- 可选店铺名、QQ/Telegram 联系方式；
- 主营商品与价格优势说明；
- 蜜罐字段用于拦截机器人。

页面明确给出的流程是：

```text
商家或用户提交入口 URL
        ↓
自动检查目录规模、AI 相关性、近期价格快照
        ↓
试采集
        ↓
集中审核
        ↓
符合条件后进入比价库
```

页面还写明优先小目录、自营、有价格优势的商店，暂不收录代理/分销、重复渠道和大量同质商品。这意味着“自动采集”之前仍有来源准入与去重治理。

### 1.3 抓到商品后如何标准化

PriceAI 的[公开快照 Schema](https://priceai.cc/price-radar-v1.schema.json)把源站商品整理成两层：

- 标准商品层：`product_type`、`spec`、平台、最低价、报价数、在售数、最近发现时间；
- 报价层：`source_id`、来源名、店铺名、原始标题、价格、币种、库存状态、原链接。

源站标题往往混有“Plus / Pro / 5x / 20x / 代充 / 成品号 / 共享 / 反代 / 接码”等自由文本。公开输出已经把它们分配到标准商品与预设筛选条件，说明中间至少有一层规则或人工维护的商品映射。公开资料不能证明是否使用了大模型分类器，因此应把“LLM 自动分类”视为未证实。

### 1.4 快照与更新

PriceAI 提供了[机器可读发现文件](https://priceai.cc/.well-known/price-radar.json)，其中声明：

- 最新快照入口为 `https://data.priceai.cc/latest.json`；
- 数据格式遵循公开 Schema；
- 建议刷新间隔为 300 秒；
- 无需鉴权。

[公开数据说明](https://priceai.cc/price-radar-api.md)进一步说明：消费者应先取 `latest.json`，再取不可变 `snapshot_url`；公开 feed 约 5 分钟生成一次；超过 2 小时的商品快照会被视为陈旧，某些筛选预设会直接省略。

这能确认的是**发布快照约 5 分钟一版**，不能推出每家店都恰好每 5 分钟抓一次。不同源很可能有不同采集频率，失败源还会重试或降频。

### 1.5 官方订阅价格

[官方地区价页](https://priceai.cc/official-prices)把来源分为 iOS Store、Google Play 和官网直购，并在页面结构化元数据中写明测量方法是“官方公开价格页、公开价格 feed 与汇率估算”。页面还披露数据从 Supabase 与官网公开快照同步。

细节上：

- iOS 可得到精确 SKU 地区价并参与最低价比较；
- Google Play 的公开商店页通常只能稳定给出应用内购价格区间，无法匹配精确 SKU 时不参与最低价；
- 官网直购来自 ChatGPT、Google AI 等官方价格页；Claude 某些地区只保留官方美元基准，X 相关产品使用官方国家价表。

这条“官方价”数据管线与卡网商家报价应当独立维护，不应该混成同一最低价。

### 1.6 官方 API 与中转 API

[官方 API 页](https://priceai.cc/official-api)的数据集直接附官方文档/定价页作为来源，页面披露底层数据源为 Supabase。公开字段包含价格、缓存价、额度/速率限制、适用工具、局限和更新时间；个别动态页面注明通过浏览器核验。

[中转 API 页](https://priceai.cc/api-transit)又是第三条管线，公开数据里能看到：

- `sourceType: manual_collected`：站点资料先人工收录；
- `collectorKind: ai_transit_snapshot`：读取中转站公开快照；
- `public_model_catalog`：从公开模型目录取倍率/价格；
- `public_status`：从站点公开监测页取可用率；
- `priceai_probe`：PriceAI 自己使用 API Key 做探测并记录 7 日样本、延迟和成功率。

因此中转 API 的“价格”和“稳定性”不是同一来源：价格可能来自站点自报的公开目录，稳定性则来自站点公开监测或 PriceAI 主动探测。这个区分非常重要。

## 2. Aibijia：数据是怎么进来的

### 2.1 前端不直接查商家，而是读取独立快照

Aibijia 首页前端公开配置了三个数据入口：

- [products.json](https://data.aibijia.org/products.json)：第三方商家报价；
- [meta.json](https://data.aibijia.org/meta.json)：生成时间、商品数、报价数；
- [apple_subscriptions.json](https://data.aibijia.org/apple_subscriptions.json)：官方 App Store 地区订阅价。

前端还有同路径 `data/*.json` 作为 Cloudflare Pages 或本地预览的回退文件。由此可以确认其架构是“后台刷新数据 → 生成静态 JSON → 上传数据域名/R2 → 前端读取”，不是用户打开页面后临时抓取所有源站。

2026-09-02 的 `meta.json` 显示：

```json
{
  "product_count": 4,
  "offer_count": 207,
  "source": "local_refresh_to_r2"
}
```

`local_refresh_to_r2` 很像本地任务刷新后上传 Cloudflare R2 的内部任务名；这是对公开字段的合理解释，但后台脚本和调度没有开源，无法确认它究竟跑在个人电脑、服务器还是 CI。

### 2.2 第三方商家报价的实际构成

对当时的 207 条报价按最终商品链接域名统计：

| 商品落地域名 | 报价数 | 占比 |
|---|---:|---:|
| `pay.ldxp.cn` | 158 | 76.3% |
| `catfk.com` | 31 | 15.0% |
| `talkai.cyou` | 7 | 3.4% |
| `kapay.shop` | 4 | 1.9% |
| `aisou.pro` | 2 | 1.0% |
| `bei-bei.shop` | 2 | 1.0% |
| `faka.redeemgpt.com` | 2 | 1.0% |
| `ultra.makelove.cloud` | 1 | 0.5% |

商品字段包括 `platform_name`、`source_store_name`、原始标题、价格、币种、`in_stock / low_stock / out_of_stock`、商品 URL 和风险/展示标签。快照里有 67 条在售、39 条低库存、101 条缺货。

可以确认 Aibijia 聚合了这些公开商店商品；但公开 JSON 没有 PriceAI 那样的 `collectorKind`。进一步核验 [LDXP 公开前端 bundle](https://pay.ldxp.cn/package/shop/assets/index.32beeed8.js) 后发现，其店铺级 `/shopApi/Shop/goodsList` 能整店返回 `goods_key`、标题、价格和 `extend.stock_count`。Aibijia 中“AI小店”的 75 条报价，与源站整店 82 个卡密商品绝大多数可按 `goods_key`/URL 对上。

这强力支持“审核一个店铺源 → 批量拉整店商品 → 筛选 AI 相关商品 → 生成统一快照”，而不是人工逐条抄价。不过 Aibijia 后端没有开源，所以“它确实调用了这个接口”仍应标为高可信推断；其他独立站可能使用平台 API、JSON-LD、页面内嵌 JSON、HTML 抓取或人工补录，无法逐站确定。

### 2.3 新来源如何加入

Aibijia 首页有“提交平台”表单，提交到 `https://www.aibijia.org/api/source-submissions`，只要求平台 URL 和推荐理由。页面提示维护者精力有限、可能不能及时处理，必要时可先去论坛发帖。

[服务条款](https://aibijia.org/terms/)明确写明内容主要来自“公开网络信息与用户投稿”，并保留调整排序逻辑、审核规则和下架内容的权利。这能确认其来源发现至少有三条：

1. 维护者主动寻找公开平台；
2. 用户/商家提交 URL；
3. 社区帖子提供线索，再由维护者处理。

公开 `app.js` 的提交成功文案是“已收到，审核后会在页面展示”。因此投稿只负责发现候选源，准入需要人工审核。没有证据表明提交后会像 PriceAI 一样立即自动试采；Aibijia 更像人工选源、后台批量刷新。也没有发现 Feed URL、Webhook、API Key 或商家后台等公开接入机制。

### 2.4 官方地区价来源非常透明

`apple_subscriptions.json` 的顶层 `source` 明确为 `app_store_public_pages_sharded_merge`。当时的数据包括：

- 4 个 App：ChatGPT、Claude、Gemini、Grok；
- 51 个国家/地区；
- 14 个套餐；
- 644 条地区套餐价格记录。

每条地区价都保留：App ID、国家代码、原始价格文本、原币金额、App Store 证据 URL、抓取时间、人民币价格、汇率日期和汇率来源。汇率来源公开为 [Frankfurter](https://frankfurter.dev/)，并区分实时汇率与回退汇率。

这条管线可以还原为：

```text
配置 App ID 与套餐名
        ↓
按国家/地区分片请求 Apple App Store 公开页
        ↓
解析应用内购名称与当地价格
        ↓
把原始标题映射到标准套餐
        ↓
调用/读取 Frankfurter 汇率
        ↓
换算 CNY，合并分片，发布 JSON 快照
```

这部分是 Aibijia 最透明、也最容易复刻的数据管线。

### 2.5 更新频率、库存与去重边界

市场 JSON 的 HTTP `max-age=60, must-revalidate` 只是边缘缓存策略，不能当成“一分钟抓一次”。Aibijia 前端只在页面加载时取一次 JSON，没有对价格做定时轮询；官网也没有公布 cron 或刷新 SLA。因此准确表述只能是“后台定时生成快照，具体周期未公开”。

LDXP 上游有数值 `stock_count`，其自身页面会按库存量显示不同档位；Aibijia 把不同上游统一压成 `in_stock / low_stock / out_of_stock` 三态，但具体阈值未公开。

本次 207 条报价 URL 全部唯一，说明至少做到了 URL 级唯一；但仍有 5 组同店同标题、不同 URL 的重复商品，前端也没有语义去重逻辑。因此不能把当前输出理解为严格的“同一 SKU 只保留一条”。

## 3. 两个平台的关键差异

| 维度 | PriceAI | Aibijia |
|---|---|---|
| 商家源规模 | 448 个商家源；公开采集器与健康状态 | 207 条报价、8 个落地域名；不公开采集器 |
| 主力采集方式 | 约 78.1% 来源归入 Shop API 组 | 最终快照可见，采集适配器不可见 |
| 来源发现 | 商家申请 + 自动预检/试采 + 集中审核 | 用户提交/论坛线索 + 维护者处理 |
| 官方地区价 | iOS、Google Play、官网公开价 | Apple App Store 公开页为主 |
| 更新发布 | 不可变快照 + latest 指针；公开 feed 约 5 分钟 | `local_refresh_to_r2` 静态 JSON 快照 |
| 源健康 | 公开成功时间、失败次数、重试/失败状态 | 只公开商品库存状态和快照时间 |
| 数据开放度 | Schema、发现文件、文档、商家 API | JSON 快照直接公开，后台采集逻辑私有 |
| 审核治理 | 明确排除代理、重复、大量同质商品 | 条款称有审核/下架权，但规则较少 |

## 4. 我认为它们真实的后台流水线

以下是把公开事实连接起来后的最小可行架构；其中“规则分类/人工纠错”是基于输出形态的高可信推断：

```text
主动发现 / 用户提交 / 商家自报
                 ↓
URL 规范化、域名去重、来源准入审核
                 ↓
识别发卡系统或站点类型
                 ↓
标准 API 适配器 ─┬─ 独角数卡 / 异次元 / Shop API
HTML/专站适配器 ─┤
官方商店采集器 ──┘  App Store / Google Play / 官网
                 ↓
保留原始标题、价格、币种、库存、链接、抓取时间
                 ↓
商品归类与属性抽取
（品牌、套餐、时长、交付方式、共享/独享、质保、渠道）
                 ↓
去重、异常价过滤、陈旧数据处理、人工纠错
                 ↓
标准商品 / 报价 / 商家 / 快照数据表
                 ↓
发布静态 JSON 或查询 API → 前端排序与筛选
```

## 5. 对我们做产品的直接启示

1. **最先做的不是爬虫，而是适配器框架。** 先覆盖 2–3 个占比最高的发卡系统，就能吃到大部分供给；为每个适配器统一输出 `source / store / offer / price / currency / stock / fetched_at / raw_payload_hash`。
2. **“原始商品”和“标准商品”必须分表。** 源标题不能直接当产品名，否则代充、成品号、共享、接码和 API 中转会被错误地放进同一个最低价。
3. **收录、采集、审核要做成状态机。** 建议状态：`submitted → prechecked → trial_crawled → review → active → degraded → removed`，并保留失败原因。
4. **不同数据类型要分频道。** 官方订阅价、灰市卡网价、官方 API 价、中转 API 价不能共用一个“最低价”；风险、稳定性和可比口径完全不同。
5. **快照比实时联查更稳。** 采集任务异步跑，前端只读已验证快照；保留不可变版本，才能做历史价格、回滚和审计。
6. **公开“证据等级”。** 建议至少区分：官方公开页、商家公开 API、商家 HTML、商家自报、平台主动探测、人工核验。用户会更相信“这条价从哪来”，而不是一个没有解释的数字。
7. **商家提交只负责发现，不应直接上线。** 自动试采、重复检测、同质商品阈值、风险词命中和人工审核缺一不可。
8. **商业化与排序隔离。** 两站都有推广/导流痕迹；如果做赞助位或 affiliate，必须显著标记，并禁止赞助关系参与自然排序权重。

## 6. 事实边界与仍待验证项

已经由公开页面、接口或前端代码直接确认：

- 两站都采用后台生成快照、前端读取的模式；
- 两站都有 URL 提交入口；
- PriceAI 公开了采集器类型、源健康与审核流程；
- Aibijia 的官方地区价来自 App Store 公开页，汇率来自 Frankfurter；
- Aibijia 的商家快照主要集中在 LDXP 与 catfk 等发卡入口。

尚不能从公开资料确认：

- 两站后台的完整源代码与调度器；
- Aibijia 各商家的具体 API/HTML 适配器；
- 商品分类是否用了 LLM，还是纯规则与人工维护；
- 每个商家真实抓取频率；
- 异常价、重复商品与恶意自报的全部风控规则；
- 商家是否会为“被收录”付费，以及商业关系是否影响自然排名。

## 主要一手资料

- PriceAI：[首页](https://priceai.cc/) · [商家频道](https://priceai.cc/channels) · [商家目录 API](https://priceai.cc/api/merchants?limit=200&offset=0) · [公开数据文档](https://priceai.cc/price-radar-api.md) · [Schema](https://priceai.cc/price-radar-v1.schema.json) · [官方地区价](https://priceai.cc/official-prices) · [官方 API](https://priceai.cc/official-api) · [中转 API](https://priceai.cc/api-transit)
- Aibijia：[首页](https://aibijia.org/) · [服务条款](https://aibijia.org/terms/) · [商品快照](https://data.aibijia.org/products.json) · [元数据](https://data.aibijia.org/meta.json) · [Apple 地区价快照](https://data.aibijia.org/apple_subscriptions.json) · [公开仓库](https://github.com/ka-pi-ba-la/AIbijia)
