# AI 价格雷达：中欧美搜索主词与搜索量研究

研究日期：2026-09-04  
范围：中国（百度优先，并验证 Bing、Google）、美国、英国、德国、法国（Bing、Google）  
产品口径：AI 订阅、账号/充值、官方 API、API 中转与价格比较

## 结论先行

1. **中国真正有量的是“品牌/产品名 + 交易动作”，不是抽象品类词。** Google 中国近 12 个月月均量靠前的商业词是 `ChatGPT充值`（1,300）、`ChatGPT Plus购买`（590）、`ChatGPT会员`（590）、`API中转站`（590）、`ChatGPT账号购买`（320）。`AI订阅比价` 只有 10，`AI比价` 为 70。
2. **百度的大头是宽泛品牌词，交易词属于长尾。** `chatgpt` 的百度近 30 天整体日均指数为 10,548，但本次测试的 `chatgpt充值`、`chatgpt价格`、`api中转站` 等精确商业词没有公开指数数值；这些词却在百度联想里真实出现。因此，不能把“百度指数未收录”误写成“零搜索”。
3. **美国用户主要搜具体套餐和直接价格。** `chatgpt plus`、`claude pro`、`gemini advanced`、`chatgpt plus price`、`openai api pricing` 都有明显搜索量；`AI subscription price comparison`、`LLM API pricing comparison` 等抽象横向比较词小得多。
4. **欧洲必须本地化词形。** 英国延续英语品牌词；德国核心是 `ChatGPT Plus Kosten` / `ChatGPT Preis(e)`；法国核心是 `abonnement ChatGPT` / `prix ChatGPT`。直接照搬英文 `AI subscription comparison` 会错过当地主要需求。

## 指标怎么读

| 指标 | 本报告含义 | 注意事项 |
|---|---|---|
| 百度指数 | 百度网页搜索频次经过加权后的指数 | 不是每天实际查询次数 |
| Google 月均量 | 指定地区/语言、默认近 12 个月的近似月均搜索量 | Google 可能合并相近词，近似词不可简单相加 |
| Bing 月均量 | 指定地区的近似 Bing 月均搜索量 | 结果按十位数取整 |
| 中国 Bing 信号 | 中文联想 + 上月广告 Keyword Performance 是否存在 | 不是自然搜索量，只作方向验证 |

