export interface DocSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface DocArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: "购买决策" | "订阅指南" | "API 实务" | "风险核验" | "数据方法";
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  imageUrl: string;
  imageAlt: string;
  sections: DocSection[];
}

const anthropicImage = (asset: string) => `https://cdn.sanity.io/images/4zrzovbb/website/${asset}`;

export const docsArticles: DocArticle[] = [
  {
    slug: "ai-subscription-price-comparison-guide",
    title: "AI 订阅比价指南：官方价、地区价与渠道价怎么比",
    excerpt: "先统一套餐、周期和账号归属，再判断差价来自汇率、地区、支付方式还是第三方交付。",
    category: "购买决策",
    publishedAt: "2026-09-04",
    updatedAt: "2026-09-04",
    readingMinutes: 6,
    imageUrl: anthropicImage("54b7ab1d2c2521f83ae5d2da5f9d99321c370d24-2880x1620.png"),
    imageAlt: "Anthropic 官网的抽象蓝色模型视觉，用作 AI 订阅比价文章临时封面",
    sections: [
      { id: "same-product", title: "先确认比较的是同一种商品", paragraphs: ["同一个模型名称，可能同时对应个人月付、团队席位、成品账号、代充和共享使用。它们的账号控制权、功能范围与售后责任不同，不能只按一个月多少钱排序。", "比较前先记录产品名称、计费周期、账号最终归属、可用客户端和质保范围。只有这些条件一致，价格差才有意义。"] },
      { id: "price-layers", title: "看懂四层价格", paragraphs: ["官网正价是基准，地区价会叠加币种、税费和支付限制。渠道价还可能包含批量采购、优惠资格、代付成本或账号交付成本。", "PriceAI 会把官方价和渠道可买价分开展示。看到明显低价时，继续核对库存与更新时间，不把过期报价当成当前行情。"], bullets: ["官网标价与最终含税价是否一致", "地区、账单地址和银行卡发行地是否匹配", "渠道商品是否改变账号归属或登录方式", "售后期限是否覆盖整个订阅周期"] },
      { id: "decision", title: "最后再决定是否值得买", paragraphs: ["如果重视长期稳定和完整账户控制权，官方路径通常更合适。如果只是短期体验，可以接受限制，再比较第三方现货。", "最低价只是入口。真正要比较的是总成本、交付风险和出现问题后的处理路径。"] },
    ],
  },
  {
    slug: "chatgpt-plus-purchase-options",
    title: "ChatGPT Plus 有哪些购买方式，各自适合谁",
    excerpt: "官网直付、应用商店、代充与成品号的差别，不只体现在价格。",
    category: "订阅指南",
    publishedAt: "2026-09-03",
    updatedAt: "2026-09-04",
    readingMinutes: 5,
    imageUrl: anthropicImage("2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg"),
    imageAlt: "Anthropic 官网的暖色抽象模型视觉，用作 ChatGPT Plus 购买方式文章临时封面",
    sections: [
      { id: "official", title: "官方路径最容易追溯", paragraphs: ["官网和官方应用商店的订单关系最清楚，续费、取消与退款都能回到原支付渠道处理。成本可能更高，但账号控制权通常最完整。", "使用应用商店时，还要核对 Apple ID 或 Google Play 的地区、余额、税费和自动续费设置。"] },
      { id: "third-party", title: "第三方交付先看账号归谁", paragraphs: ["代充通常是在你的账号上完成付款，成品号则由卖家创建后交付。共享或镜像类商品只提供使用入口，账号和数据控制权不在你手里。"], bullets: ["是否需要提供账号或登录会话", "能否修改邮箱、密码和安全设置", "异常后由谁处理退款与补发", "商品描述是否明确模型、额度和期限"] },
      { id: "recommendation", title: "按使用周期做选择", paragraphs: ["长期使用、保存重要对话或接入工作流程时，优先选择自己控制的官方账号。短期测试第三方渠道时，先小额试单并保存商品描述与订单凭证。"] },
    ],
  },
  {
    slug: "claude-pro-subscription-cost-checklist",
    title: "Claude Pro 订阅前，需要核对哪些真实成本",
    excerpt: "除了页面标价，还要考虑税费、汇率、支付失败和账户地区限制。",
    category: "订阅指南",
    publishedAt: "2026-09-02",
    updatedAt: "2026-09-04",
    readingMinutes: 5,
    imageUrl: anthropicImage("0c547c61b24e6ad4985c64f04f212c7411609bfa-2880x1620.png"),
    imageAlt: "Anthropic 官网的研究工作台视觉，用作 Claude Pro 成本文章临时封面",
    sections: [
      { id: "listed-price", title: "页面标价不一定是银行卡扣款", paragraphs: ["实际结算可能包含当地税费、货币转换费和发卡行的跨境手续费。比较地区价时，应以最终付款页显示的币种与总额为准。"] },
      { id: "payment", title: "支付卡能否完成周期扣款", paragraphs: ["一次付款成功不代表后续自动续费一定成功。需要确认卡片支持境外线上交易、周期扣款和必要的身份验证。", "不建议为了低地区价频繁修改账户地区。地区信息与支付资料不一致，可能增加支付失败或账户审核风险。"] },
      { id: "channel", title: "渠道价要补上售后成本", paragraphs: ["如果通过第三方代付或购买成品号，除了价格，还要核对账号控制权、质保周期、补发条件和退款路径。不能独立核验的优惠资格，不应当视为长期稳定价格。"] },
    ],
  },
  {
    slug: "api-transit-model-detection",
    title: "API 中转站模型检测：如何核验模型列表与连通性",
    excerpt: "模型名称出现在列表里，不等于真实可调用；一次最小请求可以补足关键证据。",
    category: "API 实务",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-04",
    readingMinutes: 7,
    imageUrl: anthropicImage("3c9bf89d6c75815dd5835e1cb8ce0bca0ead0d8d-1200x630.jpg"),
    imageAlt: "Anthropic 官网的安全研究视觉，用作 API 模型检测文章临时封面",
    sections: [
      { id: "model-list", title: "先读取公开模型列表", paragraphs: ["OpenAI 兼容接口通常提供模型列表端点。它能说明当前密钥看到了哪些模型 ID，但不能单独证明每个模型都能完成推理。", "记录端点地址、返回时间和模型 ID，避免只凭站点宣传页判断覆盖范围。"] },
      { id: "minimal-request", title: "再做一次最小推理请求", paragraphs: ["选择一个低成本模型，发送不含敏感数据的最小请求，观察状态码、响应时间和返回模型字段。失败时区分鉴权、余额、限流、上游不可用和模型映射错误。"], bullets: ["使用临时、低额度密钥", "请求内容不包含个人或业务数据", "检测后及时轮换测试密钥", "不要把单次成功当作长期可用率"] },
      { id: "evidence", title: "把检测结果放回长期证据里", paragraphs: ["模型检测只能证明某个时间点的连通性。选择长期使用的中转站时，还要结合公开状态页、历史异常、价格倍率和数据使用说明。"] },
    ],
  },
  {
    slug: "ai-card-shop-risk-checklist",
    title: "AI 订阅卡网风险判断清单",
    excerpt: "从商品描述、店铺痕迹、售后入口和交易平台四个方面减少踩坑。",
    category: "风险核验",
    publishedAt: "2026-08-31",
    updatedAt: "2026-09-04",
    readingMinutes: 6,
    imageUrl: "https://www.anthropic.com/api/opengraph-illustration?name=Hand%20Lock&backgroundColor=heather",
    imageAlt: "Anthropic 工程页面的抽象技术视觉，用作渠道风险核验文章临时封面",
    sections: [
      { id: "listing", title: "先读完整商品描述", paragraphs: ["重点确认交付方式、账号归属、订阅期限、库存状态、质保范围和售后时段。标题写着官方会员，不代表一定交付官方独享账号。"] },
      { id: "merchant", title: "检查店铺是否留下可验证痕迹", paragraphs: ["查看店铺经营时间、商品数量、联系方式、售后群和历史公告。群聊人数本身不是信用证明，真正重要的是售后是否持续响应、规则是否明确。"], bullets: ["是否提供公开售后入口", "商品更新是否连续而非一次性出现", "异常、补发与退款规则是否写清", "是否要求脱离可投诉平台私下转账"] },
      { id: "after-sale", title: "发生异常时先保留证据", paragraphs: ["保存商品页面、付款记录、聊天记录和实际交付结果。先联系店铺售后，再通过原交易平台投诉；也可以向 PriceAI 提交举报，帮助下架异常报价。"] },
    ],
  },
  {
    slug: "token-billing-vs-monthly-subscription",
    title: "按 Token 计费和月付订阅，应该怎么选",
    excerpt: "轻度聊天、稳定高频使用和程序化调用，对应完全不同的成本结构。",
    category: "数据方法",
    publishedAt: "2026-08-30",
    updatedAt: "2026-09-04",
    readingMinutes: 6,
    imageUrl: anthropicImage("d337d7c546fdeabce5d41ecd2b96ea385bb5f223-2880x1620.jpg"),
    imageAlt: "Anthropic 官网的视频缩略视觉，用作 Token 计费与订阅比较文章临时封面",
    sections: [
      { id: "usage", title: "先区分交互使用和程序调用", paragraphs: ["月付订阅通常面向网页、桌面端和移动端的交互体验，可能包含语音、文件、项目和客户端工具。API 按输入与输出 Token 计费，更适合代码、自动化和第三方客户端。"] },
      { id: "cost", title: "用自己的频率估算月成本", paragraphs: ["低频、短文本调用时，API 可能比固定月费灵活。高频对话、长上下文或持续使用官方客户端功能时，订阅更容易控制预算。", "估算 API 成本时，要分别计算输入、缓存输入、输出和工具调用，不要只看最低的输入单价。"] },
      { id: "hybrid", title: "很多场景适合组合使用", paragraphs: ["可以用官方订阅承担日常交互，再给自动化任务设置独立 API 预算。这样既保留完整客户端体验，也能清楚限制程序调用成本。"] },
    ],
  },
];

export function getDocArticle(slug: string) {
  return docsArticles.find((article) => article.slug === slug);
}
