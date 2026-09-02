# 官方订阅与 API 定价一手来源核验

> 核验日期：2026-09-03（Asia/Shanghai）  
> 用途：为“官方订阅”、“官方 API”和“API 中转”三个频道提供可回溯的初始基线。

## 结论

1. 价格不能从搜索摘要直接入库。搜索摘要可能保留旧版文案，正式数据只采用厂商官网、帮助中心、开发者文档或应用商店公开页。
2. 订阅价格必须带上“套餐、周期、渠道、国家/地区、币种、证据时间”。只有精确 SKU 才能排名，应用商店公开的区间价不能当成某个套餐的价格。
3. API 价格必须分开输入、缓存输入、输出、批处理和多模态单位，不能压缩成一个“每 token 价格”。
4. 中转站的模型目录和价格是运营方自报；公开端点成功也不等于付费推理成功。因此数据模型分为 `provider_self_reported`、`public_monitor` 和 `platform_probe`。

## 官方订阅价

### OpenAI

- [ChatGPT Plus 帮助中心](https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus)：美国官网 $20/月，不支持年付。
- [ChatGPT Pro 档位说明](https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro)：Pro $100 是 Plus 的 5 倍用量，Pro $200 是 20 倍用量。这是对“Pro 只有 $200”旧数据的更新。
- [ChatGPT 美国 App Store](https://apps.apple.com/us/app/chatgpt/id6448311069)：公开列出 ChatGPT Plus $19.99、Pro 5x $100、Pro 20x $200 等精确内购项。App ID 为 `6448311069`。
- [ChatGPT Google Play](https://play.google.com/store/apps/details?id=com.openai.chatgpt&hl=en_US&gl=US)：公开页确认存在应用内购，但页面未公开可稳定归属到单一套餐的精确 SKU 价，因此记为 `unknown`，不参与排名。

### Anthropic

- [Claude 套餐选择指南](https://support.anthropic.com/en/articles/11049762-choosing-a-claude-ai-plan)：Pro $20/月、Max 5x $100/月、Max 20x $200/月。
- [Claude Pro 价格说明](https://support.anthropic.com/en/articles/8325610-how-much-does-claude-pro-cost)：美国月付 $20，年付有折扣，地区价和税费可能不同。
- [Claude 美国 App Store](https://apps.apple.com/us/app/claude-by-anthropic/id6473753684)：公开列出 Pro 月付 $20、Pro 年付 $214.99、Max 5x $124.99、Max 20x $249.99。App ID 为 `6473753684`。

### SpaceXAI

- [Grok 官方定价](https://x.ai/pricing)：SuperGrok $30/月，SuperGrok Plus $100/月。
- [Grok 产品与用量说明](https://docs.x.ai/grok/overview)：付费档位共享每周用量池，并在 Web、iOS 和 Android 间同步。

### Google

- [Google One AI 套餐官网](https://one.google.com/intl/en_us/about/google-ai-plans/)在公开 HTML 里会因地区、Cookie 和客户端渲染而省略金额。本次不把搜索引擎保留的旧价格写入当前精确价；后续需通过稳定的地区化公开 SKU 证据采集。

## 官方 API 价

- [OpenAI 模型对比](https://developers.openai.com/api/docs/models/compare)：GPT-5.6 Sol 为 $4/$0.40/$20，Terra 为 $2/$0.20/$12，Luna 为 $0.20/$0.02/$1.20（输入/缓存输入/输出，每百万 tokens）。
- [GPT-5.6 Sol 模型页](https://developers.openai.com/api/docs/models/gpt-5.6-sol)：补充上下文、长上下文计价修饰和分层限速数据。
- [Claude API 定价](https://platform.claude.com/docs/en/about-claude/pricing)：分开基础输入、5 分钟/1 小时缓存写入、缓存命中、输出和批处理。本次基线收录 Opus 4.8、Sonnet 5（2026-09-01 起的价格）和 Haiku 4.5。
- [Gemini Developer API 定价](https://ai.google.dev/gemini-api/docs/pricing)：本次基线收录 Gemini 3.5 Flash 的 standard/batch 和 Live Translate 音频单位，并保留免费层和 grounding 附加费。
- [Grok 4.6 模型页](https://docs.x.ai/developers/models/grok-4.6)：$2 输入、$0.50 缓存输入、$6 输出，每百万 tokens。
- [SpaceXAI 模型与定价目录](https://docs.x.ai/developers/models)：补充 Imagine 图像、视频和 Voice API 的非 token 计费单位。

## 汇率

- 汇率使用 [European Central Bank Data API](https://data-api.ecb.europa.eu/service/data/EXR/D.CNY+USD.EUR.SP00.A?format=csvdata) 每日参考汇率。
- ECB 数据以 EUR 为基准；系统保留 EUR/CNY 原始比率，USD/CNY 由同日 EUR/CNY 与 EUR/USD 交叉计算。
- 人民币金额仅是估算。排名和证据展示始终保留原币价和汇率日期。

## API 中转样本

- [OpenRouter 公开模型目录](https://openrouter.ai/api/v1/models) 返回模型与站点自报的 prompt/completion 价格。
- [Vercel AI Gateway 模型文档](https://vercel.com/docs/ai-gateway/models-and-providers) 与其公开 `/v1/models` 端点用于目录和价格观测。
- 上述端点只能证明公开目录在检查时可读。付费推理质量需独立的用户自带 Key 一次性检测；平台不持久化 Key。

## 入库规则

- 同一证据哈希重复采集只更新核验时间，不追加假的“变价”历史。
- 价格、币种、范围、套餐名或证据发生变化时，追加不可变历史。
- 某个官方页或公开端点临时失败时，保留上一份已核验快照，不会清空当前价格。
