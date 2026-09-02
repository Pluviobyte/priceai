# X / Twitter 上的 AI 订阅比价与聚合平台初步调研

> 调研时间：2026-09-02（Asia/Shanghai）  
> 目标：先建立竞品池，重点观察 AI 官方订阅比价、跨渠道/跨地区比价、AI 模型/API 聚合，以及订阅追踪省钱工具。  
> 方法：先用 Grok 搜索 X 帖子和账号，再回到产品官网、方法论页、官方文档逐项核验。X 上没有明确官方身份时，本文会写成“第三方讨论”或“仅搜索入口”，不把搜索结果当成背书。

## 一页结论

1. **真正的“消费级 AI 订阅比价”仍是小市场。** X 上持续运营官方账号的纯比价产品很少；大量站点没有官方账号，主要靠 SEO、Product Hunt、独立开发者 build-in-public 或中文 X 传播。
2. **海外站点比的是“官方套餐值不值”。** 常见结构是月付/年付、免费档、模型、额度、功能、隐藏费用、历史调价与适用人群。代表：PriceMyAI、SubChoice、AI Pricing Guru。
3. **中文 X 上讨论更热的是“怎么买更便宜”。** 核心是卡网、代充、成品号、Team 席位、App Store 低价区、库存和更新时间。代表：PriceAI、OpenPrice。这类供给更有即时价值，但诈骗、封号、支付与售后风险也最高。
4. **“价格”本身不够，最有价值的是标准化。** 用户真正要比较的是同一工作量/额度下的有效月成本。StackPricing、OpenRouter、SubChoice 都把不同计价口径转成可排序的统一指标。
5. **值得优先借鉴的产品结构：** 可分享的双产品对比页、统一口径后的月成本、价格更新时间戳、官方来源链接、价格历史、优惠到期提醒、按使用场景推荐“组合订阅”、地区价/渠道价与官方价分层展示。

## 相关性分级

- **强**：产品核心就是 AI 订阅价格比较或购买决策。
- **中**：核心是 AI API/模型成本比较、跨地区/跨渠道价格或订阅追踪，能直接迁移到订阅比价。
- **弱但值得看**：核心是模型聚合或成本管理，不是消费级订阅比价，但数据结构、变现与用户路径有参考价值。

## 竞品清单

### 1. AI Price Compare — 强

