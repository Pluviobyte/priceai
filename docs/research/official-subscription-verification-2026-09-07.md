# 官方订阅价格复核：金额、周期与比较口径

复核日期：2026-09-07（北京时间）。本文件记录针对用户截图的二次复核，范围包括 ChatGPT、Claude、Google AI / Gemini、Grok 及人民币汇率。结论基于厂商官网、官方帮助和 Apple 地区商店页面；没有使用第三方报价作为官方价格。

## 结论

截图中的 Claude 原币价格有官方依据，不能把整张截图的金额都判定为错误。当前更明确的问题是：采集系统把公开内购列表中的金额映射成标准月付价格，并在地区与渠道之间挑最低人民币值，但部分来源没有证明付款周期、促销资格或税费口径。

应当分别表达以下事实：

- 来源确实显示了某个原币金额。
- 该金额的套餐、付款周期和适用渠道是否有证据。
- 记录是否仍在核验时效内，最近采集是否发现歧义或无法确认。
- 人民币数字只是对应汇率日期的估算，不能等同于结账金额。

没有取得周期证据时，应保留原始公开金额与来源，标为“周期待核验”，不能推荐为标准月价或最低价。不同渠道的税费与账号购买资格也不能用一个人民币排序掩盖。

## ChatGPT：四个截图金额均有官方出处

