# AI 订阅 / API 比价与渠道验证网站：2026 SEO 官方规范研究

**研究日期：** 2026-09-04  
**适用对象：** 提供 AI 订阅价格比较、官方价与第三方渠道价对比、API 价格比较、渠道验证、价格历史与地区差异的网站  
**地域与搜索引擎：** 中国（百度、Bing、Google）及欧美（Google、Bing）  
**证据边界：** 只采用 Google Search Central、Bing Webmaster Tools / Microsoft Bing 官方博客、百度搜索资源平台的一手资料。文中的“本站建议”是把官方规范应用到该业务后的工程判断，不代表搜索引擎承诺排名。

## 一、结论先行

这类网站的 SEO 核心不应是批量生成“产品 × 国家 × 货币 × 渠道 × 折扣”页面，而应是让每个可索引 URL 真正完成一个决策任务：**这个产品当前官方价是多少、有哪些可验证渠道、总成本如何换算、适用地区和限制是什么、信息何时及如何核验。**

Google 的技术底线是：爬虫未被阻止、页面返回 HTTP 200、页面含可索引内容；满足底线并不保证收录。[Google Search 技术要求](https://developers.google.com/search/docs/essentials/technical) Bing 要求重要 URL 可经可抓取内链到达、页面聚焦单一主题、事实能在页面上独立核验，并明确警告薄内容、纯联盟跳转页和缺乏监督的批量自动生成内容可能失去排名或索引资格。[Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) 百度把生产者可信度、浏览体验、内容丰富度/专业度和用户认可列为优质内容维度，并将死链、空白、内容空短等归入低质页面。[百度搜索优质内容指南](https://ziyuan.baidu.com/college/articleinfo?id=2947)

因此，本站 2026 年应采用以下总原则：

1. **先建设少量高价值实体页，再扩张程序化页面。** 每个索引页必须有真实报价、独有分析或可验证数据，不能只是换关键词、地区或币种。
2. **把搜索页、排序页和大多数筛选组合留在站内工具层，不进入搜索索引。** 只把有稳定需求且有独立内容价值的筛选组合固化为落地页。
3. **公开页必须在初始 HTML 中提供关键文本。** 价格表、渠道状态、更新时间、来源与限制不能只在登录后、客户端 API 返回后或图片里出现。
4. **同一产品 / 套餐只有一个主 URL。** 排序、追踪、币种显示、会话和联盟参数不得产生新的索引版本。
5. **结构化数据必须与页面实时可见内容一致。** 它是理解与富结果资格信号，不是排名保证；绝不把内部“渠道可信分”伪装成用户评分。
6. **多语言必须是真本地化。** 中文、美国英语、英国英语、德语、法语页面使用独立 URL，并体现当地货币、税费、支付方式、地区限制和可用渠道，而不是机械翻译同一模板。

## 二、优先级清单

| 优先级 | 工作 | 验收结果 |
|---|---|---|
| P0 | 让产品页、套餐页、API 模型页由 SSR / 静态生成输出完整首屏 HTML | 关闭 JavaScript后仍能看到产品名、价格表、更新时间、来源和主要限制；返回 200 |
| P0 | 建立唯一 URL、self-canonical、参数治理 | 同一内容的排序、UTM、联盟、货币显示 URL 都指向同一规范 URL；Sitemap 只列规范 URL |
| P0 | 收紧索引范围 | 站内搜索、空筛选、无报价页、个人页、登录页、跳转页不进入索引；空组合返回 404 或明确 noindex |
| P0 | 补全价格证据层 | 每条报价展示原币、计费周期、税费/手续费口径、来源链接、采集/核验时间、渠道状态和限制 |
| P1 | 建立“首页 → 频道 → 实体详情”的扁平结构及上下文内链 | 所有重要页至少有一个标准 `<a href>` 文本链接；无孤岛页 |
| P1 | 为首页、频道、产品、API 与指南页设计唯一 title / description | 无空、重复、堆砌或与正文不一致的元数据 |
| P1 | 部署 WebSite、Organization、BreadcrumbList；条件式部署 Product / Offer | Rich Results Test、Bing URL Inspection 无错误；字段与页面可见内容一致 |
| P1 | 分语言 / 页面类型生成 XML Sitemap，并接入三家站长平台 | 可分别观察中文、英文、德文、法文和产品/API页的发现、索引情况 |
| P1 | Bing 使用 IndexNow；百度用普通收录 API / Sitemap；Google 用 Sitemap 与 URL Inspection | 新增、实质更新、删除的 URL 有对应通知与处理记录 |
| P2 | 上线 en-US、en-GB、de-DE、fr-FR 的真实本地化与 hreflang | 每组替代页互相回链、含 self 与 x-default；canonical 指向同语言主 URL |

## 三、页面可索引性与 JavaScript

### 3.1 应进入索引的页面

- 频道页：AI 订阅价格、ChatGPT 订阅、Claude 订阅、Gemini 订阅、API 价格、API 中转 / 渠道目录。
- 单一产品或套餐页：例如 ChatGPT Plus、Claude Pro、Gemini Advanced；页面须围绕一个主要实体。
- 单一模型 / API 价格页：例如 GPT、Claude、Gemini 各模型的输入、输出、缓存等真实计费维度。
- 有独立需求且有足够数据的比较页：例如 `ChatGPT Plus vs Claude Pro`，必须有真实差异分析，不能只是拼接两个详情页。
- 有明确编辑价值的指南、核验方法、费用口径和地区政策页。
- 渠道详情页：前提是有独立的核验记录、经营主体 / 付款 / 退款 / 地区 / 风险信息，而不只是一个外链按钮。

Google 要求页面公开、可访问、返回 200 且含可索引文本；登录墙后的数据不能承担自然搜索落地页的主要内容。[Google Search 技术要求](https://developers.google.com/search/docs/essentials/technical) Google 虽能执行 JavaScript，但服务端渲染或预渲染仍有利于用户和爬虫，也能覆盖不能执行 JavaScript 的其他爬虫；如果内容未出现在渲染 HTML 中，Google 无法索引。[Google JavaScript SEO 基础](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) 百度官方指南建议重要内容和链接使用文字，不要把希望搜索引擎识别的导航、标题和正文仅放在 JavaScript / Ajax 中。[百度搜索引擎优化指南 2.0](https://ziyuan.baidu.com/college/articleinfo/?id=197)

**本站建议：** 产品详情页应由 SSR / SSG 输出产品名、当前报价摘要、报价表前若干行、数据口径、最近核验时间和来源；客户端 JavaScript只负责筛选、排序、币种切换和局部刷新。不要给爬虫和用户返回不同的实质内容。

### 3.2 不应进入索引的页面

- 站内搜索结果，例如 `/search?q=...`。
- 任意组合的筛选与排序 URL，例如 `?country=...&currency=...&sort=...`。
- 追踪、联盟、会话、实验和分享参数 URL。
- 登录、注册、个人中心、收藏、提醒设置和付款回调页。
- 只做 302 / JavaScript 跳转的渠道出站页。
- 没有可用报价、只有一两句模板文字或与另一页实质重复的页面。
- 不存在、越界或无结果的分页 / 筛选组合。

Google 指出分面导航可能生成近乎无限的 URL，造成过度抓取并拖慢新内容发现；不需要索引的组合可阻止抓取，需要索引的组合则应固定参数顺序，无结果组合返回真实 404。[Google 分面导航抓取指南](https://developers.google.com/crawling/docs/faceted-navigation) 百度也把大量参数不同、内容雷同的动态 URL 称为“蜘蛛黑洞”，建议只开放有检索价值的筛选页、屏蔽无价值排序参数。[百度：巧用 Robots 避免蜘蛛黑洞](https://ziyuan.baidu.com/college/articleinfo?id=1180)

**注意：** `robots.txt` 用于控制抓取，不是可靠的去索引工具。Google 与 Bing 都说明：如要让搜索引擎读取 `noindex`，页面必须允许被抓取；被 robots.txt 禁止抓取的 URL 仍可能以仅 URL 形式出现。[Google robots meta 规范](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) [Bing robots meta 规范](https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240)

## 四、站点结构、URL 与内部链接

### 4.1 推荐信息架构

以下是原则示例，最终 slug 应与现有路由保持一致，不应仅为 SEO 频繁改 URL：

```text
/{locale}/
├── subscriptions/                  AI 订阅频道
│   ├── chatgpt/
│   │   └── chatgpt-plus/           单一套餐实体页
│   ├── claude/claude-pro/
│   └── gemini/gemini-advanced/
├── api-pricing/                    API 价格频道
│   ├── openai/{model}/
│   ├── anthropic/{model}/
│   └── google/{model}/
├── channels/                       渠道目录
│   └── {channel-slug}/             渠道核验详情
├── compare/
│   └── chatgpt-plus-vs-claude-pro/ 有独立分析的比较页
├── methodology/                    价格与渠道核验方法
└── guides/                         高价值指南
```

Google 建议使用可理解、可抓取的 URL 和标准 `<a href>` 链接，相关的内部链接锚文本有助于用户与 Google 理解页面。[Google URL 结构指南](https://developers.google.com/search/docs/crawling-indexing/url-structure) [Google 可抓取链接指南](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) 百度建议采用扁平的“首页—频道—详情页”树形结构，同时通过上下级与相关内容链接形成网状结构；每个页面至少应由一个文本链接到达，重要内容应处于较浅层级。[百度搜索引擎优化指南 2.0](https://ziyuan.baidu.com/college/articleinfo/?id=197) Bing 同样要求每个重要 URL 可由可抓取内链到达，并使用标准 `<a href>` 与有意义锚文本。[Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)

### 4.2 本站内部链接规则

- 首页直接链接到最重要的订阅、API 和渠道频道，而不是只提供搜索框。
- 频道页链接全部 P0 产品 / 套餐页，并按真实类别分组。
- 产品页必须链接：官方定价来源、同品牌其他套餐、相关比较页、可用地区说明、核验方法、每个被列出的渠道详情页。
- 渠道页必须链接回它实际提供的产品页，不要制造全站统一的无关产品链接。
- API 模型页应链接同供应商相邻模型与统一计费口径说明；跨供应商比较只在真正可比较时链接。
- 使用具体锚文本，如“ChatGPT Plus 当前价格与渠道”，避免大量“点击这里”“更多”。
- Breadcrumb 要真实可点击，并与页面可见层级一致。

## 五、Title、主标题与 Meta Description

Google 要求每页有描述性、简洁的 `<title>`，避免模糊、冗长和关键词堆砌，并让页面主视觉标题 / H1 与之协调；Google 会综合 `<title>`、H1、显著文本、锚文本等自动生成标题链接，因此写入 title 不代表一定原样展示。[Google 标题链接指南](https://developers.google.com/search/docs/appearance/title-link) 百度要求每页标题唯一、准确、简明，反对虚假“官网”、无法兑现的功能承诺与关键词堆砌；其推荐结构是核心词加不超过三个修饰词，站点名置后。[百度搜索网页标题规范](https://ziyuan.baidu.com/college/articleinfo?id=2726)

### 5.1 推荐模板

| 页面类型 | 中文 title 示例 | 英文 title 示例 |
|---|---|---|
| 首页 | `AI 订阅与 API 价格对比、渠道核验 - {品牌}` | `AI Subscription & API Price Comparison - {Brand}` |
| 产品 / 套餐页 | `ChatGPT Plus 价格、购买渠道与风险对比 - {品牌}` | `ChatGPT Plus Price, Plans & Verified Sellers - {Brand}` |
| API 模型页 | `{模型名} API 价格：输入、输出与缓存费用 - {品牌}` | `{Model} API Pricing: Input, Output & Cache Costs - {Brand}` |
| 渠道页 | `{渠道名} 靠谱吗？价格、付款与退款核验 - {品牌}` | `{Seller} Review: Pricing, Payment & Refund Verification - {Brand}` |
| 比较页 | `ChatGPT Plus vs Claude Pro：价格与功能对比 - {品牌}` | `ChatGPT Plus vs Claude Pro: Price & Feature Comparison - {Brand}` |

**不建议：** 在 title 中写会频繁失效的精确价格、“全网最低”“100% 靠谱”“官网”等无法持续证明或可能误导的承诺。这是基于标题必须准确、不过期和不误导的业务推论，而不是搜索引擎对普通商品价格 title 的单独禁令。

Google 主要从页面内容生成摘要，有时会采用 meta description；数据库型聚合站可以程序化生成 description，但必须页面特定、准确、可读且多样，不能是关键词串。[Google 搜索摘要与 Meta Description](https://developers.google.com/search/docs/appearance/snippet) 百度建议摘要准确概括正文、避免广告营销和无关内容，中文约 50 字，并保持源码中的站点名与页面实际站点名一致。[百度搜索基础信息设置规范](https://ziyuan.baidu.com/college/articleinfo?id=3405) Bing 指出缺失、重复或过短的 title 与 meta description 会降低索引、排名及被 AI 引用的可靠性。[Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)

**程序化 description 示例：**

> 比较 ChatGPT Plus 的官方价与 {有效渠道数} 个已核验渠道，查看原币价格、折算总价、付款方式、地区限制、退款风险与最近核验时间。

生成前必须确认 `{有效渠道数}` 与页面当前可见数据一致；无有效报价时不要生成“有渠道可比”的描述。

## 六、Canonical、Sitemap 与 Robots

### 6.1 Canonical

- 每个可索引主页面放 self-referencing canonical。
- UTM、联盟、排序、显示币种、会话等版本 canonical 到不带这些参数的实体主 URL。
- 永久淘汰的重复 URL 用服务端 301 到主 URL；canonical 不是替代所有重复治理的万能方案。
- Sitemap、内部链接、canonical 与 hreflang 必须一致指向 HTTPS 规范 URL。
- 每个语言页面 canonical 指向同语言版本，不要把德语、法语或中文页 canonical 到英文页。

Google 将重定向和 `rel="canonical"` 视为强规范化信号、Sitemap 为弱信号，并建议在规范页本身放 self-canonical；不要用 robots.txt 或临时移除工具做规范化。[Google 规范 URL 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) Bing 官方也要求合并重复 URL，并使用 canonical、参数控制和一致 URL 结构；canonical 不能代替从源头解决重复。[Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a) 百度官方建议同一内容只有一个 URL，其他形式 301 到目标 URL；百度的部分官方资料也支持每页唯一 canonical。[百度：符合搜索抓取习惯的网站](https://ziyuan.baidu.com/college/articleinfo?id=27) [百度：Canonical 指南](https://ziyuan.baidu.com/college/articleinfo?id=2519)

### 6.2 XML Sitemap

- 只列出返回 200、允许索引、内容完整且为 canonical 的 URL。
- 按语言和页面类型拆分，例如 `sitemap-zh-products.xml`、`sitemap-en-api.xml`，方便监控，不代表排名加权。
- `lastmod` 只在价格、报价集合、可用性、正文分析等发生实质变化时更新；不要每次构建都刷新全部时间。
- 在 `robots.txt` 中声明 Sitemap，并分别提交到 Google Search Console、Bing Webmaster Tools 与百度搜索资源平台。
- Google 单个 Sitemap 上限为 50 MB（未压缩）或 50,000 URL，超过后使用 Sitemap index。[Google Sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- Bing 支持 XML、RSS、Atom 和文本 Sitemap，可在 Webmaster Tools 查看处理状态与错误。[Bing Sitemap 指南](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)
- 百度当前公开的普通收录工具文档说明可用 API、手动和 Sitemap 提交；其文档同时提示该工具不处理 Sitemap index，并存在站点质量相关配额。因此给百度提交时应使用平台当前界面允许的普通 XML Sitemap 或 API，不应直接假设 Google 的 Sitemap index 可复用。[百度平台工具使用说明](https://ziyuan.baidu.com/college/articleinfo?id=3076)

### 6.3 Robots 与 Noindex 分工

建议允许抓取 CSS、JavaScript、图片以及所有可索引内容；禁止后台、个人数据、无限筛选和明显无价值参数。对已公开且需要从索引移除的 HTML，先保证爬虫可访问，再加 `noindex`；确认去索引后，若仍需节省抓取，可再调整 robots。Google 与 Bing 均明确说明爬虫必须能访问页面才能看到 `noindex`。[Google robots meta 规范](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) [Bing robots meta 规范](https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240)

示意规则应按真实路由测试后再发布：

```text
User-agent: *
Disallow: /account/
Disallow: /login/
Disallow: /api/private/
Disallow: /search
Disallow: /*?*sort=
Disallow: /*?*session=
Disallow: /*?*affiliate=
Sitemap: https://example.com/sitemap.xml
```

不要盲目 `Disallow: /*?*`：如果站点仍有需要索引的参数页，会一并阻断。Bing 提供 robots.txt 测试器，百度提供 Robots、抓取诊断和抓取异常工具，应在上线前逐类 URL 验证。[Bing robots.txt 指南](https://www.bing.com/webmasters/help/how-to-create-a-robots-txt-file-cb7c31ec) [百度平台工具使用手册](https://ziyuan.baidu.com/college/articleinfo?id=2008)

## 七、结构化数据适用性与限制

结构化数据只能描述页面的主要、可见内容。Google 明确表示正确标记不保证出现富结果，隐藏、误导或与主内容不一致的标记可能失去资格或触发人工处置；Google 推荐 JSON-LD。[Google 结构化数据通用规范](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) Bing 支持 JSON-LD 与 Microdata，并同样不保证富摘要展示；标记必须准确反映可见内容。[Bing 结构化数据说明](https://www.bing.com/webmasters/help/marking-up-your-site-with-structured-data-3a93e731)

| 类型 | 对本站适用性 | 使用方式 | 关键限制 |
|---|---|---|---|
| `WebSite` | 推荐 | 仅首页定义站点 `name`、`alternateName`、`url` | Google 的站点名称功能要求放在域名或子域首页，不是每页重复放一份。[官方文档](https://developers.google.com/search/docs/appearance/site-names) |
| `Organization` | 推荐 | 首页或 About 页声明真实名称、URL、Logo、联系方式与法律主体（有则填） | 只填真实、公开且一致的信息；无需每页重复。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/organization) |
| `BreadcrumbList` | 推荐 | 产品、API、渠道、比较和指南详情页 | 面包屑应代表典型用户路径，不必机械复制 URL 层级。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| `Product` + `AggregateOffer` | 条件适用，优先研究 | 单页围绕一个明确套餐 / 软件产品，且页面可见同一产品在多个渠道的最低价、最高价、币种和报价数量 | `AggregateOffer` 用于“同一产品的多个商家报价”，不能把不同套餐层级当作同一产品变体；必须有 `lowPrice`、`priceCurrency`，推荐 `highPrice`、`offerCount`。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) |
| `Product` + `Offer` | 条件适用 | 页面展示一个具体、当前可购买报价时 | 应提供真实 `price`、`priceCurrency`、`availability`、`url`；`priceValidUntil` 过期可能使产品摘要不展示。价格变化时同步页面与 JSON-LD。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) |
| Merchant listing | 通常不适用 | 仅当用户可直接在本站购买时评估 | Google 将“可直接购买”的页面与不能直接购买的产品摘要区分；仅做比较 / 跳转时更接近 Product snippet，而非 Merchant listing。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/product) |
| `SoftwareApplication` | 谨慎、通常不作为首选 | 只有页面主实体确为某个软件应用、页面可见应用信息且数据满足要求时 | Google 的软件应用富结果要求 `name`、`offers.price`，并且必须有 `aggregateRating` 或 `review` 之一；不能为了过校验虚构评分，也不能把渠道页或本站自身的比较工具错误标成被比较的软件。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/software-app) |
| `Review` / `AggregateRating` | 仅在有真实评测或真实用户评价时 | 产品评测页可标记页面上可见的真实评测；评分须与可见数据一致 | Google 禁止汇总其他网站评分，禁止虚假或未披露激励评价；评价应针对具体项目而不是类别 / 列表。[官方文档](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) |
| 内部“渠道可信分” | 不应标为 `AggregateRating` | 可作为页面可见的方法论评分展示 | 它不是消费者对产品的评价。应另行解释评分维度、证据与更新时间，避免让搜索引擎误解为星级评论。此结论是依据“标记必须准确反映可见内容、不得误导”的应用判断。[Google 通用规范](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) |
| `FAQPage` | 2026 年不值得为 Google 富结果实施 | 可保留普通 HTML FAQ 帮助用户，但无需期待 Google FAQ 富结果 | Google 已于 2026-05-07 停止 FAQ 富结果，并在 2026-06 移除文档。[Google 搜索文档更新记录](https://developers.google.com/search/updates) |

### 7.1 本站可采用的 Product / AggregateOffer 边界

适合标记的页面：`ChatGPT Plus` 作为单一套餐，页面确实列出多个商家的同类订阅报价，且“最低价、最高价、报价数、币种”在页面中可见。不同计费周期、账号归属、共享 / 独享、官方订阅 / 代充如实质不同，应在页面中明确区分，必要时建为不同产品实体，而不是为了制造更低的 `lowPrice` 混在同一个 AggregateOffer 中。

不适合标记的页面：全站“AI 订阅排行榜”、混合多个产品的分类页、仅显示“最低 ¥1 起”却不说明对应产品 / 周期 / 条件的页面、无库存或无有效渠道的模板页。

结构化数据发布流程应先小范围部署，用 Google Rich Results Test 与 URL Inspection、Bing URL Inspection 的 Markup 卡验证，再扩大覆盖。[Google Product structured data 发布建议](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) [Bing URL Inspection](https://www.bing.com/webmasters/help/URL-Inspection-55a30305)

## 八、内容质量、程序化页面与渠道可信度

Google 要求内容提供原创信息、研究或分析，清楚展示来源、作者 / 站点背景和第一手经验；大量生成无原创价值的页面、抓取并轻微改写、为操纵排名而使用 AI 批量生产，属于 scaled content abuse 风险。[Google 有帮助、可靠、以人为本的内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) [Google Spam Policies](https://developers.google.com/search/docs/essentials/spam-policies) Bing 也明确指出，缺乏监督与质控的规模化自动内容、无增值的抓取 / 转载、薄或纯联盟跳转页面可能被排除；每个页面应可独立核验关键事实。[Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)

### 8.1 每个产品 / 套餐页的最低内容合同

| 模块 | 必须显示的内容 |
|---|---|
| 实体定义 | 官方产品名、套餐名、计费周期、产品提供商、适用人群 |
| 官方基准 | 官方标价、原币、税费是否包含、地区可用性、官方来源链接、最近核验时间 |
| 渠道报价 | 渠道名、原币价格、折算价、手续费、付款方式、账号归属、共享 / 独享、履约方式、退款规则 |
| 可比口径 | 折算汇率与时间、按月 / 年折算方法、是否含税、首购 / 续费差异 |
| 渠道验证 | 最近验证时间、验证证据类型、历史状态、风险提示、异常 / 下架原因 |
| 独有价值 | 价格历史、变动解释、适用场景、选择建议或方法论，而不是复述官方说明 |
| 透明度 | 数据来源、采集方法、编辑 / 复核责任、利益关系 / 联盟佣金披露、纠错入口 |

百度将生产者可信度、内容专业与完整、页面体验列为优质维度，并强调重要信息应以文字呈现；有多个主题时应拆页或提供目录与锚点。[百度优质内容指南](https://ziyuan.baidu.com/college/articleinfo?id=3012) [百度基础信息设置规范（内页）](https://ziyuan.baidu.com/college/articleinfo?id=3412)

### 8.2 程序化建页的准入规则

只有同时满足下列条件才允许 `index,follow`：

1. 存在可识别的独立搜索意图，而非关键词排列组合。
2. 页面拥有真实且非空的数据集；不是把同一行报价复制到不同国家 / 货币 URL。
3. 与最相近页面相比，有实质不同的产品、报价、当地政策、支付方式、税费或编辑分析。
4. 页面可独立完成用户任务，无需返回搜索结果继续查找关键信息。
5. 有稳定主 URL、有效内链、唯一 title / description、可见更新时间与来源。
6. 由自动检测和人工抽样共同做质量控制。

未达到门槛时：合并到更强的频道 / 产品页，或保持 `noindex,follow`；不存在的组合返回 404。不要通过改写同义词、替换城市 / 国家名或机械翻译来制造“独特”页面。Google 2026 的 AI 搜索指南也明确反对为每个查询变体批量建页，并指出高数量页面本身不会提高网站质量或相关性。[Google 生成式 AI 搜索优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

### 8.3 价格、时间与来源可信度

- 每个价格显示“采集时间”或“最近核验时间”，并说明时区。
- 同时保留原始币种与折算价；披露汇率来源与换算时间。
- 明确税费、平台费、支付手续费、首月优惠、续费价和最低购买周期。
- 来源链接尽量指向对应官方定价页或渠道具体报价页，而不是网站首页。
- 报价过期、渠道失效或地区不可用时，页面数据和结构化数据一起更新；删除 URL 时向 Bing IndexNow 提交删除通知。
- 内容页显示真实的“发布 / 更新”日期；只有实质更新才改 `dateModified` 和可见日期。Google 明确反对在内容没有显著变化时修改日期来伪装新鲜度，并建议显著显示真实发布日期或最后更新时间。[Google 以人为本内容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) [Google Byline Date 指南](https://developers.google.com/search/docs/appearance/publication-dates)
- 百度认为落地页时间因子是收录、展现和排序的重要参考，时间标注不清或无时间不利于展示。[百度基础信息设置课程复盘](https://ziyuan.baidu.com/college/articleinfo?id=3424)
- Bing 要求事实、定义和重要信息在 URL 上明确可见并可独立核验；及时通知更新有助于减少搜索与 Copilot 中过时引用。[Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)

## 九、国际化与 Hreflang

### 9.1 URL 与本地化策略

推荐为每种语言 / 地区提供稳定、可分享的独立 URL，例如：

```text
/zh-cn/subscriptions/chatgpt-plus/
/en-us/subscriptions/chatgpt-plus/
/en-gb/subscriptions/chatgpt-plus/
/de-de/abos/chatgpt-plus/
/fr-fr/abonnements/chatgpt-plus/
```

页面不仅翻译文字，还应本地化：币种、税费 / VAT、付款方式、官方可用性、地区限制、退款条款、当地真实渠道和当地常用搜索表达。Bing 官方指出，只有模板化而没有实质市场差异的本地化可能形成重复内容，建议加入术语、示例、法规或产品差异，并用 hreflang 指示区域。[Bing：重复内容与 AI 搜索可见性](https://blogs.bing.com/webmaster/December-2025/Does-Duplicate-Content-Hurt-SEO-and-AI-Search-Visibility)

### 9.2 Hreflang 实施规则

- 使用 `zh-CN`、`en-US`、`en-GB`、`de-DE`、`fr-FR`；语言代码为 ISO 639-1，可选地区代码为 ISO 3166-1 Alpha 2。
- 每个替代页列出自己及所有其他替代页。
- 替代关系必须双向；缺少回链的配对可能被忽略。
- URL 必须是完整绝对 HTTPS URL。
- 提供 `x-default` 给语言选择页或默认全球页。
- HTML `<head>`、HTTP Header、XML Sitemap 三种方式对 Google 等效，选一种稳定维护即可；不要为了“更强”重复三套而增加不一致风险。
- canonical 指向同语言规范页；Google 明确建议 hreflang 页面使用相同语言的 canonical。

以上均来自 [Google 多语言 / 多地区页面指南](https://developers.google.com/search/docs/specialty/international/localized-versions) 与 [Google Canonical 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)。Google 说明它通过页面正文判断语言，而不是依赖 `hreflang` 或 HTML `lang` 来检测语言；因此不能用 hreflang 挽救正文未翻译或混杂语言的页面。[Google 多语言 / 多地区页面指南](https://developers.google.com/search/docs/specialty/international/localized-versions)

## 十、提交、监控与诊断

### 10.1 Google

1. 在 Google Search Console 验证域名资源。
2. 提交只含 canonical、200、可索引 URL 的 Sitemap / Sitemap index。
3. 用 URL Inspection 抽查首页、频道、产品、API、渠道、比较及每种语言页面的 Live Test 与已索引版本。
4. 监控 Page Indexing、Sitemaps、Performance（Query / Page / Country）、Rich Result、Manual Actions、Security Issues 与 Core Web Vitals。
5. 重大模板发布后检查；平时至少每月检查一次。Google 官方也建议约每月或站点内容变更时检查 Search Console。[Google Search Console 入门](https://developers.google.com/search/docs/monitor-debug/search-console-start)

### 10.2 Bing

1. 在 Bing Webmaster Tools 验证站点；也可从已验证的 Google Search Console 导入站点与 Sitemap。[Bing 添加与验证站点](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b)
2. 提交 Sitemap。
3. 对新增、实质更新、删除的 URL 接入 IndexNow。Bing 将 IndexNow 列为强烈推荐，建议及时、流式而非集中批量通知；Sitemap 仍用于完整发现。[Bing URL Submission / IndexNow](https://www.bing.com/webmasters/help/URL-Submission-62f2860b)
4. 用 URL Inspection 检查索引状态、Live URL 与 JSON-LD；用 Site Explorer 查看 404/410、403/5xx、robots、noindex、redirect、canonical 和 guideline issues。[Bing URL Inspection](https://www.bing.com/webmasters/help/URL-Inspection-55a30305) [Bing Site Explorer](https://www.bing.com/webmasters/help/site-explorer-c680da37)
5. 监控 Search Performance、Recommendations；如需观察 Microsoft Copilot / 合作伙伴中的引用，再看 AI Performance。该报告是引用活动样本，趋势变化不能归因于单一改动，也不保证引用。[Bing Webmaster Tools 2025 指南](https://blogs.bing.com/webmaster/June-2025/Start-Using-Bing-Webmaster-Tools-to-Improve-Your-Site-Visibility) [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)

### 10.3 百度

1. 在百度搜索资源平台添加并验证 HTTPS 站点。
2. 通过“普通收录”使用 API、手动或 Sitemap 提交新资源；有跳转时提交跳转后的最终 URL，已通过 HTTPS 验证则提交 HTTPS URL。[百度平台工具说明](https://ziyuan.baidu.com/college/articleinfo?id=3076)
3. 新增 / 更新高价值页面优先用 API；配额与优质资源处理相关，不应把配额浪费在参数页和薄页。提交只帮助发现 / 抓取，不保证收录或展现。[百度平台工具说明](https://ziyuan.baidu.com/college/articleinfo?id=3076)
4. 监控索引量、流量与关键词、抓取频次、抓取诊断、抓取异常、Robots 与死链提交；这些工具入口均列在百度官方工具手册中。[百度平台工具使用手册](https://ziyuan.baidu.com/college/articleinfo?id=2008)
5. 重点抽查移动端页面。百度明确会降低移动浏览体验差、广告过多或没有合适移动页面的页面展现。[百度移动页面整改说明](https://ziyuan.baidu.com/college/articleinfo?id=1287)

## 十一、发布验收标准

每次发布新的页面类型、结构化数据或国际化版本，至少完成以下抽查：

| 检查项 | 通过标准 |
|---|---|
| HTTP / 可访问性 | 主 URL 返回 200；不存在的筛选与分页返回 404；无循环重定向 |
| 初始 HTML | 无需登录、无需等待 API、关闭 JS 后仍有核心文本与标准内链 |
| Index 指令 | 可索引页无 noindex / robots 阻断；不索引页策略符合“crawl 与 index 分工” |
| Canonical | 唯一、绝对 HTTPS、与 Sitemap / 内链一致；参数版本指向主 URL |
| Title / Description | 唯一、与 H1 / 正文一致、无虚假“官网”或最低价承诺、无关键词堆砌 |
| 内容完整性 | 有真实报价 / 分析、来源、口径、核验时间、风险和地区限制 |
| 结构化数据 | 只描述可见主内容；价格、币种、可用性与页面一致；无虚假评分 |
| Hreflang | 自引用、双向、绝对 URL、代码正确、有 x-default、同语言 canonical |
| 内链 | 页面可从首页 / 频道到达，并可返回上级；无孤岛；锚文本明确 |
| 三家诊断 | Google URL Inspection、Bing URL Inspection、百度抓取诊断均能取得与用户一致的主要内容 |

## 十二、明确不做的 SEO 做法

- 不批量生成每个关键词变体、城市、国家、货币、折扣比例页面。
- 不把站内搜索结果、任意筛选或排序 URL 提交 Sitemap。
- 不抓取并轻微改写官方定价页或竞品内容后批量发布。
- 不购买链接、不参加链接农场、不做隐藏文字和关键词堆砌。
- 不把非官方站点写成“官网”，不声称“最低价”“绝对安全”而无可持续证据。
- 不伪造评论、星级、库存、价格或 `priceValidUntil`。
- 不把内部风控分数包装成 `AggregateRating`。
- 不为 Google FAQ 富结果继续投入 `FAQPage` 实施。
- 不把 `llms.txt` 当作 Google 排名因素；Google 2026 年官方说明它对 Google Search 可见性和排名既无正面也无负面影响。[Google Search 文档更新记录](https://developers.google.com/search/updates)

## 十三、研究限制与停止条件

- Google 与 Bing 官方资料更新较新；百度公开 SEO 资料中有部分发布日期较早。本报告只采用截至 2026-09-04 仍可从百度搜索资源平台访问、且未发现官方撤回的规则，并在可能受平台界面变化影响处使用“以当前工具界面为准”的表述。
- 搜索引擎只公布原则和工具行为，不公布排序权重；报告没有把“规范合规”描述成“保证排名”。
- Product / Offer 对数字订阅与多渠道报价的适用边界，需要在真实页面和报价模型确定后，用 Google Rich Results Test、URL Inspection 与 Bing Markup 检测小范围验证；本报告不假定所有 AI 订阅都必然获得产品富结果。
- 在页面可索引性、站点结构、元数据、重复治理、结构化数据、程序化内容、价格可信度、国际化及三家提交监控各主题上，已经获得至少一个对应搜索引擎的一手规范；继续搜索更弱或重复材料不太可能改变上述优先级，故停止扩展检索。

## 十四、官方来源索引

### Google Search Central

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google Search 技术要求](https://developers.google.com/search/docs/essentials/technical)
- [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google 标题链接指南](https://developers.google.com/search/docs/appearance/title-link)
- [Google 搜索摘要与 Meta Description](https://developers.google.com/search/docs/appearance/snippet)
- [Google Canonical 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google Robots Meta 规范](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google 分面导航抓取指南](https://developers.google.com/crawling/docs/faceted-navigation)
- [Google JavaScript SEO 基础](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google 结构化数据通用规范](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google Product / Offer / AggregateOffer](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google SoftwareApplication](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Google Review / AggregateRating](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Google 多语言 / 多地区页面](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google 以人为本内容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Spam Policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google Search Console 入门](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Google Search 文档更新记录](https://developers.google.com/search/updates)

### Microsoft Bing

- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Bing Sitemap](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)
- [Bing URL Submission / IndexNow](https://www.bing.com/webmasters/help/URL-Submission-62f2860b)
- [Bing Robots.txt](https://www.bing.com/webmasters/help/how-to-create-a-robots-txt-file-cb7c31ec)
- [Bing URL Inspection](https://www.bing.com/webmasters/help/URL-Inspection-55a30305)
- [Bing Site Explorer](https://www.bing.com/webmasters/help/site-explorer-c680da37)
- [Bing 结构化数据](https://www.bing.com/webmasters/help/marking-up-your-site-with-structured-data-3a93e731)
- [Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)
- [Bing：重复内容与 AI 搜索可见性](https://blogs.bing.com/webmaster/December-2025/Does-Duplicate-Content-Hurt-SEO-and-AI-Search-Visibility)

### 百度搜索资源平台

- [百度搜索网页标题规范](https://ziyuan.baidu.com/college/articleinfo?id=2726)
- [百度搜索基础信息设置规范](https://ziyuan.baidu.com/college/articleinfo?id=3405)
- [百度搜索优质内容指南](https://ziyuan.baidu.com/college/articleinfo?id=2947)
- [百度搜索引擎优化指南 2.0](https://ziyuan.baidu.com/college/articleinfo/?id=197)
- [百度平台工具使用手册](https://ziyuan.baidu.com/college/articleinfo?id=2008)
- [百度平台工具的使用与常见问题](https://ziyuan.baidu.com/college/articleinfo?id=3076)
- [百度：符合搜索抓取习惯的网站](https://ziyuan.baidu.com/college/articleinfo?id=27)
- [百度：巧用 Robots 避免蜘蛛黑洞](https://ziyuan.baidu.com/college/articleinfo?id=1180)
