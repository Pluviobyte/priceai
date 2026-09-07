# 研究底稿：AI 价格雷达搜索需求（2026-09-04）

## 研究问题

围绕“AI 订阅、账号/充值、官方 API、API 中转与价格比较”产品，识别中国和欧美市场真正存在搜索需求的主词，并区分：

1. 可用于跨词比较的月均搜索量；
2. 百度指数这类加权指数；
3. 搜索联想与 Bing 广告 KPI 等方向性信号。

## 数据口径

| 来源 | 地区 | 口径 | 可否与月搜索量直接比较 |
|---|---|---|---|
| 百度指数 | 中国 | 关键词在百度网页搜索中的加权搜索指数；不是原始查询次数 | 否 |
| Google Ads Search Volume（经 AIsa DataForSEO） | 中国、美国、英国、德国、法国 | 定向地区与语言、默认近 12 个月的近似月均搜索量 | 同一来源、同一市场内可以 |
| Bing Search Volume（经 AIsa DataForSEO） | 美国、英国、德国、法国 | 定向地区的近似 Bing 月均搜索量，结果按十位数取整 | 同一来源、同一市场内可以 |
| Bing Keyword Performance | 中国 | 上月 Bing Ads 在不同广告位置的表现机会信号 | 否；不是自然搜索量 |
| 百度、Bing、Google 联想 | 中国及欧美 | 用户输入时由搜索引擎返回的候选词 | 否；仅证明词形与需求方向存在 |

## 百度证据

- `chatgpt`，全国、PC+移动、近 30 天（2026-08-05 至 2026-09-03）：整体日均指数 10,548，移动日均指数 6,415；整体同比 -12%、环比 -22%，移动同比 -8%、环比 -26%。
- 同一账号与筛选条件下，`chatgpt plus`、`chatgpt充值`、`chatgpt会员`、`chatgpt账号`、`chatgpt价格`、`openai`、`openai api`、`claude`、`gemini`、`ai订阅`、`ai比价`、`api中转站`、`大模型api`、`大模型api价格`、`midjourney` 未得到百度指数数值，界面显示“未被收录”或“没有数据”。这不能推导为零搜索。
- `chatgpt` 需求图谱（2026-08-24 至 2026-08-30）前十相关词：DEEPSEEK、GOOGLE、CODEX、GEMINI、CHAT GPT、GPT、CHATGPT下载、OPENAI、CHAT GPT官网、CHAT。前十未出现价格或购买词。

## 中国 Google Ads 月均量

| 关键词 | 近 12 个月月均 | 2026-07 单月 |
|---|---:|---:|
| chatgpt plus | 1,900 | 2,900 |
| chatgpt 充值 | 1,300 | 2,900 |
| chatgpt plus 购买 | 590 | 1,000 |
| chatgpt 会员 | 590 | 720 |
| api 中转站 | 590 | 1,300 |
| chatgpt 账号购买 | 320 | 590 |
| gemini 会员 | 260 | 210 |
| chatgpt plus 充值 | 210 | 260 |
| chatgpt plus 代充 | 170 | 210 |
| chatgpt 价格 | 170 | 390 |
| claude 会员 | 140 | 140 |
| openai api 充值 | 90 | 110 |
| ai 比价 | 70 | 320 |
| chatgpt plus 价格 | 70 | 140 |
| api 中转站推荐 | 50 | 90 |
| chatgpt plus 多少钱 | 40 | 70 |
| chatgpt 会员价格 | 40 | 70 |
| gemini 会员价格 | 40 | 10 |
| openai api 价格 | 40 | 70 |
| ai 订阅 | 30 | 70 |
| claude 会员价格 | 30 | 40 |
| 大模型 api 价格 | 20 | 20 |
| 大模型 api 中转站 | 20 | 20 |
| ai 订阅价格 | 10 | 30 |
| ai 订阅比价 | 10 | 50 |
| chatgpt 充值网站 | 10 | 20 |

## 中国 Bing 方向性信号

Bing 的直接 Search Volume 接口不支持中文语言参数。本次使用中文 Bing 联想，加上 2026-08 Keyword Performance 是否返回非空广告 KPI 作方向性验证，不把展示机会相加或伪装成自然月搜索量。

有非空 KPI 的词包括：`chatgpt plus`、`chatgpt plus购买`、`chatgpt plus多少钱`、`chatgpt plus价格`、`chatgpt充值`、`chatgpt会员`、`chatgpt账号购买`、`chatgpt价格`、`ai订阅`、`ai订阅价格`、`claude会员`、`claude会员价格`、`gemini会员`、`openai api价格`、`大模型api价格`、`大模型api中转站`、`api中转站`。

## 美国 Google / Bing 月均量

| 关键词 | Google | Bing |
|---|---:|---:|
| chatgpt plus subscription | 1,500,000* | 270 |
| chatgpt plus | 823,000 | 2,490 |
| gemini advanced | 49,500 | 400 |
| claude pro | 22,200 | 2,020 |
| chatgpt plus price | 18,100 | 80 |
| chatgpt price | 18,100 | 160 |
| claude pro price | 12,100 | 60 |
| openai api pricing | 12,100 | 340 |
| chatgpt subscription | 9,900 | 630 |
| chatgpt plus cost | 2,900 | 140 |
| midjourney pricing | 2,900 | 130 |
| perplexity pro price | 1,600 | 30 |
| claude pro cost | 1,000 | 60 |
| gemini advanced price | 880 | 10 |
| chatgpt plus vs claude pro | 480 | 30 |
| cheapest llm api | 260 | 10 |
| llm api pricing | 170 | 10 |
| llm api pricing comparison | 140 | 10 |
| ai api pricing | 90 | 0 |
| ai subscription price comparison | 50 | 10 |

