# 官方订阅价自动化采集方案：各地区、各套餐如何定期采集

> 2026-09-08 复审：下文实施计数是 Claude 原始本地实验结果，包含现已撤销的金额推断规则，不代表最终可比较价格覆盖率。Dokploy 最终运行方案见 `docs/operations/dokploy.md`。同名多金额和跨渠道金额相等只保留候选线索，不证明 SKU 身份或计费周期；404 只证明页面未提供。

> 核验日期：2026-09-07（北京时间）。目标：平台上线后，各地区、各 AI 套餐的官方价格能够自动、定期采集，每条价格保留来源、周期证据与时间。本文所有“实测”均为当日从本机直接请求得到的结果，未使用代理、未登录。

## 一、结论

按“能否自动化”把来源分成三档：

| 档位 | 来源 | 结论 |
|---|---|---|
| 可完全自动化 | Apple App Store 各商店内购标价 | 页面内嵌 `serialized-server-data` JSON，含“内购名 → 标价”对，比现有 `<span>` 正则稳定；实测 22 个商店全部可解析。可覆盖 Apple 全部公开商店。 |
| 可完全自动化 | Google AI Plus / Pro / Ultra 各国官网价 | `https://gemini.google/{国家码}/subscriptions/` 服务端渲染，按国家路径直接输出本币价并写明“/month”；不需要代理。实测 30 国中 27 国返回该国价格，hk / cn / ru 返回 404。 |
| 可完全自动化 | 汇率 | ECB 已接入；扩大地区后需要第二汇率源（见 §5.6）。 |
| 可完全自动化 | OpenAI 各国网页价 | 定价页自身调用的匿名接口 `chatgpt.com/backend-anon/checkout_pricing_config/configs/{国家码}` 返回该国官方网页价 JSON：Go、Plus 月付与年付、Pro 5x、Pro 20x、Business，含币种、含税或不含税标记与促销。国家码是路径参数，不需要代理。普通 HTTP 请求被 Cloudflare 拦截，用仓库现有的 Playwright Chromium 直接访问即可（实测 200，1 秒内返回）。实测 47 国中 44 国有配置，HK / CN 无配置。详见 §3.5。 |
| 部分自动化 | Anthropic 网页价 | 官方说明地区价在 `claude.ai/upgrade`（需登录）或应用商店查看。网页地区价无法匿名抓取；印度卢比定价只能以公告证据录入。App Store 是唯一可自动化的地区来源，且内购名自带 Monthly / Annual。 |
| 部分自动化 | xAI 网页价 | 官网仅美元（SuperGrok $30/月、SuperGrok Plus $100/月）。地区价靠 App Store；同名 SuperGrok $30 / $300 的周期无法从公开来源证明。 |
| 不可自动化 | Google Play 逐 SKU 价格 | 公开页只有 “₹399.00 - ₹19,900.00 per item” 这类区间，没有公开接口。建议把区间入库，精确价靠用户提交结算截图。 |

因此“各地区各套餐自动定期采集”可以做到的边界是：**Apple 渠道全地区、OpenAI 网页价全地区、Google 网页价全地区、四家厂商美国网页参考价、Google Play 区间**自动化，且都不需要代理或账号；**Anthropic / xAI 各地区网页结算价、Google Play 精确价**没有公开来源，只能靠 App Store、公告与用户证据。按 IP 渲染定价页不再是必需项，只作为核对 OpenAI 接口的可选手段。

## 二、现状

### 2.1 调度与范围

- GitHub Actions 每小时 POST Vercel `/api/cron/official-subscriptions`（`maxDuration = 60` 秒），Worker 另有每小时兜底 `PRICE_REFRESH_INTERVAL_MS`。
- 范围：13 个套餐 × 12 个地区 × 3 个渠道 = 468 个组合。最近一次覆盖 CSV 的状态分布：verified 120、price_not_public 159、regional_checkout_required 77、fetch_failed 72、ambiguous_sku 33、sku_not_listed 7。
- Apple 解析依赖相邻两个 `<span>` 的正则；官网价靠人工种子加逐厂商正则；Google Play 只记状态，不保存区间。

### 2.2 现有实现扩大范围时会遇到的问题

1. **地区目录是手写的**：扩到 Apple 全部商店需要“商店码 → 币种”目录，页面 JSON 里只有 `storefront`，没有币种代码；墨西哥商店显示 `$399.00`，符号本身不能区分币种。
2. **无效商店码会被 Apple 重定向到美国**：实测 `apps.apple.com/zz/...` 与 `/kp/...` 均 302 到 `/us/`（HTTP 200），`/cn/` 返回 404。现有 `fetchText` 跟随重定向且不校验最终 URL，扩大目录后会把美国价格写到错误地区。
3. **同名多金额一律判为歧义**：ChatGPT 的 App Store 列表在实测的 11 个商店里都有两条 “ChatGPT Plus”，第二条金额与同页 “ChatGPT Pro 20x” 完全相等（美国 $200、德国 229,00 €、土耳其 ₺9.999,99 等）。这是可以在同一页面内解释的遗留 SKU，现在却让 Plus 在所有商店被降级为待核验。
4. **每小时刷新既过度又不够**：Apple 与 Google 的价格变动以周、月计，每小时抓取没有信息增量；而扩到 700 个 Apple 页面后，Vercel 60 秒上限必然超时。
5. **官网解析没有变更检测**：解析器返回 0 条时只记 `price_not_public`，页面改版和真实下架无法区分。