以上口径来自 [百度指数帮助](https://index.baidu.com/Helper/)、[DataForSEO Google Ads Search Volume 文档](https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/)、[DataForSEO Bing Search Volume 文档](https://docs.dataforseo.com/v3/keywords_data-bing-search_volume-live/) 与 [Microsoft Advertising 关键词流量说明](https://learn.microsoft.com/en-us/advertising/guides/keyword-ideas-traffic-estimates?view=bingads-13)。

## 中国：百度优先，Bing 与 Google 验证

### 百度头部需求

| 关键词 | 百度窗口 | 整体日均指数 | 移动日均指数 | 结论 |
|---|---|---:|---:|---|
| chatgpt | 2026-08-05 至 2026-09-03，全国、PC+移动 | 10,548 | 6,415 | 明确的品牌级头部流量；整体同比 -12%、环比 -22% |

同一条件下，`chatgpt plus`、`chatgpt充值`、`chatgpt会员`、`chatgpt账号`、`chatgpt价格`、`openai api`、`claude`、`gemini`、`ai订阅`、`ai比价`、`api中转站`、`大模型api价格` 等没有得到公开指数数值。百度需求图谱中，`chatgpt` 最近一周的前十相关词为 DEEPSEEK、GOOGLE、CODEX、GEMINI、CHAT GPT、GPT、CHATGPT下载、OPENAI、CHAT GPT官网、CHAT；价格/购买词未进前十。

### 中国商业意图词表

下表按 Google 中国近 12 个月月均量排序。Google 不是中国全网规模的替代指标；它在这里用于给长尾词定量，并与百度、Bing 联想交叉验证。

| 主词 | 搜索意图 | Google 月均 | 2026-07 | 百度证据 | Bing 中国证据 | 研究优先级 |
|---|---|---:|---:|---|---|---|
| ChatGPT Plus | 套餐/品牌 | 1,900 | 2,900 | 精确词无指数；相关品牌需求强 | 联想有；广告 KPI 有 | P0，但需搭配价格/购买意图 |
| ChatGPT充值 | 充值交易 | 1,300 | 2,900 | 联想有；精确词无指数 | 联想有；广告 KPI 有 | P0 |
| ChatGPT Plus购买 | 购买交易 | 590 | 1,000 | 购买类联想有 | 联想有；广告 KPI 有 | P0 |
| ChatGPT会员 | 订阅交易 | 590 | 720 | 联想有；精确词无指数 | 联想有；广告 KPI 有 | P0 |
| API中转站 | API 渠道 | 590 | 1,300 | 联想有；精确词无指数 | 联想有；广告 KPI 有 | P0 |
| ChatGPT账号购买 | 账号交易 | 320 | 590 | 联想有 | 联想有；广告 KPI 有 | P0 |
| Gemini会员 | 订阅交易 | 260 | 210 | 联想有 | 联想有；广告 KPI 有 | P1 |
| ChatGPT Plus充值 | 充值交易 | 210 | 260 | 充值类联想有 | 联想有；广告 KPI 无 | P1 |
| ChatGPT Plus代充 | 代充交易 | 170 | 210 | 精确词无指数 | 联想有；广告 KPI 无 | P1 |
| ChatGPT价格 | 价格查询 | 170 | 390 | 联想有；精确词无指数 | 联想有；广告 KPI 有 | P0 |
| Claude会员 | 订阅交易 | 140 | 140 | 联想有 | 联想有；广告 KPI 有 | P1 |
| OpenAI API充值 | API 充值 | 90 | 110 | API 类联想有 | 联想有；广告 KPI 无 | P1 |
| AI比价 | 横向比较 | 70 | 320 | 精确词无指数 | 联想有；广告 KPI 无 | P1，近期增幅值得观察 |
| ChatGPT Plus价格 | 价格查询 | 70 | 140 | 价格类联想有 | 联想有；广告 KPI 有 | P1 |
| API中转站推荐 | 渠道选择 | 50 | 90 | 联想有 | 联想有；广告 KPI 无 | P1 |
| OpenAI API价格 | API 价格 | 40 | 70 | API 类联想有 | 联想有；广告 KPI 有 | P1 |
| AI订阅 | 品类 | 30 | 70 | 联想有；精确词无指数 | 联想有；广告 KPI 有 | P2 |
| 大模型API价格 | API 价格 | 20 | 20 | 联想有；精确词无指数 | 联想有；广告 KPI 有 | P1，量小但意图高度匹配 |
| AI订阅比价 | 横向比较 | 10 | 50 | 联想有；精确词无指数 | 联想有；广告 KPI 无 | P2；不宜作为唯一主入口词 |

**中国主词判断：** 核心不是单独争夺 `AI比价`，而是覆盖 `ChatGPT充值/购买/会员/价格` 与 `API中转站/API价格` 两组交易型词，再用“比价”产品能力承接这些用户。

## 美国：Google 与 Bing

| 主词 | Google 月均 | Bing 月均 | 意图判断 |
|---|---:|---:|---|
| chatgpt plus | 823,000 | 2,490 | 最强套餐头词 |
| chatgpt plus subscription | 1,500,000* | 270 | 套餐订阅；Google 可能合并近似词 |
| gemini advanced | 49,500 | 400 | 具体套餐 |
| claude pro | 22,200 | 2,020 | 具体套餐；Bing 尤其强 |
| chatgpt plus price | 18,100 | 80 | 直接价格意图 |
| chatgpt price | 18,100 | 160 | 直接价格意图 |
| claude pro price | 12,100 | 60 | 直接价格意图 |
| openai api pricing | 12,100 | 340 | API 价格主词 |
| chatgpt subscription | 9,900 | 630 | 订阅意图 |
| chatgpt plus cost | 2,900 | 140 | 直接成本意图 |
| midjourney pricing | 2,900 | 130 | 具体产品价格 |
| perplexity pro price | 1,600 | 30 | 具体套餐价格 |
| cheapest llm api | 260 | 10 | API 低价比较 |
| llm api pricing | 170 | 10 | API 品类价格 |
| llm api pricing comparison | 140 | 10 | 横向比较，量小但高度相关 |
| ai subscription price comparison | 50 | 10 | 抽象品类词，量很小 |

\* `chatgpt plus subscription` 的 Google 数值异常高。Google 会把相近关键词聚类，因此它不能与 `chatgpt plus` 相加，也不应单独据此判断真实独立查询规模。

## 英国

| 主词 | Google 月均 | Bing 月均 |
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

英国与美国的结构相同：具体品牌/套餐词远大于通用品类比较词。

## 德国

| 主词 | Google 月均 | Bing 月均 | 中文含义 |
|---|---:|---:|---|
| chatgpt plus kosten | 5,400 | 130 | ChatGPT Plus 费用 |
| chatgpt preis | 4,400 | 30 | ChatGPT 价格 |
| chatgpt preise | 4,400 | 180 | ChatGPT 各价格 |
| chatgpt abonnement | 170 | 40 | ChatGPT 订阅 |
| claude pro preis | 170 | 10 | Claude Pro 价格 |
| ki abo vergleich | 170 | 0 | AI 订阅比较 |
| openai api preise | 50 | 10 | OpenAI API 价格 |

德国的主词应使用本地表达 `Kosten`、`Preis/Preise`、`Abo/Abonnement`；抽象的 `KI Abo Vergleich` 有需求，但量远小于 ChatGPT 价格词。

## 法国

| 主词 | Google 月均 | Bing 月均 | 中文含义 |
|---|---:|---:|---|
| abonnement chatgpt | 6,600 | 130 | ChatGPT 订阅 |
| prix chatgpt | 2,900 | 50 | ChatGPT 价格 |
| prix chatgpt plus | 880 | 10 | ChatGPT Plus 价格 |
| abonnement chatgpt prix | 880 | 10 | ChatGPT 订阅价格 |
| abonnement chatgpt pas cher | 170 | 0 | 便宜的 ChatGPT 订阅 |
| prix claude pro | 110 | 10 | Claude Pro 价格 |
| comparatif abonnement ia | 70 | 10 | AI 订阅比较 |
| prix api openai | 40 | 0 | OpenAI API 价格 |

法国用户最常用的是 `abonnement` 和 `prix`；`comparatif abonnement IA` 符合产品，但搜索规模明显更小。

## 跨市场主词清单

| 市场 | 第一层主词（有明确量） | 第二层高意图词 | 不宜单独押注的抽象词 |
|---|---|---|---|
| 中国 | ChatGPT充值、ChatGPT Plus、ChatGPT会员、API中转站、ChatGPT账号购买 | ChatGPT价格、Plus购买/充值/代充、OpenAI API充值/价格、大模型API价格、Claude会员、Gemini会员 | AI订阅比价、AI比价 |
| 美国 | chatgpt plus、claude pro、gemini advanced、chatgpt price、openai api pricing | plus price/cost/subscription、claude pro price、midjourney pricing、perplexity pro price | ai subscription price comparison、ai api pricing comparison |
| 英国 | chatgpt plus、claude pro、chatgpt price/subscription | plus price、openai api pricing、midjourney pricing | generic AI subscription comparison |
| 德国 | chatgpt plus kosten、chatgpt preis/preise | chatgpt abonnement、claude pro preis、openai api preise | ki abo vergleich（可做聚合页，但不应作唯一入口） |
| 法国 | abonnement chatgpt、prix chatgpt | prix chatgpt plus、abonnement chatgpt prix、prix claude pro | comparatif abonnement ia（可做聚合页，但不应作唯一入口） |

## 证据边界与限制

- 百度指数是加权指数，不是查询次数；“未收录/没有数据”不等于零搜索。
- Google 中国数据只代表其“中国地区”定向口径，不能代表百度或中国全网总量。
- AIsa 的 Bing Search Volume 接口当前不支持中文语言参数，所以中国 Bing 只使用联想与广告 KPI 做方向验证，没有伪造月搜索量。
- “欧美”本次量化覆盖美国、英国、德国、法国，代表主要英语、德语、法语市场，不等于欧洲所有国家。
- Google 可能把相近词合并。尤其是美国 `chatgpt plus subscription` 的 150 万，不能与其他 ChatGPT 近似词相加。
- 本次尝试用 AIsa 的 Semrush 端点做第二商业数据源交叉验证，但请求均返回 HTTP 400 合约不匹配；按 AIsa 文档 4xx/5xx 不收费，因此未继续重复失败调用。最终量化以成功返回的 DataForSEO 数据为准。

## AIsa 已安全连接与配置

- API Key 已存入 **macOS Keychain**，未写入项目、报告或 shell 历史。
- 安全调用入口：`/Users/rain/.local/bin/aisa-with-key`。该包装器只在子进程生命周期内注入 `AISA_API_KEY`。
- `GET https://api.aisa.one/v1/models` 已通过，返回 HTTP 200，共 109 个模型。
- `gpt-5.4-mini` 最小聊天测试成功，返回 `AISA_OK`。
- AIsa Web Search Skill 已可用：`/Users/rain/.agents/skills/web-search/scripts/search_client.py`。

安全调用示例（不会在命令中写出密钥）：

```bash
/Users/rain/.local/bin/aisa-with-key sh -c \
  'curl -sS https://api.aisa.one/v1/models \
    -H "Authorization: Bearer $AISA_API_KEY"'
```

LLM 接口使用 OpenAI 兼容的 `https://api.aisa.one/v1/chat/completions`；数据与搜索接口使用 `https://api.aisa.one/apis/v1`。配置依据为 [AIsa Agent Quickstart](https://aisa.one/docs/agent-quickstart.md) 与 [AIsa OpenAPI](https://aisa.one/openapi.yaml)。

## 本次 AIsa 费用

| 调用 | 响应报告费用 |
|---|---:|
| 8 次 Scholar Web Search | $0.0192 |
| 10 次 DataForSEO 量化调用 | $0.9000 |
| 1 次 gpt-5.4-mini 最小测试 | 约 $0.000038 |
| **合计** | **约 $0.91924** |

已低于批准上限 **$2.721**。最终扣费以 AIsa Usage Log 为准。

## 来源

- [AIsa Agent Quickstart](https://aisa.one/docs/agent-quickstart.md)
- [AIsa OpenAPI](https://aisa.one/openapi.yaml)
- [DataForSEO: Google Ads Search Volume Live](https://docs.dataforseo.com/v3/keywords_data-google_ads-search_volume-live/)
- [DataForSEO: Bing Search Volume Live](https://docs.dataforseo.com/v3/keywords_data-bing-search_volume-live/)
- [Microsoft Advertising: Keyword Ideas and Traffic Estimates](https://learn.microsoft.com/en-us/advertising/guides/keyword-ideas-traffic-estimates?view=bingads-13)
- [Microsoft Advertising: KeywordIdea data object](https://learn.microsoft.com/en-us/advertising/ad-insight-service/ad-insight-data-objects?view=bingads-13)
- [百度指数帮助](https://index.baidu.com/Helper/)