| 截图项目 | 原币标价 | 证据 |
|---|---:|---|
| Go 印度 iOS | INR 399 | [印度 App Store](https://apps.apple.com/in/app/chatgpt/id6448311069) |
| Plus 美国官网 | USD 20/月 | [Plus 帮助](https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus) |
| Pro 20x 菲律宾 iOS | PHP 9,990 | [菲律宾 App Store](https://apps.apple.com/ph/app/chatgpt/id6448311069) |
| Pro 5x 美国 iOS | USD 100 | [美国 App Store](https://apps.apple.com/us/app/chatgpt/id6448311069) |

[Pro 帮助](https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro)确实区分 USD 100 的 5x 和 USD 200 的 20x，不是把 Claude 名称误配给 OpenAI。[Go 帮助](https://help.openai.com/en/articles/11989085-what-is-chatgpt-go)与 Pro 帮助的年付 FAQ 明确 Go、Plus、Pro 不支持年付或预付多个月，[Pro 产品页](https://chatgpt.com/plans/pro/)显示 /month。这里将周期证据与 Apple 金额来源分别保存，注明“官方套餐文档交叉确认周期”，没有把它当成具体账户的结算或优惠资格核验。

Plus 同名多金额仍标歧义，不根据“没有年付”任意挑便宜项。Go 的印度一年免费促销新增兑换已于2026-01-21结束，不能以旧促销推翻当前公开399卢比标价，见[官方发布记录](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)。

### 已复现的解析错误

旧通用解析器用套餐附近500字符找美元金额，可把同一段里的 Pro USD100误分给20x。新增回归分别覆盖档位绑定、明确月付、相邻套餐、币种、年付及冲突金额。当前 Pro 帮助只有金额与档位对应，没有直接月费表达，自动解析保守返回空，独立保留本次人工复核的官网参考标价。

## 汇率逐项复算

[ECB官方daily XML](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)本次最新日期是2026-09-04：EUR/CNY=7.7994、EUR/USD=1.1622、EUR/INR=109.8165、EUR/PHP=72.812。交叉计算采用CNY/EUR除以外币/EUR。

USD20=134.22人民币、USD100=671.09人民币、INR399=28.34人民币、PHP9990=1070.10人民币，均与截图一致。12种最新数据库汇率与ECB相符，160条记录没有算术不一致、未来或非正汇率。9月7日北京时间核验时当日ECB参考汇率尚未发布，使用上个工作日正常。

另修复防故障缺陷：拒绝未来、非正数、非有限值和超过7天的汇率；外币与CNY必须同日配对。人民币参考显示日期，过期换算不参与标价较低提示。台湾12条报价仍缺TWD换算，因ECB不覆盖TWD；保留“汇率待补”，不伪称所有地区人民币已齐全。

## Claude：截图数值有依据，官网与 iOS 本来存在价差

官方套餐指南当前明确列出以下个人方案：Pro 月付 USD 20、年付 USD 200；Max 5x 月付 USD 100；Max 20x 月付 USD 200。截图中的 Max 5x 与 Max 20x 美国官网原币值与之相符。

来源：[Choose a Claude plan](https://support.claude.com/en/articles/11049762-choose-a-claude-plan)。

日本 Apple 页面明确在内购名称中区分 Monthly / Annual，当前列出：

| iOS 内购项 | 日本标价 | 周期证据 |
|---|---:|---|
| Claude Pro - Monthly | JPY 3,000 | 名称明确月付 |
| Claude Pro - Annual | JPY 35,000 | 名称明确年付 |
| Claude Max 5x - Monthly | JPY 20,000 | 名称明确月付 |
| Claude Max 20x - Monthly | JPY 40,000 | 名称明确月付 |

截图中的 Claude Pro 日本报价对应 JPY 3,000；本次确认的是原币标价，不因此宣称截图的人民币汇率或最终结算费用也已独立核验。

来源：[Claude 日本 App Store](https://apps.apple.com/jp/app/claude-by-anthropic/id6473753684)。

美国 Apple 页面当前列出 Pro Monthly USD 20、Pro Annual USD 214.99、Max 5x Monthly USD 124.99、Max 20x Monthly USD 249.99。因此，不能把官网 USD 100 / 200 复制到 iOS，也不能将官网年费 USD 200 当作 iOS 年费。

来源：[Claude 美国 App Store](https://apps.apple.com/us/app/claude-by-anthropic/id6473753684)。

Claude 官方说明各地区可能使用本地币种，展示价有的含税、有的到结账时加税，并建议通过官网升级页或当地应用商店确认当前价格。跨渠道比较必须保留渠道身份，人民币估算不应被描述成统一到手价。

来源：[What is the Pro plan?](https://support.claude.com/en/articles/8325606-what-is-the-pro-plan)。

## Google AI：单一内购金额仍不足以证明月付

美国 Gemini Apple 页面本次显示 Google AI Plus (400 GB) USD 4.99、Google AI Pro (5 TB) USD 19.99、Google AI Ultra (30 TB) USD 199.99。多个同名同价条目重复出现，但这些内购名称没有写明付款周期。出现次数或金额唯一性不能补足周期证据。

来源：[Google Gemini 美国 App Store](https://apps.apple.com/us/app/google-gemini/id6477489729)。

Google 官方 iOS 帮助明确 Plus 与 Pro 均可选择月付或年付；另一官方帮助页明确印度的 AI Plus 400 GB / 2 TB、AI Pro 5 TB 还支持季付。由此可以确认，“catalog 声明 month”并不证明某条 Apple 内购金额就是月付。

来源：[Plus iOS 会员帮助](https://support.google.com/googleone/answer/16548195?co=GENIE.Platform%3DiOS&hl=en)、[Pro iOS 会员帮助](https://support.google.com/googleone/answer/16476811?co=GENIE.Platform%3DiOS&hl=en)、[Google One 周期变更与印度季付说明](https://support.google.com/googleone/answer/9003633)。

Google 2026-08-19 学生优惠公告的条款提到美国 Pro 优惠结束后 USD 19.99/月、适用地区 Plus 优惠结束后 USD 4.99/月或本地等值金额。这是有资格条件的活动和续费说明，可作为辅助证据；不能直接把它写成所有地区、所有渠道当前的标准结算价，也不能把免费学生试用混进常规价格排名。

来源：[Google 官方学生优惠公告](https://blog.google/innovation-and-ai/products/gemini-app/student-offer-google-ai/)。

### 规格覆盖需要继续明确

当前 Google 官网对照表区分 Ultra 5x（20 TB）与 Ultra 20x（30 TB），站内旧目录只收录 Ultra 30 TB。官方帮助同时列出 Plus 的 400 GB / 2 TB、Pro 的 5 TB / 10 TB。容量与用量档位应成为套餐身份，不能拿其他容量内购补当前行，也不能把当前目录描述成厂商所有档位。

来源：[Google AI 套餐表](https://one.google.com/intl/en_us/about/google-ai-plans/)、[Plus 规格帮助](https://support.google.com/googleone/answer/16548195)、[Pro 规格帮助](https://support.google.com/googleone/answer/16476811?hl=en-GP)。

## Grok：同名内购项同时存在多个金额

官网当前明确 SuperGrok USD 30/月、SuperGrok Plus USD 100/月。美国 Apple 页面同时列出同名 SuperGrok USD 30 与 USD 300；该列表没有注明周期，不能仅凭十倍关系将 USD 300 自动视为年费。Plus 的 USD 100 内购项名称也没有写月付，恰好等于官网月价不足以证明它的渠道周期。

来源：[Grok 官网定价](https://x.ai/pricing)、[Grok 美国 App Store](https://apps.apple.com/us/app/grok-ai/id6670324846)。

官网比较表还出现 Lite / Heavy，Apple 当前也列出这些名称。它们属于目录覆盖问题，应独立验证套餐和周期后再收录。Grok 官方 FAQ 也明确不同购买平台各有订阅管理流程，不能把 Web、iOS、Android 的价格直接互换。

来源：[Grok 官方 FAQ](https://docs.x.ai/grok/faq)。

## 附：印尼金额格式的可复现解析缺陷

复核时，旧 `parseAppStorePriceListings` 对 `Rp 14.500` 输出 `14.5`，正确数量级是 `14,500`。Apple 印尼页面真实使用该格式，例如 Gemini 的 30 GB 内购项；本次目标 AI 套餐大多使用 `ribu` / `juta` 缩写，因此尚不能认定这个缺陷已经导致用户截图中的错误。

来源：[Google Gemini 印尼 App Store](https://apps.apple.com/id/app/google-gemini/id6477489729)。

## 页面修正口径

套餐详情与地区对照应按渠道、地区展示中性参考，移除跨渠道的“当地最低”“全表较低”及最低人民币排序。每条记录保留原币、带 `≈` 的人民币估算、证据状态、价格日期、汇率日期和原始来源。周期未证实、同名歧义、已过期应明确呈现；缺失报价附来源检查原因，不能推断该地区不可购买。

本文件记录核验依据和修正要求；不单凭文档声明数据库已修复、生产已发布或所有地区价格已补齐。

## 本次执行与数据结果

本地重新采集四个App的12地区，并检查13个目录套餐×12地区×3渠道共468组合。160条存储记录中159条有原币金额：93项周期明确且近期核验，66项历史/歧义/周期待核验，309组合尚无精确价。原来125项“当前价”中32项缺少周期证据，已从可对照状态降级，原币与来源继续保留。Google/Grok缺周期记录不会因后续定时任务重新升级。

总览按稳定参考选择（优先美国官网，次选来源与周期明确的公开记录），不再挑跨地区最低金额。详情与地区表去除跨渠道“当地最低”，对照矩阵只提示同套餐同渠道的公开标价折算较低，并说明税费尚未统一。所有接口同时返回周期是否有证据、证据状态和是否可用于比较。