## 三、逐来源实测

### 3.1 Apple App Store（可自动化，全地区）

页面 `https://apps.apple.com/{storefront}/app/id{appId}` 内含 `<script type="application/json" id="serialized-server-data">`。其中 `$kind = "Annotation"` 且 `items_V3` 为 `textPair` 的块就是内购列表，`leadingText` 是内购名，`trailingText` 是本币标价字符串。标题按商店语言本地化（“In-App Purchases” / “アプリ内購入”），但结构与套餐名不变，解析时不依赖标题。

日本 Claude 页面（`id6473753684`）实测：

```json
{"$kind": "textPair", "leadingText": "Claude Pro - Monthly", "trailingText": "¥3,000"}
{"$kind": "textPair", "leadingText": "Claude Max 5x - Monthly", "trailingText": "¥20,000"}
{"$kind": "textPair", "leadingText": "Claude Pro - Annual", "trailingText": "¥35,000"}
{"$kind": "textPair", "leadingText": "Claude Max 20x - Monthly", "trailingText": "¥40,000"}
```

ChatGPT（`id6448311069`）在 11 个商店的内购对（原样，含同名重复项）：

| 商店 | Go | Plus | Pro 5x | Pro 20x | 第二条 “ChatGPT Plus” |
|---|---:|---:|---:|---:|---:|
| us | $8.00 | $19.99 | $100.00 | $200.00 | $200.00 |
| ng | ₦6,900.00 | ₦31,500.00 | ₦144,900.00 | ₦299,900.00 | ₦299,900.00 |
| ar | USD 5.99 | USD 19.99 | USD 100.00 | USD 200.00 | USD 200.00 |
| vn | 132.000đ | 499.000đ | 2.849.000đ | 4.999.000đ | 4.999.000đ |
| tr | ₺249,99 | ₺999,99 | ₺5.299,99 | ₺9.999,99 | ₺9.999,99 |
| de | 7,99 € | 22,99 € | 102,99 € | 229,00 € | 229,00 € |
| kr | ￦13,000 | ￦29,000 | ￦159,000 | ￦299,000 | ￦299,000 |
| mx | $129.00 | $399.00 | $1,989.00 | $3,999.00 | $3,999.00 |
| za | R149.99 | R399.99 | R1,839.00 | R3,999.99 | R3,999.99 |
| eg | EGP 249.99 | EGP 999.99 | EGP 5,399.99 | EGP 9,999.99 | EGP 9,999.99 |
| pk | Rs 1,400.00 | Rs 4,900.00 | Rs 27,999.00 | Rs 49,900.00 | Rs 49,900.00 |

美国 Grok（`id6670324846`）列表：SuperGrok $30.00、SuperGrok $300.00、SuperGrok $30.00（重复）、SuperGrok Lite $10.00、SuperGrok Heavy $300.00、SuperGrok Plus $100.00，另有四档 Extra Usage Credits。美国 Gemini（`id6477489729`）列表：Google AI Plus (400 GB) $4.99、Google AI Pro (5 TB) $19.99（出现 5 次，金额相同）、Google AI Ultra (30 TB) $199.99、100 GB $1.99。

其他要点：

- JSON 里没有计费周期、没有币种代码，只有 `storefront`。周期仍需 §5.3 的规则。
- `apps.apple.com/robots.txt` 允许 `/app` 页面，禁止 `/api/*`、`/v1/*`、`/WebObjects/*`。不要改用 `amp-api` 私有接口（本次实测该页面也不再暴露 token）。
- 一个 App 在不发售的商店返回 404（ChatGPT 在 cn），可作为“该地区不可购买”的证据；无效商店码被重定向到 us，必须校验最终 URL。

### 3.2 Google AI 套餐（可自动化，全地区，无需代理）

`one.google.com/about/google-ai-plans/` 与旧结论一致，套餐卡片没有金额（只有 JSON-LD 里的 “Starting at $7.99/mo” 总类起价，且该值已过时）。可用来源是 **`https://gemini.google/{cc}/subscriptions/?hl=xx`**：服务端渲染，按国家路径输出该国本币价。`hl` 只影响语言；不带国家路径、只用 `hl=en-PH` 之类会回落到美国价，必须用国家路径并校验 `<link rel="canonical">` 里的国家段。

实测（`?hl=en`，Ultra 两档按“Starting at”文案给出）：

| 国家 | AI Plus | AI Pro | AI Ultra 5x | AI Ultra 20x |
|---|---:|---:|---:|---:|
| us | $4.99 | $19.99 | $99.99 | $199.99 |
| gb | £4.49 | £18.99 | £79.99 | £189.99 |
| in | ₹399 | ₹1,950 | ₹6,500 | ₹19,500 |
| jp | ¥725 | ¥2,900 | ¥14,500 | ¥32,000 |
| de | €4,99 | €21,99 | €99,99 | €219,99 |
| br | R$24,99 | R$96,99 | R$779,9 | R$999,9 |
| ca | CA$6.99 | CA$26.99 | CA$139.99 | CA$279.99 |
| au | A$7.99 | A$32.99 | A$149.99 | A$329.99 |
| sg | SGD 6.98 | SGD 28.99 | SGD 139.99 | SGD 289.98 |
| tw | NT$165 | NT$650 | NT$3300 | NT$6500 |
| kr | ₩7,500 | 卡片无金额 | ₩119,000 | ₩300,000 |
| mx | MXN 99 | MXN 395 | MXN 1,999 | MXN 3,949 |
| tr | ₺199,99 | ₺869,99 | ₺1.479,99 | ₺8.999,99 |
| id | Rp 75.000 | Rp 309.000 | Rp 1.579.000 | Rp 3.399.000 |
| ng | NGN 7,700 | NGN 28,500 | NGN 89,000 | NGN 289,000 |
| za | ZAR 104.99 | ZAR 429.99 | ZAR 1,859.99 | ZAR 4,299.99 |
| my | MYR 23.99 | MYR 97.99 | MYR 429.99 | MYR 979.9 |
| nz | NZ$8.99 | NZ$36.99 | NZ$169.99 | NZ$369.99 |

