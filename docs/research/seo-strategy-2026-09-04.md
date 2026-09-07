# AI 价格雷达 SEO 策略与当前网站审计

研究日期：2026-09-04  
网站：[priceai.cc](https://priceai.cc/)  
依据：[关键词需求报告](./keyword-demand-2026-09-04/report.md)、[搜索引擎官方规范研究](./seo-official-guidelines-2026-09-04.md)、线上页面与当前本地代码审计

## 一、结论

AI 价格雷达不缺可用于 SEO 的数据，缺的是把数据组织成“一个 URL 完成一个搜索任务”的稳定结构。

最值得做的不是批量写泛 AI 文章，而是围绕现有功能建立四类搜索落地页：

1. **产品购买路径页**：回答 ChatGPT Plus 到底有官方订阅、正价充值、成品号、试用号、团队席位中的哪几种路径。
2. **同规格价格页**：同一套餐、周期、账号归属和交付方式下，比较真实有货报价。
3. **官方价格/API 页**：呈现官方地区价、原币、汇率、输入/输出/缓存价格及证据链接。
4. **渠道核验页**：呈现 API 中转站或商家的价格、倍率、稳定性、样本量、来源和风险事实。

中国应先做，因为当前产品功能和数据最贴合 `ChatGPT充值`、`ChatGPT会员`、`ChatGPT Plus购买`、`API中转站` 等需求。欧美第一阶段只应扩展官方订阅和官方 API 价格页；第三方卡网数据若没有当地可购买性，不应机械翻译后投放。

## 二、现有功能如何转化为 SEO 价值

| 网站功能 | 用户价值 | 可承接的搜索意图 | SEO 页面形态 |
|---|---|---|---|
| 标准商品与购买方式分类 | 避免把正价充值、日抛、成品号、共享账号混成一个低价 | ChatGPT会员、ChatGPT购买、ChatGPT账号购买 | 产品购买路径页、单一规格详情页 |
| 有货价、质保价、库存与更新时间 | 回答“现在多少钱、是否真能买” | ChatGPT充值、ChatGPT Plus价格、Claude会员价格 | 可索引的同规格报价页 |
| 官方订阅地区价 | 比较官网、App Store、Google Play 与地区差异 | ChatGPT Plus多少钱、ChatGPT价格、prix/preis/cost | 官方套餐地区价页 |
| 官方 API 价格库 | 比较输入、输出、缓存、图片和视频计价 | OpenAI API价格、大模型API价格、openai api pricing | 厂商页、模型页、可比模型页 |
| API 中转倍率与稳定性 | 计算真实综合成本并验证运行状况 | API中转站、API中转站推荐、LLM API pricing | 中转站频道、核验详情、选择指南 |
| 来源证据、采集时间和异常处理 | 建立价格可信度，区别于纯联盟或导购站 | 渠道靠谱吗、价格是否真实 | 方法论、状态、变更与纠错页 |
| 价格/库存历史 | 解释价格变化并帮助择时 | 价格走势、降价、历史最低 | 产品页内历史模块；有足够历史后再建独立页 |
| 公共数据 API / Feed | 帮助开发者复用数据并获得自然引用 | AI价格API、LLM pricing data | 数据说明和开发者文档 |

网站真正的差异化不是“价格低”，而是：**同规格比较、仍然有货、最近核验、原始来源可回看、风险事实不隐藏。** 所有 SEO 页面都应把这五点放在首屏与摘要中。

## 三、关键词与目标 URL

### 3.1 中国优先页面

| 搜索主词 | 已有需求证据 | 推荐主 URL | 当前状态 | 应做什么 |
|---|---:|---|---|---|
| ChatGPT Plus | Google 中国月均 1,900 | `/products/chatgpt-plus` 或新的唯一 Plus 总览 URL | 当前 URL 只代表“试用订阅”，与宽泛主词不完全匹配 | 改为 Plus 购买路径总览，分别导向官方价、正价充值、试用/成品号；不要在总览上制造一个混合最低价 |
| ChatGPT充值 | 1,300 | `/products/chatgpt-plus-recharge` | 页面数据和标题已较强 | H1/title 加强“充值”，补自己账号、CDK、代充、地区、覆盖续费、售后差异 |
| ChatGPT Plus购买 | 590 | Plus 总览页 | 由多个页面分散承接 | 在总览页明确“怎么买”并链接每条路径，不另建近义薄页 |
| ChatGPT会员 | 590 | `/platforms/chatgpt` | 线上已有较完整品牌页 | 作为 ChatGPT 品牌中心，覆盖 Plus/Pro/Team/账号，强化到各实体页的描述性内链 |
| API中转站 | 590 | `/api-transit` | 已有价格、倍率、稳定性和来源数据 | 保留为频道主词页，增加清晰方法论、已验证/待验证边界和可比口径 |
| ChatGPT账号购买 | 320 | ChatGPT 平台页 + 独立账号规格页 | 普号、试用号等分散 | 建“账号购买方式”模块；只有在内容和报价足够独立时才建稳定账号页 |
| Gemini会员 | 260 | `/platforms/gemini` | 已有平台路由 | 补官方订阅、充值/成品号、地区价与风险差异 |
| ChatGPT Plus充值 | 210 | `/products/chatgpt-plus-recharge` | 已有强页面 | 与 `ChatGPT充值` 合并承接，避免再建同义 URL |
| ChatGPT Plus代充 | 170 | `/products/chatgpt-plus-recharge` | 已覆盖“正价代充” | 增加“代充与官方直购/CDK的区别” |
| ChatGPT价格 | 170 | `/platforms/chatgpt` | 已有平台页 | 展示官方基准、不同路径价格区间和最近核验，不只给一个最低数字 |
| Claude会员 | 140 | `/platforms/claude` | 已有平台路由 | 建成 Claude Pro/Max/Team 的套餐中心 |
| OpenAI API充值 | 90 | API 指南或渠道说明 | 当前官方 API 页以价格为主 | 不与官方 API 定价混淆；单独解释“官方账单充值”和中转余额 |
| AI比价 | 70 | `/` | 首页已有四路径分流 | 首页承接品牌/品类，具体交易词交给内页 |
| API中转站推荐 | 50 | `/guides/api-transit` | 已有指南 | 标题使用“怎么选/比较”，依据倍率、样本和稳定性，不做无证据背书 |
| OpenAI API价格 | 40 | `/official-api/providers/openai-official` | 数据丰富，当前 title 偏“模型覆盖” | 改为 OpenAI API 价格主页面，显示输入、输出、缓存与更新时间 |
| 大模型API价格 | 20 | `/official-api` | 当前 title 仅“官方 API” | 改为大模型 API 价格频道页，明确覆盖 OpenAI、Claude、Gemini、DeepSeek 等 |
| AI订阅比价 | 10 | `/channels` | 当前是“卡网订阅比价” | 作为集合页即可，不为近义词再建页面 |

### 3.2 欧美页面

欧美优先级来自此前 Google/Bing 月均量，但是否上线取决于网站能否提供真正本地化的价格、币种、税费、支付方式和地区限制。

| 市场 | 高价值主词 | 推荐页面 |
|---|---|---|
| 美国 | chatgpt plus、chatgpt plus price、claude pro、claude pro price、gemini advanced、openai api pricing | `/en-us/...` 的单一套餐官方价、厂商 API 价与真实比较页 |
| 英国 | chatgpt plus、claude pro、chatgpt price、openai api pricing | `/en-gb/...`；只有 GBP、VAT、渠道或规则确有差异时才与美国页拆分 |
| 德国 | chatgpt plus kosten、chatgpt preis/preise、claude pro preis、openai api preise | `/de-de/...`，正文使用 Kosten、Preis/Preise、Abo/Abonnement 的本地表达 |
| 法国 | abonnement chatgpt、prix chatgpt、prix chatgpt plus、prix claude pro | `/fr-fr/...`，围绕 abonnement、prix 与当地结算信息 |

不要为 `AI subscription price comparison`、`KI Abo Vergleich`、`comparatif abonnement IA` 先做大量空泛聚合页；这些抽象词有需求，但远小于具体产品和套餐词。

## 四、推荐信息架构

不应仅为了 SEO 频繁修改已有 slug。下面表达的是页面职责，落地时可复用当前 URL。

```text
首页 /                                   品牌与四条购买路径
├── /channels                            第三方 AI 订阅频道
│   ├── /platforms/chatgpt               ChatGPT 品牌/路径中心
│   │   ├── ChatGPT Plus 总览            宽泛 Plus 搜索意图
│   │   ├── /products/chatgpt-plus-recharge
│   │   ├── ChatGPT Plus 试用/成品号      与正价充值分开
│   │   └── Pro / Team / 普号实体页
│   ├── /platforms/claude
│   └── /platforms/gemini
├── /official-prices                     官方订阅价格频道
│   └── /official-prices/{单一套餐}       地区、渠道、原币和证据
├── /official-api                        大模型 API 价格频道
│   ├── /official-api/providers/{厂商}
│   └── /official-api/{单一模型}
├── /api-transit                         API 中转站价格与稳定性频道
│   └── /api-transit/{已核验站点}
├── /guides                              购买与核验指南
├── /methodology                         比价、汇率、过期、排序方法
├── /status                              数据采集和发布健康度
└── /changes                             有意义的价格/库存变更
```

内部链接使用用户会理解的锚文本，例如“ChatGPT Plus 官方地区价格”“ChatGPT Plus 充值渠道”“OpenAI API 输入/输出价格”，不要只写“查看”“详情”。

## 五、当前网站的主要 SEO 问题

### P0：线上与本地部署源不一致

线上当前已有：

- `/platforms/chatgpt` 等平台页；
- 首页、频道、产品页上的 JSON-LD；
- 182 个 sitemap URL；
- 参数 URL 的规范化和更细的 robots 规则。

本地 `main` 当前却仍是：

- 平台路由为 `/brands/[brand]`；
- sitemap 包含线上返回 404 的 `/search`、`/subscriptions`、`/methodology`、`/status`、`/docs` 等路径；
- `robots.ts` 与线上规则明显不同；
- 本地部分 title 仍使用 `PriceAI` 和“权威”，线上 title 则使用“低价”。

在解决部署源与路由漂移前，不应直接发布本地 SEO 改动，否则可能丢失线上已有页面、canonical、结构化数据或 sitemap。

**验收：** 明确唯一部署分支/提交；对线上 sitemap 全量导出；将每个现有 URL 映射到保留、301、410 或替代 URL；发布后不得出现批量 404 或 canonical 改向。

### P0：ChatGPT Plus 实体边界与搜索意图冲突

当前 `/products/chatgpt-plus` 的页面实体是“ChatGPT Plus 试用订阅”，包含日抛、短期成品号、网页号、接码状态及不同渠道，而宽泛 `ChatGPT Plus` 是中国量最大的相关主词之一。与此同时，还有：

- `/products/chatgpt-plus-recharge`：正价代充；
- `/official-prices/chatgpt__plus-monthly`：官方地区价；
- `/platforms/chatgpt`：品牌与多套餐总览；
- `/guides/chatgpt-subscription-options`：获取方式指南。

这既可能产生页面竞争，也可能让搜索 `ChatGPT Plus价格/购买` 的用户落到试用号页面。

**建议：** 选择一个 URL 作为宽泛 ChatGPT Plus 的购买路径总览；总览不展示混合最低价，而是分别显示官方订阅、正价充值、试用/成品号、团队权益的价格区间和限制。原有实体页继续承接细分意图。若改变现有 `/products/chatgpt-plus` 职责，必须设计数据迁移和 301，不要新增另一个同义总览页。

### P0：结构化数据边界过宽

线上 `/products/chatgpt-plus` 使用 `Product + AggregateOffer`，但其可见内容包含不同期限、账号归属和交付方式。Google 的官方规则要求 `AggregateOffer` 描述同一明确产品的多商家报价；不同套餐/周期/实质商品不能为了生成低价而混在一起。

另一个可见问题是该页抓取时 `offerCount` 为 180，但 `lowPrice` 与 `highPrice` 同为 35.31。若页面实际存在不同价格，这个结构化数据与可见报价集合不一致。

**建议：**

- 宽泛品牌/路径页使用 `CollectionPage`、`ItemList` 和 `BreadcrumbList`；
- 只有同一套餐、周期、交付方式和账号归属的报价集合才使用 `Product + AggregateOffer`；
- `lowPrice`、`highPrice`、`offerCount`、币种、库存必须来自同一个公开可见报价集合；
- 官方套餐页可先小范围测试 Product snippet，但本站不直接结算，不应按 Merchant listing 实施；
- 不把内部渠道风险分数包装成 `AggregateRating`。

Google 已于 2026 年停止 FAQ 富结果。FAQ 正文仍然对用户有价值，但现有 `FAQPage` JSON-LD 不应继续作为 SEO 增长项目投入。

### P0：待核验/草稿页面进入 sitemap

线上 `/api-transit/hejuapi-com` 返回 200、出现在 sitemap，但正文同时写着“待核验”“仅作为后台待审核草稿保存，不进入前台公开展示”。这是状态与实际公开行为冲突。

**建议：** 只有已审核且满足内容合同的渠道页进入 sitemap 并 `index,follow`。待审核、无样本、无有效公开价格或纯跳转页面应从 sitemap 移除并 `noindex`；不存在或不再公开的页面返回 404/410。页面公开状态、canonical、robots、sitemap 和结构化数据必须使用同一发布状态字段。

### P1：Title 与页面职责没有完全匹配搜索词

当前主要页面建议如下：

| URL/页面 | 推荐 title | 推荐 H1 |
|---|---|---|
| `/` | `AI价格雷达｜ChatGPT会员充值与API中转站比价` | `AI订阅、充值与API价格比价` |
| `/channels` | `AI订阅价格对比｜ChatGPT、Claude、Gemini会员充值 | AI价格雷达` | `AI订阅与会员充值比价` |
| `/platforms/chatgpt` | `ChatGPT会员价格与购买方式｜Plus、Pro、账号与充值 | AI价格雷达` | `ChatGPT价格、会员与购买方式` |
| Plus 总览 | `ChatGPT Plus价格与购买渠道｜官方、充值、账号对比 | AI价格雷达` | `ChatGPT Plus多少钱，怎么买` |
| `/products/chatgpt-plus-recharge` | `ChatGPT Plus充值价格｜官方直充、代充与CDK对比 | AI价格雷达` | `ChatGPT Plus充值与代充价格` |
| `/official-prices/chatgpt__plus-monthly` | `ChatGPT Plus多少钱？全球官方地区价格表 | AI价格雷达` | `ChatGPT Plus官方地区价格` |
| `/api-transit` | `API中转站价格对比｜倍率、模型与稳定性 | AI价格雷达` | `API中转站价格、倍率与稳定性` |
| `/guides/api-transit` | `API中转站怎么选？价格、倍率与稳定性检查 | AI价格雷达` | `API中转站怎么比较` |
| `/official-api` | `大模型API价格表｜OpenAI、Claude、Gemini API计费 | AI价格雷达` | `大模型官方API价格` |
| OpenAI 厂商页 | `OpenAI API价格｜输入、输出与缓存费用 | AI价格雷达` | `OpenAI API价格表` |

这些是职责模板，不是要求每个页面塞入所有词。每页只保留一个主主题，title 与 H1、首段、表格标题保持一致。删除“权威”“全网最低”“绝对安全”等无法持续证明的表述；品牌统一为“AI价格雷达”，`PriceAI` 作为 `alternateName` 使用。

### P1：信任页面在线上缺失

当前本地存在 `/methodology`、`/status`、`/changes`、`/docs`，但审计时线上均返回 404。对于价格与交易渠道网站，这些页面不是装饰，而是解释以下事实的核心证据：

- 什么报价参与最低价；
- 何时判定过期、缺货或异常；
- 汇率从哪里来、何时更新；
- 商业合作是否影响排序；
- 谁维护数据、如何纠错；
- 采集成功率和数据覆盖范围。

建议部署并从全站页脚链接 `/methodology`、`/changes`、`/status`、About/联系与商业披露；不要只在免责声明里重复“本站不担保”。

### P1：页面 HTML 和表格过大

本次读取到的未压缩 HTML 响应大小约为：

| 页面 | HTML 大小 |
|---|---:|
| 首页 | 130 KB |
| `/channels` | 535 KB |
| ChatGPT Plus 正价充值 | 242 KB |
| ChatGPT Plus 官方地区价 | 1.63 MB |
| `/official-api` | 285 KB |
| `/api-transit` | 1.22 MB |

这不是 Core Web Vitals 的直接测量，但说明 DOM、解析和传输复杂度值得优先检查。官方地区价一次输出 251 行，中转站页也输出大量表格。

**建议：** 首屏 SSR 保留实体说明、摘要、关键价格和前 20–50 条可见数据；其余按地区/厂商分组、分页或按需加载。可索引主页面仍需在初始 HTML 中完成主要任务，不应只剩一个依赖 JavaScript 的空壳。使用 Search Console Core Web Vitals 与真实用户数据决定最终优化优先级。

### P1：Sitemap 和参数治理需要统一

线上参数页已有 canonical，例如 `/channels?platform=chatgpt` 指向 `/channels`；robots 同时阻止多类查询参数。需要注意：robots 控制抓取，不是可靠的去索引方法；被阻止抓取时，搜索引擎无法读取 `noindex`。

推荐状态机：

1. 站内搜索、无结果页和不需要索引的参数组合：允许爬虫读取 `noindex,follow`，不进 sitemap；
2. 排序、币种、展示方式等重复版本：canonical 到主 URL，不进 sitemap；
3. 真有稳定需求的筛选：不要索引参数 URL，创建有独立内容的稳定落地页，如 `/platforms/chatgpt`；
4. 空组合：返回真实 404；
5. sitemap 只含返回 200、可索引、self-canonical 的 URL。

`lastmod` 只有在价格集合、可用性、正文分析等发生实质变化时才更新；不要每次部署把所有静态 URL 刷成当前时间。

## 六、每个可索引页面的内容合同

程序化页面只有同时具备以下内容才允许进入索引：

1. **实体定义**：产品、套餐、周期、账号归属、交付方式是什么。
2. **官方基准**：官方价格、原币、地区、税费口径和官方来源。
3. **可比报价**：同规格价格、库存、渠道和最近核验时间。
4. **计算口径**：汇率、手续费、按月/年折算、首购/续费差异。
5. **来源与风险**：证据类型、更新时间、售后/退款、共享/独享、异常原因。
6. **独有分析**：价格区间、变化、适用路径和不能直接比较的部分。
7. **透明度**：商业关系、排序规则、纠错入口与维护责任。

没有报价、没有独有分析或只是替换产品/国家名的页面，应合并到上级频道或 `noindex`。不要给每个关键词变体、国家、币种和筛选组合批量建页。

## 七、内容集群

### 集群 A：ChatGPT 交易需求

- 品牌中心：ChatGPT价格、会员、购买方式；
- Plus 总览：官方订阅、充值/代充、CDK、成品号、试用号的路径差异；
- 正价充值：菲区卡充、美区 iOS、官方直充、能否覆盖、质保；
- 官方地区价：国家、原币、人民币估算、税费与支付限制；
- 账号购买：普通号、Plus 成品号、共享/独享、接码和找回风险；
- 指南：购买方式、地区风险、支付卡、礼品卡、卡网核验。

页面之间互链，但不复制相同说明。数据页回答“当前是什么”，指南回答“为什么和怎么选”。

### 集群 B：Claude 与 Gemini 会员

- `/platforms/claude`、Claude Pro、Max、Team；
- `/platforms/gemini`、Gemini Pro/Advanced、Ultra；
- 官方地区价与第三方充值/成品号分开；
- 页面内容使用各自真实套餐和渠道数据，不复制 ChatGPT 模板后只替换品牌名。

### 集群 C：官方 API 价格

- 大模型 API 价格频道；
- OpenAI、Anthropic/Claude、Google/Gemini、DeepSeek 等厂商页；
- 单模型输入、输出、缓存、Batch、图片或视频计价页；
- 只有单位和能力可比时才做 `A vs B`；
- 增加“ChatGPT订阅不等于 OpenAI API 额度”等高频误区说明。

### 集群 D：API 中转站

- 中转站频道：统一解释充值系数、模型倍率、综合倍率与稳定性；
- 已核验站点详情：模型组、倍率、样本量、监测窗口、来源与商业关系；
- “怎么选”指南：以方法论承接“推荐”意图；
- 待审核草稿、无公开价格、无样本页面不进入索引；
- 联盟入口使用 `rel="sponsored"`，普通未经背书的外链可使用 `nofollow`；商业关系不能影响自然排序。

## 八、国际化顺序

### 第一阶段

只做英语的官方订阅和 API 价格页：ChatGPT Plus、Claude Pro、Gemini Advanced、OpenAI API。验证搜索曝光与维护能力后再扩展。

### 第二阶段

若美国与英国页面确有币种、VAT、付款方式或价格差异，再拆 `en-US` 与 `en-GB`。否则先用一个高质量英文版本，避免两套近重复内容。

### 第三阶段

上线德语和法语核心页：

- 德语：`ChatGPT Plus Kosten`、`ChatGPT Preis/Preise`、`Claude Pro Preis`；
- 法语：`abonnement ChatGPT`、`prix ChatGPT`、`prix ChatGPT Plus`。

每组页面使用独立 URL、同语言 self-canonical、双向 `hreflang` 和 `x-default`。页面必须本地化货币、税费、支付和地区规则，不只是翻译 title。

## 九、执行路线图

| 阶段 | 工作 | 完成标准 |
|---|---|---|
| 第 0 周 | 对齐线上部署源和本地代码；导出全部 URL 映射 | 所有现有 SEO URL 有保留/301/410 决策；无意外批量 404 |
| 第 1–2 周 | 修正 ChatGPT Plus 页面职责、草稿索引、Product/AggregateOffer、品牌命名、核心 title/H1 | P0 页面一词一意图；结构化数据与可见数据一致；待审核页不在 sitemap |
| 第 1–2 周 | 提交并验证 Google Search Console、Bing Webmaster、百度搜索资源平台 | 三家可读取 sitemap；抽样 URL 可抓取；形成基线数据 |
| 第 3–4 周 | 部署 methodology/status/changes/About；补核心页面内容合同与上下文内链 | 核心产品页都有来源、绝对更新时间、官方基准、可比口径、风险和纠错入口 |
| 第 3–6 周 | 优化大表格 HTML/DOM；修正 sitemap lastmod 和参数治理 | 主页面完成任务且 HTML 显著收敛；无参数页进入 sitemap |
| 第 5–8 周 | 完成 ChatGPT、Claude、Gemini、官方 API、中转站四个中文内容集群 | 每个高价值查询只有一个明确主页面；相关页互链 |
| 第 9–12 周 | 小规模上线英文官方价格/API 页面 | 有真实本地化内容与 hreflang；按实际曝光决定是否扩展德法语 |

## 十、监控与成功指标

没有当前 Google Search Console、Bing Webmaster 或百度站长数据，因此不能负责任地预测流量或给出“多久到首页”的承诺。先建立 28 天基线，再按页面集群衡量。

| 维度 | 指标 |
|---|---|
| 可抓取与索引 | sitemap 成功 URL、已索引 URL、抓取错误、误索引参数页、软 404 |
| 搜索表现 | Query/Page/Country 的曝光、点击、CTR、平均排名；百度重点观察 ChatGPT充值/API中转站集群 |
| 页面质量 | 重复 title/description、canonical 冲突、无报价索引页、结构化数据错误 |
| 用户完成任务 | 从搜索落地到查看报价、查看官方证据、进入渠道、订阅降价提醒的比例 |
| 数据可信度 | 报价新鲜率、过期报价占比、异常价拦截率、来源可回看率、纠错处理时间 |
| 性能 | Core Web Vitals、移动端 LCP/INP/CLS、大表格页面 HTML/DOM 大小 |

建议给每个页面模板建立发布门禁：HTTP 200、self-canonical、唯一 title/H1、初始 HTML 有核心数据、结构化数据一致、报价和来源有效、sitemap 状态正确。新增或实质更新 URL 通过 Bing IndexNow 和百度普通收录通知；Google 使用 sitemap 与 URL Inspection，不为普通页面调用 Indexing API。

## 十一、现在不应做的事情

- 不批量生成“品牌 × 国家 × 货币 × 购买方式 × 优惠”组合页；
- 不让站内搜索和任意筛选结果进入 sitemap；
- 不把日抛、正价充值、共享账号和官方月付混成一个 Product 低价；
- 不用“权威、全网最低、绝对靠谱、官网”等无法持续证明的词；
- 不伪造评分或把内部风控分数写成星级；
- 不继续投入 FAQPage 富结果；保留有用 FAQ 正文即可；
- 不先写大量资讯文章；优先把已有价格、库存、来源和风险数据变成高质量实体页；
- 不在没有真实地区差异时复制 en-US/en-GB/de-DE/fr-FR 模板；
- 不在部署源未对齐时直接发布本地 sitemap、robots 或路由改动。

## 十二、官方依据

- [Google Search 技术要求](https://developers.google.com/search/docs/essentials/technical)
- [Google 标题链接指南](https://developers.google.com/search/docs/appearance/title-link)
- [Google Canonical 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google Sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google 分面导航抓取指南](https://developers.google.com/crawling/docs/faceted-navigation)
- [Google Product / AggregateOffer 规范](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Google 多语言与 hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google 有帮助、可靠、以人为本的内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Bing IndexNow / URL Submission](https://www.bing.com/webmasters/help/URL-Submission-62f2860b)
- [百度搜索网页标题规范](https://ziyuan.baidu.com/college/articleinfo?id=2726)
- [百度搜索优质内容指南](https://ziyuan.baidu.com/college/articleinfo?id=2947)
- [百度搜索引擎优化指南 2.0](https://ziyuan.baidu.com/college/articleinfo/?id=197)