\* Google 文档口径会把相近词聚类；`chatgpt plus subscription` 的 150 万与相邻品牌词明显可能共享/合并量，不能与 `chatgpt plus` 相加。

## 英国 Google / Bing 月均量

| 关键词 | Google | Bing |
|---|---:|---:|
| chatgpt plus | 8,100 | 420 |
| claude pro | 5,400 | 580 |
| chatgpt plus subscription | 4,400 | 40 |
| chatgpt subscription | 4,400 | 160 |
| chatgpt price | 4,400 | 50 |
| chatgpt plus price | 1,600 | 50 |
| claude pro price | 1,000 | 20 |
| midjourney pricing | 1,000 | 40 |
| openai api pricing | 880 | 60 |
| gemini advanced | 720 | 70 |
| chatgpt plus cost | 390 | 20 |
| perplexity pro price | 210 | 20 |

## 德国 Google / Bing 月均量

| 关键词 | Google | Bing |
|---|---:|---:|
| chatgpt plus kosten | 5,400 | 130 |
| chatgpt preis | 4,400 | 30 |
| chatgpt preise | 4,400 | 180 |
| chatgpt abonnement | 170 | 40 |
| claude pro preis | 170 | 10 |
| ki abo vergleich | 170 | 0 |
| openai api preise | 50 | 10 |
| gemini advanced preis | 10 | 0 |

## 法国 Google / Bing 月均量

| 关键词 | Google | Bing |
|---|---:|---:|
| abonnement chatgpt | 6,600 | 130 |
| prix chatgpt | 2,900 | 50 |
| prix chatgpt plus | 880 | 10 |
| abonnement chatgpt prix | 880 | 10 |
| abonnement chatgpt pas cher | 170 | 0 |
| prix claude pro | 110 | 10 |
| comparatif abonnement ia | 70 | 10 |
| prix chatgpt par mois | 70 | 0 |
| prix api openai | 40 | 0 |
| prix gemini advanced | 10 | 0 |

## 搜索联想证据摘要

- 中国百度：ChatGPT充值、ChatGPT充值网站、ChatGPT充值教程、ChatGPT充值渠道、ChatGPT会员、ChatGPT价格、ChatGPT多少钱、ChatGPT购买、ChatGPT共享、ChatGPT账号购买平台、AI订阅价格对比、AI订阅价格、AI订阅平台、Claude会员/价格/购买、Gemini会员/价格、大模型API聚合平台/API平台/API费用一览表/API中转站、API中转站推荐/网站/倍数/测试。
- 中国 Bing：chatgpt价格对比、chatgpt会员购买/充值/代充/价格/共享/账号/开通、chatgpt plus购买/代充/多少钱/充值/价格/账号共享、ai订阅价格/比价/对比/渠道比价、大模型api价格/聚合平台/中转站、openai api价格/充值/key购买、api中转站推荐/测评/检测/怎么选。
- 中国 Google：chatgpt充值服务/优惠/方式、chatgpt价格/价格对比/各地区价格/查询/监控、chatgpt会员购买/充值/价格/拼车/优惠、chatgpt plus购买/账号购买/订阅/低价、ai订阅比价/价格对比、api中转站/检测/服务、大模型api价格对比/中转站/价格。
- 英语市场：chatgpt plus/price/cost/subscription、claude pro price/cost/subscription、gemini advanced price、ai subscription price comparison、openai api pricing、llm api pricing/comparison、cheapest llm api、ai api pricing/comparison。
- 德语市场：chatgpt preise/preis、chatgpt plus kosten、chatgpt abonnement kosten、claude pro preis、gemini advanced preis、ki abo vergleich、openai api preise。
- 法语市场：prix chatgpt/prix chatgpt plus、abonnement chatgpt/prix/pas cher、prix claude pro、prix gemini advanced、comparatif abonnement ia、tarif/prix api openai、prix/comparatif prix api llm。

## AIsa 调用与费用记录

| 项目 | 次数 | 响应报告成本 |
|---|---:|---:|
| Scholar Web Search | 8 | $0.0192 |
| DataForSEO Search Volume / Keyword Performance | 10 | $0.9000 |
| gpt-5.4-mini 最小连通性测试 | 1 | 约 $0.000038 |
| Semrush 批量交叉验证 | 18 次尝试，均 HTTP 400 | $0（按文档，4xx/5xx 不计费） |
| 合计 |  | 约 $0.91924 |

批准上限为 $2.721。最终账务以 AIsa Usage Log 为准。

## 主要来源

- [AIsa Agent Quickstart](https://aisa.one/docs/agent-quickstart.md)
- [AIsa OpenAPI](https://aisa.one/openapi.yaml)
- [DataForSEO: Google Ads Search Volume Live](https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/)
- [DataForSEO: Bing Search Volume Live](https://docs.dataforseo.com/v3/keywords_data-bing-search_volume-live/)
- [Microsoft Advertising: Keyword Ideas and Traffic Estimates](https://learn.microsoft.com/en-us/advertising/guides/keyword-ideas-traffic-estimates?view=bingads-13)
- [Microsoft Advertising: KeywordIdea data object](https://learn.microsoft.com/en-us/advertising/ad-insight-service/ad-insight-data-objects?view=bingads-13)
- [百度指数帮助](https://index.baidu.com/Helper/)