ph、th、vn、ar、eg、pk、sa、ae、pl、se、ch、fr 也返回各自国家页面（价格格式随语言变化，需按卡片解析而非全文正则）；hk、cn、ru 返回 404。

页面结构：每个套餐是一个 `div._card_*`，套餐名在 `div._cardLogoText_*`（“Google AI Plus” / “Google AI Pro” / “Google AI Ultra”），金额在 `span.price > span.price-amount`，货币符号或代码与周期词（“/ month”、“JPY / 月”、“EUR/Monat”、“每月 … 元”）在同一容器内。韩国的 Pro 卡片本次没有金额，解析器必须把“卡片存在但无金额”记为 `price_not_public`，不能报错也不能借用其他国家。

这是唯一一个能直接拿到各国官方网页价的厂商来源，还能顺带证明 App Store 内购的周期：美国 App Store 的 “Google AI Plus (400 GB) $4.99” 与 “Google AI Pro (5 TB) $19.99” 与该页月价完全一致（§5.3 规则 C）。

`gemini.google/robots.txt` 本次返回了压缩内容未能读取，实施前需再确认。

### 3.3 Google Play（只能得到区间）

`play.google.com/store/apps/details?id=com.openai.chatgpt&hl=en&gl=IN` 的内嵌数据里有 `"₹399.00 - ₹19,900.00 per item"`，没有逐 SKU 价格。第三方站（如 opentherank）把区间上下限映射为 Go 与 Pro 20x，这是推断。建议入库为 `price_kind = range`，并用作一致性检查（例如 iOS 的 Go 价不应低于 Play 区间下限）。`play.google.com/robots.txt` 未禁止 `/store/apps/details`，但 Google Play 服务条款限制自动访问，保持每日一次的低频。

### 3.4 厂商官网与帮助中心

| 来源 | 直接请求 | 通过 Jina Reader 渲染 | 内容 |
|---|---|---|---|
| `chatgpt.com/pricing` | 403（Cloudflare challenge） | 成功 | Go $8 / 月、Plus $20 / 月、Pro “From $100 / 月”；HTML 里没有按国家的价格表，金额由前端调用 §3.5 的接口填充 |
| `openai.com/chatgpt/pricing/` | 403 | 未测 | 同上 |
| `help.openai.com` | Jina 可读 | 成功 | Go 文章：“available in all countries ChatGPT is supported in. All purchases are in USD - we offer a local currency billing in a limited set of countries”“Subscriptions are billed automatically monthly”“we do not support annual billing … for ChatGPT Go, Plus, or Pro” |
| `help.openai.com` 多币种文章 | Jina 可读 | 成功 | 列出约 70 种网页结算币种（AED、INR、TRY、PHP、VND…），未列价格，指向 pricing 页 |
| `claude.com/pricing` 及 `/ja/` `/de/` `/fr/` `/ko/` `/it/` 本地化页 | 200 | 不需要 | 全部仅美元：Pro $20（年付折合 $17）、Max $100 / $200；带 `Accept-Language: hi-IN` 请求也不出现卢比价；页面无按国家取价的接口 |
| `claude.ai/upgrade` | 403（未登录） | 不适用 | 官方指引的地区价查看入口，需登录 |
| `grok.com/pricing` | 未测 | 渲染为空页 | 无公开地区价 |
| `support.claude.com` Pro 文章 | Jina 可读 | 成功 | “available for $20 per month (US), with pricing in your local currency where supported. Monthly pricing varies by region, and some regions include applicable taxes … Visit claude.ai/upgrade or check your mobile app store for current pricing in your region.” |
| `x.ai/pricing` | 403 | 成功 | SuperGrok $30/month、SuperGrok Plus $100/month；页面无年付金额 |
| `gemini.google/subscriptions` | 200 | 不需要 | 见 §3.2 |

补充事实（用于目录与证据）：

- Anthropic 于 2026-07-13 起在印度以卢比定价（TechCrunch、Business Standard 报道）：Pro 年付折合 ₹2,000/月、Max 起 ₹11,999/月、Team ₹2,399/席/月，含税；官网未见公开价格表，需以公告作为证据类型录入。
- OpenAI 在印度以卢比定价（Plus ₹1,999 含 GST、Pro ₹19,900，Croma 等报道），官方帮助中心只列币种不列金额，同样需公告或结算证据。
- Google AI Plus 于 2026-06 从 $7.99 降到 $4.99 并把存储提高到 400 GB（9to5google、TechCrunch 报道）；`one.google.com` 结构化数据里仍写 “Starting at $7.99/mo”，说明同一厂商的不同页面会不同步，证据日期必须展示。
- 土耳其 App Store 的 ChatGPT Plus 本次为 ₺999,99，与第三方报道的 2026 年内从 ₺499,99 翻倍一致。