- **官网：** [aipricecompare.org](https://aipricecompare.org/)
- **X 证据：** Grok 未找到可确认的官方账号或创始人帖；可复现 [X 搜索](https://x.com/search?q=%22aipricecompare.org%22&src=typed_query)。
- **定位 / 比价对象：** 把 ChatGPT、Claude、Gemini、Copilot、Perplexity、DeepSeek、Grok 的免费与付费套餐放进同一张 ledger；同时覆盖部分开发者 API。
- **数据呈现 / 更新：** 首页明确标注更新时间和“Refreshed weekly”，支持按免费/付费/20 美元以下过滤和价格排序；方法论称价格直接取自厂商定价页，调价后保留旧价删除线和日期。[来源](https://aipricecompare.org/)
- **变现：** 明确不收 AI 厂商 affiliate fee；未披露其他商业模式，暂视为未知。
- **值得借鉴：** “七家一张账本”、平均价/价格区间、计划层级而不是工具层级、每个计划的真实额度与适用场景。
- **风险 / 可信度：** 站点披露了来源与更新时间，但缺少清晰主体和官方 X；必须抽样核对价格。页面中的模型命名更新非常激进，容易出现先于官方或口径错误。

### 2. AI Pricing Guru — 强

- **官网：** [订阅比价页](https://www.aipricing.guru/subscriptions/)；[订阅 vs API 计算器](https://www.aipricing.guru/calculators/subscription-vs-api/)
- **X 证据：** Grok 找到一条第三方引用帖 [@TheCoderBtw](https://x.com/TheCoderBtw/status/2094658443663847447)，未确认官方账号。
- **定位 / 比价对象：** 同时覆盖消费级订阅与 API token 价格，订阅页按价格档横向比较 7 家、31 个计划。
- **数据呈现 / 更新：** 页面标注“monitored daily”和最后更新时间；把年付换算为有效月价，并把套餐内模型、使用额度、团队席位放在同一层。[来源](https://www.aipricing.guru/subscriptions/)
- **变现：** 官网明确披露部分注册链接为 affiliate links，不影响价格数据和推荐排序。[来源](https://www.aipricing.guru/subscriptions/)
- **值得借鉴：** “月订阅 vs 同等 API 用量”盈亏平衡计算器；让用户输入使用量，而不是只看标价。
- **风险 / 可信度：** 有更新日期和 affiliate 披露，但未看到详细的数据抓取审计记录；所谓“daily monitored”仍需抽样验证。

### 3. PriceMyAI — 强

- **官网：** [首页](https://www.pricemyai.com/)；[方法论](https://www.pricemyai.com/methodology/)；[价格历史](https://www.pricemyai.com/history/)；[优惠页](https://www.pricemyai.com/deals/)
- **X 证据：** 未找到可确认的官方账号；可复现 [X 搜索](https://x.com/search?q=%22PriceMyAI%22&src=typed_query)。
- **定位 / 比价对象：** AI 视频、图像、写作、语音、音乐、助手、编程、演示等垂类工具价格和 90+ 头对头比较。
- **数据呈现 / 更新：** 官方定价页优先、每条带核验日期；厂商阻止自动访问时标成 aggregated，并至少交叉 3 个独立来源。区分月付与年付、提示信用点过期/席位费/优惠恢复原价，维护月度快照和历史调价。[来源](https://www.pricemyai.com/methodology/)
- **变现：** 部分“Try it”链接为 affiliate；规则声明 affiliate 不影响价格和排序。[来源](https://www.pricemyai.com/methodology/)
- **值得借鉴：** 最完整的“价格可信度产品化”：核验日期、隐藏费用、价格历史、优惠到期、RSS、可引用格式。
- **风险 / 可信度：** 方法论较透明，但官网自称 46 个工具中只有 23 个能直接核验，剩余仍依赖二手聚合；需要在 UI 上显著区分证据等级。

### 4. SubChoice — 强

- **官网：** [工具入口](https://subchoice.com/tools/)；[公开评分方法](https://subchoice.com/scoring-methodology/)
- **X 证据：** 未找到明确官方账号；可复现 [X 搜索](https://x.com/search?q=%22subchoice.com%22%20AI&src=typed_query)。
- **定位 / 比价对象：** AI 订阅计划级数据库，提供目录、双产品对比、三问测验和“AI Stack Optimizer”。
- **数据呈现 / 更新：** 从厂商定价页提取价格、使用限制和可用模型并记录最后核验日期；对比链接可分享。评分按功能覆盖 30%、模型质量 25%、使用限制 20%、性价比 15%、捆绑工具 10%。[来源](https://subchoice.com/scoring-methodology/)
- **变现：** 声明无赞助、厂商不能付费提升排名；其他商业模式未披露。[来源](https://subchoice.com/tools/)
- **值得借鉴：** 不只推荐“一个订阅”，而是根据预算和角色推荐组合并直接算年成本；公开评分权重可降低黑箱感。
- **风险 / 可信度：** 评分仍包含主观校准；所谓 advisory board 的身份和治理证据不够清楚。

### 5. AI Subscriptions — 强

- **官网：** [aisubscriptions.io](https://aisubscriptions.io/)
- **X 证据：** 未找到明确官方账号；可复现 [X 搜索](https://x.com/search?q=%22aisubscriptions.io%22&src=typed_query)。
- **定位 / 比价对象：** 手工策展的 AI 订阅目录，标称 263 项，支持类别、月付/年付、免费计划/试用筛选。
- **数据呈现 / 更新：** 官网称全部人工核验、不使用自动抓取、每周更新。[来源](https://aisubscriptions.io/)
- **变现：** 免费收录，欢迎 affiliate partnership。[来源](https://aisubscriptions.io/)
- **值得借鉴：** 首页把“订阅”当作统一商品，不让用户先理解复杂工具分类；筛选路径简单。
- **风险 / 可信度：** 更接近目录，缺少方法论、历史价格、具体证据等级和更新时间戳；affiliate 可能造成收录/曝光偏差。

### 6. AI Price Guide — 强

- **官网：** [aipriceguide.co](https://aipriceguide.co/)
- **X 证据：** [创始人 @ludydev 的发布帖](https://x.com/ludydev/status/2065475903237591302) 明确称自己构建了该站，覆盖 43+ 工具、真实成本、免费替代，并称 ad-free。
- **定位 / 比价对象：** 43+ AI / SaaS 工具，强调隐藏限制、token、附加费用、免费替代与价格变化。
- **数据呈现 / 更新：** 官网称全部人工对照官方定价页，每条有 last verified；按月记录调价，检查 billing docs、服务条款和用户经验。[来源](https://aipriceguide.co/)
- **变现：** 创始人帖称 ad-free；其他变现未披露。
- **值得借鉴：** 把“隐藏费用检测”单独做成承诺；变更记录包含日期、背景、影响，而不只是新价格。
- **风险 / 可信度：** 2026-09-02 查看时官网最近整体核验日期仍为 2026-02-09，已明显滞后；这是“人工维护难以持续”的直接例子。X 发布帖当时只有很少互动，市场验证弱。

### 7. PricePeek AI — 强

- **官网：** [pricepeekai.com](https://pricepeekai.com/)
- **X 证据：** 未找到与该域名匹配的官方号；`@pricepeekai` 可能是同名电商项目，不能混用。可复现 [域名搜索](https://x.com/search?q=%22pricepeekai.com%22&src=typed_query)。
- **定位 / 比价对象：** 57 个 AI 工具、97 个比较、14 个类别；用“谁更便宜/每月差多少/是否有免费版”驱动 SEO 对比页。
- **数据呈现 / 更新：** 首页有 Recently updated 区块，但未公开可靠的更新频率或详细核验方法。[来源](https://pricepeekai.com/)
- **变现：** 页面有 Advertisement 广告位，推断以展示广告为主；未找到更完整披露。
- **值得借鉴：** “差 $X/月”是非常直接的结果式标题；按任务类别覆盖长尾搜索。
- **风险 / 可信度：** 页面曾出现 `$0.010000000000001563/mo less` 这类浮点格式错误，说明数据清洗/展示层质量控制不足；主体和数据来源透明度低。

### 8. 算盘 LLM Abacus — 强（中文官方会员）

- **官网：** [AI 会员对比](https://www.llmabacus.com/subscriptions)；[地区价格](https://www.llmabacus.com/en/regional-pricing)
- **X 证据：** Grok 找到一条第三方转发/讨论 [@wwfalcon](https://x.com/wwfalcon/status/2064615582893555763)，未找到稳定官方号。
- **定位 / 比价对象：** 国内外 14 款 C 端 AI 会员；覆盖豆包、Kimi、GLM Coding、智谱清言、讯飞星火、DeepSeek、ChatGPT 等，并另做地区价。
- **数据呈现 / 更新：** 每条数据标来源与核实日期，区分官方、多源交叉、App Store、社区实录；对无法核实的年费/权益选择不列。[来源](https://www.llmabacus.com/subscriptions)
- **变现：** 未披露。
- **值得借鉴：** 非常适合中文市场：把“官方会员、国内/海外、App 内购、额度不透明、涨价幅度”写在同一决策表中，并显示证据类型。
- **风险 / 可信度：** 部分项目没有官方声明，仍依赖媒体、知乎或社区实录；证据等级虽然有标注，但不能等价看待。

### 9. PriceAI — 强（中文渠道比价）

- **官网：** [priceai.cc](https://priceai.cc/)；[官方地区价页](https://priceai.cc/official-prices)。Grok 曾返回一个错误的 GitHub 仓库归属，本报告不采信该仓库链接。
- **X 证据：** [@0xsakura666 的推荐帖](https://x.com/0xsakura666/status/2087746812413428006)明确介绍“卡网订阅价格 + 中转站价格和性能”，2026-09-02 浏览器核验为约 9 万查看、389 喜欢、537 收藏；[@Irdescent0126 的推荐帖](https://x.com/Irdescent0126/status/2091430010552750550)称其汇总卡网、官方和中转 API，核验为 19,679 查看、96 喜欢、120 收藏。
- **定位 / 比价对象：** 把官方订阅、地区价、卡网订阅、官方 API、中转 API 分成不同购买路径；比较价格、来源、库存和更新时间。
- **数据呈现 / 更新：** 保留渠道名、商品标题、购买链接、库存、更新时间；明确长期未更新低价不能当成可买价。[来源](https://priceai.cc/)
- **变现：** 不卖货、不收款、不参与交易；官网有商业合作与支持作者入口，具体收入结构未披露。[来源](https://priceai.cc/)
- **值得借鉴：** 先问“你要买什么路径”，再比价；官方订阅、代充、成品号、Team 席位和中转 API 不能混在一个价格榜里。
- **风险 / 可信度：** 第三方账号、代充和卡网可能违反厂商条款，存在封号、退款、账号归属和售后风险；聚合站免责声明不能替代商家审核。

### 10. OpenPrice — 强（中文渠道 + 地区价）

- **官网：** [openprice.cc](https://www.openprice.cc/)；[开源收录](https://github.com/bytedoger/awesome-OpenPrice)
- **X 证据：** [@0xQiYan 的传播帖](https://x.com/0xQiYan/status/2080273657688133812) 将其介绍为开源 AI 订阅卡网价格聚合，帖子约 5.1 万查看；评论中还出现 RelayWatch 等相邻项目。
- **定位 / 比价对象：** 聚合 ChatGPT、Claude、Gemini、Grok、Cursor 等代充、成品号、Team、K12 与 App Store 低价区；官网称已收录 263 个渠道商。
- **数据呈现 / 更新：** 按价格排序，展示库存、更新时间和渠道信息；商家可通过常见发卡系统或自建商城规范接入。[来源](https://www.openprice.cc/)
- **变现：** 用户免费，渠道商免费收录；可能依靠流量、合作或相邻工具导流，官方未完整披露。
- **值得借鉴：** “渠道价 + 官方地区价 + 风险指南”三层结构；用户心智不是找最低数字，而是理解购买方式差异。
- **风险 / 可信度：** 与 PriceAI 相同，交易风险显著；传播帖不是官方背书，且高查看量不等于真实成交或商家可靠。

### 11. StackPricing — 中（API / SaaS 有效成本）

- **官网：** [首页](https://stackpricing.com/)；[AI 成本计算器](https://stackpricing.com/calculators/ai/)；[方法论](https://stackpricing.com/methodology/)
- **X 证据：** 未找到明确官方账号；可复现 [X 搜索](https://x.com/search?q=%22StackPricing%22%20AI&src=typed_query)。
- **定位 / 比价对象：** AI 模型 API、邮件、短信等使用量计费产品。不是比固定订阅，而是把每个供应商重算为用户自己的月成本并从低到高排序。
- **数据呈现 / 更新：** 输入 token、输出 token、缓存命中率后计算所有模型的月费；官方价格页为主、滚动复核并标日期，annual rate 换算为月价。[来源](https://stackpricing.com/methodology/)
- **变现：** 声明独立、奖项不付费排名；具体收入未披露。
- **值得借鉴：** “同一工作量下 147× 价差”比单独列 token 单价有冲击力；先统一计量单位再排名。
- **风险 / 可信度：** 计算结果强依赖用户输入与缓存/批处理假设；不能把 API 价格直接类比成消费订阅的实际额度。

### 12. PricePerToken — 中（消费订阅 + API）

- **官网：** [消费订阅页](https://pricepertoken.com/subscriptions)；[作者 @aellman](https://twitter.com/aellman)
- **X 证据：** 官网明确链接作者 X 账号；未找到该产品的稳定官方品牌号。
- **定位 / 比价对象：** ChatGPT、Claude、Gemini、Perplexity、Grok 的免费档、最低付费档、最高档、可用模型及两两比较，并延伸到 API。
- **数据呈现 / 更新：** 一张摘要表 + 每家详细计划 + 所有 head-to-head SEO 页面；官网提供每周价格变化 newsletter。[来源](https://pricepertoken.com/subscriptions)
- **变现：** 页面有 sponsored placement（The Grid）和 newsletter；具体赞助规则未完全披露。
- **值得借鉴：** 订阅与 API 成本放在同一个品牌内，既覆盖普通用户也覆盖开发者；两两组合页面天然适合搜索获客。
- **风险 / 可信度：** 页面更新快，但方法论和历史修订记录不如 PriceMyAI 透明；赞助位要和自然排名视觉隔离。

### 13. OpenRouter — 弱但值得看（模型 / 供应商聚合）

- **官网：** [模型目录](https://openrouter.ai/models)；[比较页](https://openrouter.ai/compare/)；[官方定价与费用 FAQ](https://openrouter.ai/docs/faq)
- **X 证据：** [官方账号 @OpenRouter](https://x.com/OpenRouter)；[模型/路由发布帖示例](https://x.com/OpenRouter/status/2076695493019885655)。
- **定位 / 比价对象：** 400+ 模型、70+ provider，通过统一 API 和余额购买，按价格、上下文、吞吐、延迟、智能指数等排序。
- **数据呈现 / 更新：** 每个模型/端点暴露 prompt、completion、request、image、web search、cache 等细粒度价格；请求按实际服务层级和 provider 费率计费。[来源](https://openrouter.ai/docs/guides/overview/models)
- **变现：** 购买 credits 收 5.5%（最低 $0.80），模型推理价格不加价；超出免费额度的 BYOK 收取等价成本 5%。[来源](https://openrouter.ai/docs/faq)
- **值得借鉴：** 比价与交易闭环结合：用户看完价格可直接消费；自动路由能把“选择最便宜”从信息服务升级为执行服务。
- **风险 / 可信度：** 不是固定月费订阅；provider 质量、路由策略、数据政策和动态定价会影响真实结果。

### 14. Artificial Analysis — 弱但值得看（权威数据层）

- **官网：** [模型/供应商排行榜](https://artificialanalysis.ai/leaderboards/providers)；[数据 API](https://artificialanalysis.ai/data-api)
- **X 证据：** [官方账号 @ArtificialAnlys](https://x.com/ArtificialAnlys)；[品牌数据帖示例](https://x.com/ArtificialAnlys/status/2042309248382906655)。
- **定位 / 比价对象：** 同时比较模型质量、速度、首 token 延迟、上下文和每百万 token 价格；比单纯价格表更接近“性价比”。
- **数据呈现 / 更新：** 自有评测 + 公开价格 + provider endpoint 数据；免费榜单引流，企业可获取更深数据/API。
- **变现：** 企业 Insights、数据 API、定制测试与数据授权。
- **值得借鉴：** 价格必须和质量、速度、可用性一起比较；可以把“便宜但慢/质量差”可视化为效率前沿。
- **风险 / 可信度：** 评测方法、样本和权重会影响排名；仍不是消费级订阅计划比较。

### 15. Prism — 中（订阅与 AI 支出追踪）

- **官网：** [andprism.com](https://www.andprism.com/)；[与手工表格对比](https://www.andprism.com/compare/vs-spreadsheet)
- **X 证据：** 未找到稳定官方账号；可复现 [X 搜索](https://x.com/search?q=%22andprism.com%22&src=typed_query)。
- **定位 / 比价对象：** 面向 AI-native startup 的成本控制，把模型 API、云、SaaS 订阅和邮箱发票聚合到一个 dashboard；不是市场比价，而是追踪“你已经在付什么”。
- **数据呈现 / 更新：** 官网称服务费用每日自动同步；扫描邮箱识别订阅和发票，检测异常支出、闲置服务和续费风险，按模型/项目/时间窗拆分成本。[来源](https://www.andprism.com/)
- **变现：** 7 天 Premium trial，推断为 SaaS 订阅；公开页面未清晰展示长期套餐价格。
- **值得借鉴：** 从“选择前比价”扩展到“购买后持续优化”；僵尸订阅检测、异常提醒、月度节省金额是高留存功能。
- **风险 / 可信度：** 需要邮箱和账单访问，隐私与授权门槛高；首页声称的平均节省额属于营销数据，缺少独立审计。

## X / Grok 补充候选（证据成熟度较低）

以下名称在本轮 X / Grok 搜索中出现，或由主研究任务指定要求纳入。除 Aibijia 外，本子任务没有在停止搜索前保留下足够的一手产品材料，因此只作为下一轮核验队列，避免把域名猜测、同名账号或营销帖误写成产品事实。

### Aibijia — 强（中文渠道比价，高风险）

- **官网 / 源码：** [aibijia.org](https://www.aibijia.org/)；[GitHub](https://github.com/ka-pi-ba-la/AIbijia)
- **X 证据：** [@abskoop 的介绍帖](https://x.com/abskoop/status/2049434000637436049)明确给出官网与 GitHub，2026-09-02 浏览器核验为 35,329 查看、171 喜欢、190 收藏；另有 [@beefnoode 的推荐帖](https://x.com/beefnoode/status/2048410757990318493)，核验为 52,928 查看、368 喜欢、440 收藏。两帖评论同时反复询问“渠道是否稳定、是否会封号、售后是否有保障”，这正是该类产品的核心信任问题。
- **定位 / 比价对象：** ChatGPT、Gemini、Claude Code、Grok 等第三方订阅渠道，并混合部分官方地区差价。
- **数据呈现 / 更新：** 页面动态加载多平台报价；公开更新频率和抓取治理尚未核实。
- **变现：** 未披露；可能通过社区/论坛或渠道导流，不能作为已确认事实。
- **值得借鉴：** 中文产品名直白，搜索意图强；能把模型、计划、购买形态与商家报价放进同一入口。
- **风险 / 可信度：** 灰市风险高；必须独立验证商家、账号归属、售后、厂商条款和价格更新时间。X 讨论不构成背书。

| 待核验名称 | 当前可复现证据 | 暂定相关性 | 下一轮必须确认 |
|---|---|---|---|
| AI Price Radar | [官网](https://ai.pricememo.cn/) · [开源仓库](https://github.com/BeterXie/ai_price_radar) | 强 | 已确认是灰市公开报价聚合：Playwright 发现与扫描 → SQLite 校验 → PostgreSQL → FastAPI → Next.js；库存默认每 10 分钟、候选店铺每小时、新店每 12 小时扫描。仍需核验 X 作者身份与商家治理效果。 |
| PlanTrack | [官网](https://plantrack.uvlio.com/) · [开源仓库](https://github.com/limitcool/plantrack) | 强 | 已确认比较月费、配额、计费方式与历史变更，覆盖 ChatGPT、Claude、Gemini、Cursor、Kimi、MiniMax、OpenRouter；X 品牌声量仍弱。 |
| aiplans.dev | [官网](https://aiplans.dev/) · [开源仓库](https://github.com/x2v-co/aiplans) | 强 | 已确认同时比较消费订阅和同模型在官方、Azure、OpenRouter、SiliconFlow 等渠道的 API 价格，并提供 USD/CNY、支付可达性、榜单与优惠券社区。 |
| MofCloud | [订阅比价页](https://mofcloud.com/tools/subscriptions/) | 强 | 已确认覆盖中外 14 个消费计划，提供最近变更、证据等级、核验日期，以及“订阅 vs API”用量计算器。 |
| AIPricely | [官网](https://aipricely.com/) | 强 | 已确认可选择 40+ AI 工具组成个人 Stack，计算月/年总成本并横向比较；需继续核验主体、价格历史与变现披露。 |
| TokenPlans | [官网](https://tokenplans.dev/) | 中至强 | 已确认专注固定月费 AI Coding Plan，比较价格、旗舰模型与 usage caps；难点是各家额度单位不统一，作者也公开承认无法完全等价换算。 |

> 处理原则：上述候选在补齐“官网主体 + 一手方法论/定价页 + 可归属的 X 帖子”前，不进入正式竞品排名，也不采信 X 帖子里自报的覆盖量、更新速度或最低价承诺。

## 另一个重要赛道：一份订阅打包多模型

这些产品不是中立比价站，但会用“你单独订 ChatGPT + Claude + Gemini 要花多少”作为核心转化钩子，是最直接的替代品。

| 产品 | 做法 | 一手来源 | X | 相关性 / 备注 |
|---|---|---|---|---|
| Onello | 勾选现有订阅，实时计算改用单一平台后的月度/年度节省额 | [官网计算器](https://onello.ai/) · [定价](https://onello.ai/pricing) | [X 搜索](https://x.com/search?q=%22onello.ai%22&src=typed_query) | 强；“先算用户旧账单”是优秀转化组件 |
| AI Fiesta | 一份订阅访问多个主流模型，展示单独购买总价 vs 平台年费 | [官方优惠页](https://offers.aifiesta.ai/) | [@aifiesta](https://x.com/aifiesta) | 强；注意 credits/公平使用限制是否可持续 |
| Writingmate | 200+ 模型共用 credits，支持多模型并排回答 | [成本比较文](https://writingmate.ai/blog/best-ai-subscription-2026-platform-vs-separate-apps) · [定价](https://writingmate.ai/pricing) | [@writingmateai](https://x.com/writingmateai) | 强；比价内容本身也是获客漏斗 |
| Poe | 一份 subscription 购买 compute points，跨文本、图片、视频、音频模型消耗 | [订阅计划](https://poe.com/subscription_plans) · [购买 FAQ](https://help.poe.com/hc/en-us/articles/19945140063636-Poe-Purchases-FAQs) | [@poe_platform](https://x.com/poe_platform) | 中；点数口径复杂，需换算成有效使用量 |
| Magai | 用“Old Way”列出多家订阅总账，再与单一平台月费比较 | [对比落地页](https://get.magai.co/) · [定价](https://magai.co/pricing/) | [X 搜索](https://x.com/search?q=%22Magai%22%20AI&src=typed_query) | 中；典型的 savings-anchor 销售页 |
| Perspective AI | 把三家各 $20/月与自身 $14.99 起直接对照，支持并排模型回答 | [定价](https://perspectiveai.xyz/pricing/) | [@Perspective_AI_](https://x.com/Perspective_AI_) | 中；自身价格和额度可能随底层成本波动 |

## X 侧观察

### 英文 X

- 纯比价站的官方账号普遍缺失或互动很少。AI Price Guide 的[创始人发布帖](https://x.com/ludydev/status/2065475903237591302)是典型 build-in-public：一句痛点（hidden limits/tokens/chaotic pricing）+ 工具规模 + ad-free。
- 有持续内容能力的反而是 OpenRouter、Artificial Analysis 这种“数据 + 交易/企业服务”产品。它们能围绕新模型、调价、速度榜和 provider 变化持续发帖，内容供给天然强于静态目录。
- 大量纯比价产品可能更依赖 SEO，而不是 X 社区；因此“X 上很多”需要区分“被转发的工具”与“在 X 上持续经营的品牌”。

### 中文 X

- PriceAI 的[作者帖](https://x.com/CycleDecoded/status/2063104537641058809)直接承诺“100+ 卡网、实时库存、原站链接、最低价”；这是中文用户最敏感的购买问题。
- OpenPrice 的[传播帖](https://x.com/0xQiYan/status/2080273657688133812)约 5.1 万查看，评论区继续补充其他站点，说明“开源、透明、全网渠道聚合”比单纯官方价格表更容易传播。
- 高传播同时伴随高风险：代充、成品号、Team/K12 席位、跨区购买存在条款、账号归属、支付、售后和封号问题。平台需要把风险等级与价格放在同等位置。

## 产品设计启示

### 最值得直接做进 MVP

1. **三层价格体系**：官方标准价、官方地区/资格价、第三方渠道价分开，不混排。
2. **统一有效月成本**：月付、年付、首月优惠、恢复原价、税费、席位最低数全部换算，并保留原始标价。
3. **额度标准化**：消息数、5 小时窗口、每周额度、credits、tokens、图片/视频分钟数都显示“原始口径 + 可比较口径”。
4. **证据等级**：官方定价页 > App Store/官方帮助 > 官方公告 > 多源交叉 > 社区实录 > 商家自报。
5. **每条价格四件套**：来源链接、最后核验时间、历史变化、下次续费/优惠到期。
6. **组合优化器**：不是问“哪一个最好”，而是按用户的写作/编程/研究/视频需求与预算推荐订阅组合。
7. **可分享页面**：每个双产品、双计划、地区或渠道筛选都生成可分享 URL，方便在 X 传播与 SEO 收录。

### 可形成壁垒的第二阶段

- 价格变更监控与推送；
- 用户自己的订阅账单导入、续费提醒与僵尸订阅检测；
- “订阅 vs API vs 聚合平台”盈亏平衡计算；
- 价格 × 质量 × 速度 × 隐私的多目标推荐；
- 商家/厂商自助提交，但所有自报数据必须等待独立核验；
- 历史价格 API、RSS、嵌入式 widget 和媒体可引用数据。

## 主要风险

1. **数据过期是第一风险。** AI Price Guide 的整体核验日期明显落后，证明全人工维护很难覆盖几十上百个工具。
2. **口径混淆。** 年付有效月价、首月促销、税费、地区价、家庭共享、团队席位最低数不能直接和单月个人价同列。
3. **额度不可比。** “5× usage”“每天 300 次”“1000 credits”如果不解释基准，只会制造假精确。
4. **affiliate 利益冲突。** 必须把 affiliate、广告、赞助位与自然排序清晰隔离，并允许查看纯价格排序。
5. **渠道合规与诈骗。** 代充/成品号可能违反厂商条款；聚合站要做商家身份、历史、投诉、售后和下架机制，不能只做最低价榜。
6. **地区价不等于可购买价。** App Store 低价区还涉及账号地区、付款方式、税费、家庭共享、汇率和封控。
7. **聚合订阅的单位经济学。** 低价包多模型容易被重度用户打穿成本；必须公开 credits、限速、公平使用和模型替换规则。

## 下一轮建议深挖

按价值排序，建议下一轮分别拆解：

1. **PriceMyAI**：数据模型、历史价格、优惠与 affiliate SEO。
2. **SubChoice**：测验、评分权重、组合订阅优化器。
3. **PriceAI / OpenPrice**：中文渠道结构、库存抓取、风控与商家接入。
4. **OpenRouter**：价格数据 API、路由和交易闭环。
5. **Prism**：购买后订阅管理、账单导入与异常检测。

可进一步产出：竞品功能矩阵、数据字段字典、抓取/核验流程、MVP 信息架构，以及 10 个适合在 X 发布的可分享比价卡片模板。
