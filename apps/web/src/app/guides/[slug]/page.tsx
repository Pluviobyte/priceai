import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideShell } from "../guide-shell";

const guides: Record<string, { title: string; intro: string; sections: Array<[string, string, string[]]> }> = {
  "why-ai-subscription-prices-differ": { title: "AI 订阅价格为什么差很多", intro: "把官网正价、官方地区价、资格价、代充价和第三方渠道价拆开看，才能判断差价来自哪里。", sections: [["price-types", "先区分价格类型", ["官网正价通常对应最直接的官方售后与账户规则。地区价受币种、税费、商店和账户区域影响；资格价还可能绑定学生、组织或活动条件。", "第三方渠道价则可能包含批量采购、账号交付、代充、卡密和不同售后条件，不能只按金额横向比较。"]], ["check", "比较时看什么", ["先确认产品、套餐和计费周期一致，再核验交付方式、有效期、库存、更新时间和售后入口。", "如果价格明显偏离官方标价，应该把限制条件和风险边界弄清楚后再做决定。"]]] },
  "ai-subscription-region-price-risks": { title: "官方地区价风险", intro: "低地区价不等于所有账户都能直接购买，账户地区、支付方式、税费和汇率都会影响最终结算。", sections: [["region", "账户与商店地区", ["App Store、Google Play 和官网可能使用不同的地区判断方式。切换地区也可能影响已有订阅、余额和家庭组。"]], ["payment", "支付与税费", ["银行卡发行地、账单地址、跨境手续费和当地税费都可能使结算价高于页面标价。"]]] },
  "how-to-subscribe-ai-officially": { title: "如何自己完成官方订阅", intro: "从官网、App Store、Google Play、支付方式和售后入口理解官方订阅路径。", sections: [["routes", "选择官方路径", ["优先从产品官网或官方应用内进入订阅页，确认套餐名称、周期和自动续费规则。"]], ["before", "付款前检查", ["核对账户地区、支付卡支持范围、税费、退款说明和订阅管理入口，并保留订单凭证。"]]] },
  "apple-id-ai-subscription": { title: "Apple ID 订阅 AI", intro: "通过 App Store 订阅时，需要同时关注 Apple ID 地区、余额、税费和退款入口。", sections: [["setup", "订阅前准备", ["确认应用来自官方开发者，Apple ID 地区与可用支付方式匹配，余额足够覆盖税费。"]], ["manage", "续费与管理", ["自动续费和取消都在 Apple 订阅管理中完成，实际退款由 Apple 渠道处理。"]]] },
  "google-play-ai-subscription": { title: "Google Play 订阅 AI", intro: "Google Play 价格由账号地区、支付资料和当地结算规则共同决定。", sections: [["setup", "账户与支付资料", ["确认 Google Play 国家/地区、支付资料和应用开发者信息，再核对显示币种。"]], ["manage", "订阅管理", ["在 Google Play 的付款与订阅页面管理续费、取消和订单记录。"]]] },
  "visa-card-for-ai-subscription": { title: "订阅 AI 需要什么支付卡", intro: "支持 Visa 或 Mastercard 并不代表所有发行地区、卡种和商户类别都能付款。", sections: [["card", "先确认卡片能力", ["核对跨境线上支付、3D Secure、账单地址、外币额度和 recurring payment 是否可用。"]], ["cost", "计算真实成本", ["除标价外，还应考虑汇率、税费、货币转换费和失败预授权。"]]] },
  "ai-subscription-gift-card": { title: "AI 订阅礼品卡限制", intro: "礼品卡通常绑定发行地区、兑换账户和可购买范围，不能把它当作通用支付卡。", sections: [["limits", "常见限制", ["礼品卡地区必须和商店账户匹配，余额可能无法跨区转移，也不一定覆盖全部订阅。"]], ["verify", "购买前核验", ["确认发行方、面值、适用商店、有效期、兑换规则和售后渠道。"]]] },
  "are-ai-subscription-card-shops-reliable": { title: "卡网渠道靠谱吗", intro: "把卡网理解成信息源和交易入口，而不是平台信用背书。", sections: [["evidence", "看清原始信息", ["核验原始店铺、商品标题、交付方式、库存、更新时间、联系方式和投诉入口。"]], ["risk", "控制交易风险", ["避免只看最低价；金额较大时先小额测试，并确认退款和售后边界。"]]] },
  "chatgpt-subscription-options": { title: "ChatGPT 获取方式", intro: "Plus、Pro、Team、成品号、代充和卡密对应完全不同的账户控制权和售后路径。", sections: [["official", "官方订阅", ["自己在 ChatGPT 官网或官方应用内订阅，账户控制权和订单路径最清晰。"]], ["third-party", "第三方交付", ["成品号、代充或共享账号可能涉及账户转移、地区、设备和售后限制，购买前必须逐项确认。"]]] },
  "api-transit": { title: "API 中转站怎么比较", intro: "综合倍率、稳定性、来源披露和模型真实性要一起判断。", sections: [["price", "理解倍率", ["充值系数决定一元能换多少站内额度，模型倍率决定调用特定模型扣多少额度，综合成本需要把两者合并。"]], ["stability", "看稳定性证据", ["公开状态页、站点自报和独立实测是不同证据；样本量、时间窗口和延迟口径必须同时看。"]]] },
  "self-host-api-transit": { title: "怎么自己搭一个自用 API 中转站", intro: "自建中转适合统一密钥、审计和故障切换，但也意味着你要负责安全、限流、账单与运维。", sections: [["architecture", "先确定边界", ["明确上游模型、调用方、鉴权、日志脱敏、预算和失败回退策略。"]], ["operations", "上线后的维护", ["持续监控错误率、延迟、余额和密钥泄漏风险，避免把管理接口直接暴露到公网。"]]] },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug];
  return { title: guide ? `${guide.title} | PriceAI` : "指南 | PriceAI" };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides[slug];
  if (!guide) notFound();
  const toc = guide.sections.map(([id, title]) => ({ id, label: title }));
  return <GuideShell toc={toc}><h1>{guide.title}</h1><p className="lead">{guide.intro}</p>{guide.sections.map(([id, title, paragraphs], index) => <section key={id}><h2 id={id}>{title}</h2>{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{index === 0 && <aside className="priceai-doc-callout info"><b>●　使用提示</b><p>PriceAI 只聚合公开信息。购买、付款或接入 API 前，请回到原始渠道核验最新规则。</p></aside>}</section>)}<p className="priceai-doc-back"><Link href="/guides">← 返回指南目录</Link>　<Link href="/">返回 PriceAI 主站</Link></p></GuideShell>;
}