### 3.5 OpenAI 定价配置接口（可自动化，全地区，无需代理）

定价页的前端代码（`chatgpt.com/cdn/assets/conversation-small-*.js`）里，结账价格来自 `G.safeGet("/checkout_pricing_config/configs/{country_code}", { authOption: SendIfAvailable })`，即未登录也可调用。完整地址：

```text
https://chatgpt.com/backend-anon/checkout_pricing_config/configs/{ISO 3166-1 两位国家码}
```

返回结构（印度示例，2026-09-07 实测）：

```json
{"country_code":"IN","currency_config":{
  "go":{"month":{"amount":399.0,"tax":"inclusive"}},
  "plus":{"month":{"amount":1999.0,"tax":"inclusive","psp_override":{"amount":1694.07,"tax":"exclusive"}},
          "year":{"amount":1665.83,"tax":"inclusive","psp_override":{"amount":1411.72,"tax":"exclusive"}}},
  "prolite":{"month":{"amount":10699.0,"tax":"inclusive","psp_override":{"amount":9066.95,"tax":"exclusive"}}},
  "pro":{"month":{"amount":19900.0,"tax":"inclusive","psp_override":{"amount":16864.41,"tax":"exclusive"}}},
  "business":{"month":{"amount":2250.0,"tax":"exclusive"},"year":{"amount":1800.0,"tax":"exclusive"}},
  "symbol_code":"INR","tax_type":"gst","amount_per_credit":3.4,"promos":{...}}}
```

字段与套餐的对应（以美国配置反推：`prolite` = $100、`pro` = $200）：

| 接口键 | 套餐 | 说明 |
|---|---|---|
| `go.month` | ChatGPT Go | 仅月付 |
| `plus.month` / `plus.year` | ChatGPT Plus | `year` 为年付折合的每月金额（美国 16.67 = $200/年）；帮助中心仍写“不支持年付”，入库时按接口原样记录并标注来源冲突 |
| `prolite.month` | ChatGPT Pro 5x | |
| `pro.month` | ChatGPT Pro 20x | |
| `business.*`、`business_prolite.*`、`business_non_profit.*`、`sci.*` | Business / 科研等 | 当前目录外，可先入库 |
| `tax` | 含税或不含税 | `inclusive` / `exclusive`，逐金额标注 |
| `psp_override` | 换支付通道时的不含税基价 | 印度 1999 ÷ 1.18 ≈ 1694.07，保存但不作展示价 |
| `symbol_code` / `tax_type` | 币种 / 税种 | `gst` `vat` `jct` `other` |
| `pricing_rollout_gate` | 本币定价灰度开关 | 有值（如 `is_pricing_enabled_for_brl`）表示部分用户仍可能回落到美元或欧元配置，入库时标 `rollout_gated` |
| `promos` | 促销 | 例如 `plus_intro_offer_3m: 10`，只记录不改写标准价 |

实测 47 个国家码（含 `EU` 区域码）的 Plus 月价：

| 国家 | 币种 | Go | Plus 月 | Plus 年折月 | Pro 5x | Pro 20x | 税 | 灰度 |
|---|---|---:|---:|---:|---:|---:|---|---|
| US | USD | 8 | 20 | 16.67 | 100 | 200 | 不含 | 否 |
| IN | INR | 399 | 1,999 | 1,665.83 | 10,699 | 19,900 | 含 GST | 否 |
| TR | USD | 6 | 20 | 16.67 | 120 | 200 | 混合 | 否 |
| BR | BRL | 39.99 | 99.9 | 83.25 | 525 | 999.9 | 不含 | 是 |
| PH | PHP | 300 | 1,100 | 916.67 | 6,490 | 9,990 | 含 VAT | 否 |
| DE / FR / IT / ES / NL / IE / EU | EUR | 8 | 23 | 19.17 | 103 | 229 | 含 VAT | 否 |
| GB | GBP | 7 | 20 | 16.67 | 89 | 200 | 含 VAT | 否 |
| JP | JPY | 1,400 | 3,000 | 2,500 | 16,800 | 30,000 | 含 JCT | 是 |
| KR | KRW | 13,000 | 29,000 | 24,166.67 | 159,000 | 299,000 | 含 VAT | 是 |
| TW | TWD | 270 | 690 | 575 | 3,300 | 6,990 | 含 | 是 |
| NG | NGN | 7,000 | 31,500 | 26,250 | 144,900 | 299,900 | 含 VAT | 否 |
| VN | VND | 132,000 | 522,500 | 435,416.67 | 2,849,000 | 5,225,000 | 含 VAT | 否 |
| ID | IDR | 75,000 | 349,000 | 290,833.33 | 1,889,000 | 3,499,000 | 含 VAT | 否 |
| MX | MXN | 110 | 399 | 332.5 | 1,972 | 3,999 | 含 VAT | 是 |
| CA | CAD | 11 | 25 | 20.83 | 136 | 250 | 不含 | 是 |
| AU | AUD | 13 | 30 | 25 | 155 | 300 | 含 | 是 |
| SG | SGD | 11 | 30 | 25 | 138 | 300 | 含 | 是 |
| CH | CHF | 7 | 20 | 16.67 | 83 | 200 | 含 | 是 |
| SA / AE / IL / NZ / CO / CL / PE | 本币 | — | 有 | 有 | 有 | 有 | 含 | 是 |
| TH / MY / PK / EG / ZA / PL / SE | 本币 | — | 有 | 有 | 有 | 有 | 含 | 否 |
| AR / BD / LK / KE / GH / UA | USD | 5–7 | 20 | 16.67 | 100–120 | 200 | 混合 | 否 |
| HK / CN / XX | — | 返回 `Country config not found` | | | | | | |

与 App Store 对照：印度 Go 399 与 iOS 内购一致；德国 Plus 网页 €23 含税、iOS 22,99 €；土耳其网页按美元 $20、iOS ₺999,99。三者是不同渠道的不同事实，页面上分开展示。

抓取层：`curl` 与 Node `fetch` 会收到 Cloudflare 403 页面；仓库现有的 Playwright Chromium（`apps/browser-worker`）以普通桌面 UA 打开该地址即可拿到 JSON，实测 TR 880 ms、IN 313 ms。Jina Reader 也能读到，但生产环境不应依赖第三方读取器。

边界：这是定价页的内部接口，没有公开文档，可能随时改名或改结构；必须保留 §5.2 的结构指纹告警，并定期用渲染后的定价页金额交叉核对（美国 Go $8、Plus $20、Pro from $100 与接口一致）。结算价仍取决于付款方式所属国家，这里的数据是“该国官方网页标价”。

### 3.6 第三方比价站怎么做

GeoSub、aisubscriptioncomparison、opentherank、appark、aisubdeal、viewappprice 等站点的“各国价格”几乎全部来自 App Store 内购列表，少数加上 Google Play 区间；没有一家自动化了各国网页结算价，opentherank 明确提示“verify at chatgpt.com/pricing from your region”。这说明 §3.1 + §3.2 已经是行业上限，网页地区价是可以做出差异的地方，但要诚实标注口径。

## 四、目标架构

```text
地区目录（Apple 商店 × Google 国家 × 网页币种）
        ↓
Worker 定时任务（BullMQ repeat，按来源独立）
        ↓
适配器：apple-storefront / gemini-country-page / google-play-range /
       vendor-doc / geo-rendered-page（二期）/ manual-evidence
        ↓
原始证据（JSON 片段 + SHA-256 → 对象存储，复用卡网证据机制）
        ↓
周期与歧义规则 → official_subscription_prices / _history / _checks
        ↓
异常与告警（解析为 0、条数骤降、结构变化、最终 URL 不符）
```

### 4.1 适配器

1. **apple-storefront**：输入 `appId + storefront`。GET 页面；校验 `response.url` 的商店段等于请求值，否则记 `storefront_redirected`；404 记 `not_available`。解析 `serialized-server-data` 中的 `textPair`，输出 `rawPlanName / displayAmount / amount / currency`，币种来自目录而非符号。保存 JSON 片段与哈希。
2. **gemini-country-page**：输入国家码。GET `/{cc}/subscriptions/?hl=en`；校验 canonical 含 `/{cc}/`；404 记 `not_available`。按 `_card_` 切块，`_cardLogoText` 取套餐名，`price-amount` 取金额，同容器文本判定币种与“月”词；Ultra 卡片取两档并映射 5x / 20x；无金额卡片记 `price_not_public`。
3. **google-play-range**：解析 `"X - Y per item"` 为 `range`，不映射 SKU。
4. **vendor-doc**：保留现有 OpenAI / Anthropic / xAI 官网与帮助中心解析，作为美国参考价与周期证据来源。
5. **openai-checkout-config**：在浏览器 Worker 中打开 §3.5 接口，按国家码逐个取 JSON；校验 `country_code` 回显；`Country config not found` 记 `not_available`；逐金额保存 `tax`、`psp_override`、`pricing_rollout_gate`、`promos`；键到套餐的映射固定在代码里（`prolite` → Pro 5x、`pro` → Pro 20x），出现未知键时记异常而不是忽略。
6. **geo-rendered-page**（可选）：通过带国家定位的渲染服务抓 `chatgpt.com/pricing`，只用于核对接口数据与访客实际看到的金额是否一致。
7. **manual-evidence**：公告价（Claude 印度）与用户结算截图，走现有审核队列，带 `evidence_kind = announcement | user_receipt`。

### 4.2 地区目录

- Apple：从 Apple “财务报告地区与币种”表生成（44 个独立币种地区，加欧元区 EUR、拉美加勒比 USD、南亚太平洋 USD、其余 USD），再用一次性枚举（对全部 ISO 3166-1 国家码请求 ChatGPT 页面，保留最终 URL 商店段一致且有 JSON 的）确认实际可用的商店码。目录字段：`countryCode / storefront / currency / region / displayName / active`。
- Google：一次性枚举 `gemini.google/{cc}/subscriptions/`，200 且 canonical 一致的入目录，404 记为未开放；每月复扫一次以发现新开放国家。
- 网页币种：OpenAI 多币种文章的币种列表用于决定二期渲染哪些国家。

### 4.3 调度节奏

| 来源 | 频率 | 规模 | 说明 |
|---|---|---|---|
| Apple | 每日 1 次 | 约 175 商店 × 4 App ≈ 700 请求，12 并发约 2–3 分钟 | 每页约 700 KB，带抖动与单源熔断 |
| Google 国家页 | 每日 1 次 | 约 150 请求 | 同上 |
| OpenAI 配置接口 | 每日 1 次 | 约 250 个国家码，浏览器 Worker 单页顺序访问约 5 分钟 | 每次 JSON 约 3 KB；首轮枚举后只访问有配置的国家，每月复扫全部 |
| Google Play 区间 | 每日 1 次 | 4 App × 地区 | 低频 |
| 厂商官网 / 帮助中心 | 每 6 小时 | 十余页 | 现有逻辑 |
| geo 渲染（二期） | 每周 1 次 | 币种国家数 × 1 页 | 付费服务 |
| ECB 汇率 | 每日 1 次 | 1 请求 | 现有逻辑 |

全部放到 Worker 的 BullMQ repeat job，每个来源独立 `try/catch` 与告警；Vercel cron 端点只保留“立即触发”和汇总，不再承担采集本身。

### 4.4 数据模型增补

- `official_subscription_prices` 增加 `billing_evidence_method`（枚举，见 §5.3）与 `raw_evidence_uri`。
- `official_subscription_checks` 增加 `http_status`、`final_url`、`parsed_count`。
- 新表 `official_storefronts`（Apple 与 Google 的地区目录，含 `not_available_since`）。
- `price_kind = range` 已有字段，直接启用。

## 五、规则

### 5.1 最终 URL 校验

任何来源都记录最终 URL；商店段或国家段不一致时不写价格，记 `storefront_redirected` 或 `country_fallback`。

### 5.2 变更检测

- 解析条数为 0 或较上次下降超过一半 → 打开异常，保留旧价，不刷新 `verified_at`。
- 页面结构指纹（Apple：注释块数量与键集合；Google：`_card_` 数量与 `price-amount` 数量）变化 → 打开异常。
- 同一证据哈希只更新核验时间，不追加历史（现有规则）。

### 5.3 周期证据（决定是否参与比较）

| 方法 | 条件 | 例子 | 状态 |
|---|---|---|---|
| A `explicit_sku_name` | 内购名含 Monthly / Annual | Claude | 参与比较 |
| B `official_plan_document` | 厂商文档写明仅月付 | OpenAI Go / Plus / Pro | 参与比较 |
| C `same_country_vendor_page_match` | App Store 金额等于同国 `gemini.google` 月价 | Google Plus / Pro / Ultra | 参与比较 |
| D `duplicate_of_other_plan` | 同名重复项金额等于同页另一套餐金额 | ChatGPT Plus 第二条 = Pro 20x | 重复项不入价，主项按 B 处理 |
| C′ `vendor_monthly_amount` | 同名多金额中恰有一个等于同国官网月价 | Google AI Plus 4.99 / 49.99，官网月价 4.99 | 选中相等的一项并按 C 确认周期，其余金额只作记录 |
| E `ambiguous_sku` | 其他同名多金额 | SuperGrok $30 / $300（非美国商店） | 保存全部金额，不参与比较 |

不做“十倍即年付”之类的倍数推断。规则 D 只在同一页面内成立，不跨商店推断。

### 5.4 税费与促销

- 每条价格保留 `tax_treatment`：Apple 按商店、Google 页面按国家（部分写含税）、OpenAI 印度含 GST、Anthropic 印度含税。
- 页面出现 “Starting at”“first N months”“then” 等词时只记录标价并标 `promo_possible`，不改写为标准月价。

### 5.5 可购买性

- Apple 404 与 Google 404 记为 `not_available`，在页面上显示为“该地区未上架”，与“来源未提供价格”区分。

### 5.6 汇率

ECB 参考汇率只覆盖约 30 种货币，扩到全部商店后 NGN、EGP、PKR、VND、KZT、SAR、AED、QAR、TZS、CLP、COP、PEN、TWD 等没有汇率。方案：ECB 为主；其他币种接入一个公开可回溯的第二来源并记录来源与日期；没有汇率时 `cny_estimate` 留空（现有 TWD 的处理方式），不阻塞原币入库。

## 六、分阶段实施

| 阶段 | 内容 | 预估 |
|---|---|---|
| 0 | Apple 解析器改为 JSON 块；最终 URL 校验；规则 D；Google Play 区间入库；补回归测试 | 1–2 天 |
| 1 | Apple 商店目录（枚举生成）；Google 国家页适配器与目录；OpenAI 配置接口适配器（浏览器 Worker）与国家枚举；规则 C；调度迁移到 Worker 并改为每日；变更检测与告警；页面显示 `not_available` 与 `rollout_gated` | 5–7 天 |
| 2（可选） | 用带国家定位的渲染服务对 IN / TR / BR / PH / DE 渲染 `chatgpt.com/pricing`，核对访客看到的金额与接口一致；同法检查 `claude.com/pricing` 是否对印度访客显示卢比价 | 2–3 天，需注册服务 |
| 3 | 用户结算截图证据流程（Google Play、Anthropic / xAI 网页结算价）；公告价录入流程；扩目录（ChatGPT Business、Plus 年付、Grok Lite / Heavy、Google AI Plus 2 TB、Claude 印度 INR、Ultra 5x） | 持续 |

可选阶段的成本参考：ScrapingBee Hobby $19/月含 75,000 credits，JS 渲染加高级代理每次 25 credits，即约 3,000 次/月；5 个国家每周一次只需约 100 次/月。Zyte API 浏览器渲染按公开报价每千次 $1–16，并支持 `geolocation` 字段。Bright Data Web Unlocker 按每千次 $1.5 计。阶段 0 与 1 不产生外部服务费用。

## 七、风险与边界

- **口径**：App Store 标价、Google 网页价、按 IP 渲染的网页标价、结算价是四个不同的事实，页面上必须分别命名，不能合并成“当地价”。
- **OpenAI 结算价按付款方式国家决定**：接口给出的是该国官方网页标价，用户实际结算取决于付款方式所属国家，页面文案要说明。
- **OpenAI 配置接口无公开文档**：可能改名、改结构或加鉴权；必须保留结构指纹告警和定价页渲染核对，接口失效时保留上一份已核验快照。带 `pricing_rollout_gate` 的国家（BR、JP、KR、MX、CA、AU、SG、CH、SA、AE、IL、NZ、CO、CL、PE、TW 等）部分用户仍可能看到美元或欧元价。
- **服务条款**：Apple 与 Google 页面保持每日一次、带 User-Agent 与抖动；不用私有接口；Google Play 只取公开区间。
- **价格频繁变动**：土耳其翻倍、Google AI Plus 降价、Anthropic 印度定价等都发生在近三个月内，每条价格必须展示证据日期，过期数据退出比较（现有陈旧策略）。
- **KR Pro 卡片无金额、CA 页面 `$CA` 后置格式、印尼 `Rp 14.500` 千分位**等格式差异说明解析必须以卡片为单位并覆盖测试，不能全文正则。

## 附录：来源

- Apple 财务报告地区与币种：https://developer.apple.com/help/app-store-connect/reference/financial-report-regions-and-currencies
- Apple 各商店 App 页面示例：https://apps.apple.com/jp/app/id6473753684 、https://apps.apple.com/tr/app/id6448311069
- Google 各国订阅页示例：https://gemini.google/in/subscriptions/?hl=en 、https://gemini.google/gb/subscriptions/?hl=en
- Google AI Plus 降价：https://9to5google.com/2026/06/08/google-ai-plus-price-drop/
- Google AI Plus 覆盖国家：https://blog.google/products-and-platforms/products/google-one/google-ai-plus-availability/
- OpenAI 定价配置接口示例：https://chatgpt.com/backend-anon/checkout_pricing_config/configs/IN （需浏览器访问）
- OpenAI Go 说明：https://help.openai.com/en/articles/11989085-what-is-chatgpt-go
- OpenAI 多币种结算：https://help.openai.com/en/articles/10421635-multicurrency-billing
- Anthropic Pro 说明：https://support.claude.com/en/articles/8325606-what-is-the-pro-plan
- Anthropic 印度定价报道：https://techcrunch.com/2026/07/13/anthropic-starts-localizing-claude-pricing-for-india-its-biggest-market-after-the-us/
- xAI 定价：https://x.ai/pricing
- Google Play 页面示例：https://play.google.com/store/apps/details?id=com.openai.chatgpt&hl=en&gl=IN
- ScrapingBee 文档与价格：https://www.scrapingbee.com/documentation/ 、https://www.scrapingbee.com/pricing/
- Zyte API 地理定位：https://www.zyte.com/geolocation/
- Bright Data Web Unlocker 价格：https://brightdata.com/pricing/web-unlocker
- 第三方比价站方法参考：https://geosub.org/en/ai-pricing/chatgpt/plus 、https://opentherank.com/ai-pricing/chatgpt/

## 八、实施记录（2026-09-08）

阶段 0 与阶段 1 已落地，本地对全部来源跑通两轮完整采集；最终数据见 §8.4。

### 8.1 代码变更

| 位置 | 内容 |
|---|---|
| `packages/price-channels/src/storefront-catalog.ts` | 新增 Apple 174 个公开商店目录（商店码、币种、分组）、候选国家列表与中文地区名（`Intl.DisplayNames`，台湾、香港、澳门固定写法） |
| `packages/price-channels/src/storefront-parser.ts` | 新增 `parseAppStoreListings`（读取 `serialized-server-data` JSON，JSON 缺失时回退旧解析并标明）、`parseLocalizedAmount`（按币种解析千分位与小数）、`detectCurrencyFromDisplay`、`storefrontFromAppStoreUrl`、`resolveAppStoreListing`（规则 D：同名重复项金额等于同页另一套餐时不再视为歧义；规则 C′：同名多金额中恰有一个等于同国官网月价时选中该项） |
| `packages/price-channels/src/vendor-page-parsers.ts` | 新增 Google Play 区间解析、`gemini.google/{国家}/subscriptions/` 卡片解析（含 30 余种语言的“按月”标记、Ultra 5x / 20x 两档、缺金额卡片）、OpenAI 结算配置解析（`go / plus / prolite / pro` 映射，税费、灰度开关、促销、未知键） |
| `packages/price-channels/src/subscriptions.ts` | 全部来源改为“最终 URL 校验 + 404 记未上架 + 结构指纹”流程；新增 Google 官网各国采集、OpenAI 配置采集（浏览器注入）、Google Play 区间登记；Apple 扩到全部商店并按同国官网月价（Google 各国页、人工复核的美国官网价）确认周期（规则 C / C′）；来源节流、429 退避与重试计数；商店可用性登记；`scope: featured` 供受时间限制的端点 |
| `packages/browser-collector/src/index.ts` | 新增 `fetchDocumentsWithBrowser`：以桌面 UA 的 Chromium 顺序读取文档，遇挑战页等待后重读 |
| `packages/database` | 迁移 0017：`official_subscription_checks` 增加 `http_status / final_url / parsed_count / evidence`，新增 `official_storefronts` |
| `apps/worker` | 官方订阅改为独立的每日定时（`OFFICIAL_SUBSCRIPTION_REFRESH_INTERVAL_MS`），启动时按上次检查时间判断是否到期；完成后向浏览器队列投递 `official.openai_pricing_config`；运营请求新增 `official_subscription_refresh` 类型；CLI `refresh-subscriptions [featured]` 内含浏览器抓取 |
| `apps/browser-worker` | 处理 `official.openai_pricing_config`，用真实 Chromium 读取 OpenAI 各国结算配置并入库 |
| `apps/web/api/cron/official-subscriptions` | 改为登记一条运营请求交给 Worker 全量扫描；`OFFICIAL_PRICE_REFRESH_INLINE=true` 时另在 60 秒内跑重点地区 |
| `apps/web` 页面 | 地区对照与总览显示全部有记录的地区（中文名）、新状态（未上架、重定向、回落、币种不一致、区间）、税费口径、灰度提示、重复项说明；新鲜度放宽为 48 小时以匹配每日采集 |
| `deploy/database-roles.sql` | 浏览器角色获得官方订阅相关表的读写权限 |
| `.github/workflows` | 触发端点改为每日一次 |

### 8.2 运行方式

```bash
# 数据库迁移
npm run db:migrate
# 立即执行一次全量采集（含 OpenAI 浏览器抓取）；加 featured 只跑 12 个重点地区
npm run cli --workspace @price-radar/worker -- refresh-subscriptions
# 常驻：主 Worker 每日扫描 Apple / Google / Google Play，并把 OpenAI 配置任务交给浏览器 Worker
npm run dev:worker && npm run dev:browser-worker
```

浏览器 Worker 使用 `BROWSER_DATABASE_URL` 时，须先执行更新后的 `deploy/database-roles.sql` 赋权。

### 8.3 实测中修正的问题

- Apple 对每秒数次的连续请求返回 HTTP 429：首轮全量扫描 696 个页面有 478 个被限流。改为并发 2、请求间隔 600 ms、429 后共享冷却期并按 `Retry-After` 重试，第二轮未再出现 429。
- Google 套餐名带脚注（“Google AI Plus 1”），首轮全部判为结构变化；解析改为允许尾随脚注数字。
- Google 各国页按当地语言输出“按月”字样（如 `في الشهر`、`měsíčně`、`kuukaudessa`、`/hó`），未识别的语言会使价格降级为“周期待核验”而不是错入库；已按实测补齐 30 余种写法。
- OpenAI 配置在 68 个国家含 `tax_percent`，首轮被记为未知键；现作为税率证据保存。
- 帕劳（PW）的 Google 页面 Ultra 5x 金额显示为 `NaN`，按“币种或数值无法确认”跳过，不入库。
- Playwright 抓取 OpenAI 配置在本地 174 个国家码耗时约 1 分钟；`XX`、`CN`、`HK` 等返回 `Country config not found`，登记为未开放并 30 天后复扫。

### 8.4 最终一轮本地采集结果

采集时间 2026-09-08 00:36（北京时间），单机顺序执行，全程 10 分 13 秒，Apple 无一次 429 重试。

| 来源 | 结果 |
|---|---|
| Apple App Store | 174 个商店中 171 个可读，1,998 条标价；检查状态：verified 1,600、周期待核验 398、同名多价 84、列表未列出 246、未上架 108（ChatGPT 在 BY / CN / HK / MO / RU / VE 等不发售） |
| Google 官网各国页 | 139 国可读、35 国 404；540 条月价，4 国 15 个卡片无金额（如韩国 Pro），帕劳 Ultra 显示 NaN 被拒 |
| OpenAI 结算配置 | 168 国有配置、6 国无；672 条月价（Go / Plus / Pro 5x / Pro 20x），含税与灰度标记齐全 |
| Google Play | 12 个重点地区 44 条应用内购买区间，均只作区间证据 |
| 汇率 | ECB 28 种货币；其余币种的人民币估算留空 |

周期证据分布（本轮新核验的 3,214 条价格）：官网结算配置明示 672、内购名明示 656、OpenAI 官方文档 668、Google 官网页明示 540、同国官网月价一致 276、暂无周期证据 402。规则 D 解释了 340 条同名重复项（ChatGPT Plus 第二条 = Pro 20x），规则 C′ 把 Google AI Plus 的同名多价从 133 组降到 84 组。

样例（ChatGPT Plus 官网月价）：印度 INR 1,999 含 GST；德国 EUR 23 含 VAT；日本 JPY 3,000 含 JCT，本币灰度中；巴西 BRL 99.9 不含税，本币灰度中；土耳其按 USD 20 不含税。Google AI Pro 在日本、印度、德国的 App Store 内购金额与官网月价逐一相等（JPY 2,900 / INR 1,950 / EUR 21.99），据此确认为月付。

尚未覆盖：Anthropic 与 xAI 的各地区网页结算价（无公开来源）、Google Play 逐 SKU 价格、ECB 之外币种的汇率、Plus 年付（配置里只有每月折合值，未作为年付价入库）。
