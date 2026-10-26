// Subscription and coding-plan allowances, read by hand from each vendor's own page on the
// date below. Quotas are restated as the vendor words them; where a page publishes no price,
// none is invented. Re-check against the source links before changing a figure.

export const PLAN_QUOTAS_CHECKED_ON = "2026-10-26";

export interface PlanQuotaRow {
  plan: string;
  price: string;
  quota: string;
}

export interface PlanQuotaProvider {
  provider: string;
  kind: "subscription" | "coding";
  sourceUrl: string;
  plans: PlanQuotaRow[];
  notes: string;
}

export const PLAN_QUOTA_PROVIDERS: readonly PlanQuotaProvider[] = [
  {
    provider: "ChatGPT",
    kind: "subscription",
    sourceUrl: "https://chatgpt.com/pricing/",
    plans: [
      { plan: "Plus", price: "$20/月", quota: "扩展的消息、上传、深度研究与 Codex 用量" },
      { plan: "Pro", price: "$100/月起", quota: "可选 3 个用量档位，更长的 Codex 与 ChatGPT Work 会话" },
    ],
    notes: "网页与 Codex 共用订阅额度，具体限制见官方帮助中心。订阅额度不等同 API token。",
  },
  {
    provider: "Claude",
    kind: "subscription",
    sourceUrl: "https://claude.com/pricing",
    plans: [
      { plan: "Pro", price: "$20/月", quota: "含 Claude Code，5 小时滚动窗口限额" },
      { plan: "Max 5x", price: "$100/月", quota: "Pro 用量的 5 倍" },
      { plan: "Max 20x", price: "$200/月", quota: "Pro 用量的 20 倍" },
    ],
    notes: "所有套餐按 5 小时滚动窗口计量，付费套餐另有每周上限。价格不含税。",
  },
  {
    provider: "Google AI",
    kind: "subscription",
    sourceUrl: "https://gemini.google/subscriptions/",
    plans: [
      { plan: "AI Plus", price: "$4.99/月", quota: "免费版用量的 2 倍" },
      { plan: "AI Pro", price: "$19.99/月", quota: "免费版用量的 4 倍" },
      { plan: "AI Ultra 5x", price: "$99.99/月", quota: "AI Pro 用量的 5 倍" },
      { plan: "AI Ultra 20x", price: "$199.99/月", quota: "AI Pro 用量的 20 倍" },
    ],
    notes: "美国价格；各国价格与可用地区不同，见官方订阅页。",
  },
  {
    provider: "Grok",
    kind: "subscription",
    sourceUrl: "https://x.ai/pricing",
    plans: [
      { plan: "Plus（原 SuperGrok Lite）", price: "$8/月", quota: "用量基准（1x）" },
      { plan: "Premium（原 SuperGrok）", price: "$30/月", quota: "Plus 的 4 倍" },
      { plan: "Super（原 SuperGrok Plus）", price: "$100/月", quota: "Plus 的 15 倍" },
      { plan: "Ultra（原 SuperGrok Heavy）", price: "$200/月", quota: "Plus 的 50 倍" },
    ],
    notes: "2026-10-12 起的新档位，一份订阅覆盖 Grok 与 Cursor，用量每周刷新。",
  },
  {
    provider: "智谱 GLM Coding Plan",
    kind: "coding",
    sourceUrl: "https://docs.bigmodel.cn/cn/coding-plan/overview",
    plans: [
      { plan: "Lite", price: "见购买页", quota: "每 5 小时 2,000 积分 · 每周 10,000 积分" },
      { plan: "Pro", price: "见购买页", quota: "每 5 小时 12,000 积分 · 每周 60,000 积分" },
      { plan: "Max", price: "见购买页", quota: "每 5 小时 28,000 积分 · 每周 140,000 积分" },
    ],
    notes: "工作日 14:00–18:00 为高峰，其余时段按 50% 抵扣积分。支持 Claude Code 等 20+ 编程工具。",
  },
  {
    provider: "阿里云百炼 Coding Plan",
    kind: "coding",
    sourceUrl: "https://help.aliyun.com/zh/model-studio/coding-plan",
    plans: [
      { plan: "Pro", price: "¥200/月（新客首月 ¥39.9）", quota: "每 5 小时 6,000 次 · 每周 45,000 次 · 每月 90,000 次请求" },
    ],
    notes: "Lite 套餐已停止新购与续费。含千问、GLM、Kimi、MiniMax 等模型；一次提问通常消耗多次请求。",
  },
  {
    provider: "腾讯云 TokenHub Coding Plan",
    kind: "coding",
    sourceUrl: "https://cloud.tencent.com/document/product/1823/130092",
    plans: [
      { plan: "Lite", price: "¥40/月", quota: "每 5 小时约 1,200 次 · 每周约 9,000 次 · 每月约 18,000 次请求" },
      { plan: "Pro", price: "¥200/月", quota: "每 5 小时约 6,000 次 · 每周约 45,000 次 · 每月约 90,000 次请求" },
    ],
    notes: "仅限在编程工具中使用，禁止以 API 形式用于脚本或应用后端，禁止账号共享。",
  },
  {
    provider: "阶跃星辰 Step Plan",
    kind: "coding",
    sourceUrl: "https://platform.stepfun.com/docs/zh/step-plan/pricing",
    plans: [
      { plan: "Mini", price: "¥49/月", quota: "每月 400M Credit" },
      { plan: "Plus", price: "¥99/月", quota: "每月 1,600M Credit" },
      { plan: "Pro", price: "¥199/月", quota: "每月 8,000M Credit" },
    ],
    notes: "1 元 = 1M Credit，当月未用完清零。Step 5 Preview 高峰时段按 2 倍扣减。",
  },
  {
    provider: "Kimi Code",
    kind: "coding",
    sourceUrl: "https://www.kimi.com/code",
    plans: [
      { plan: "Plus", price: "$19/月（年付 $15/月）", quota: "定期刷新的用量额度，多设备登录" },
      { plan: "Pro", price: "$39/月（年付 $31/月）", quota: "更高额度与并发上限" },
      { plan: "Max", price: "$99/月（年付 $79/月）", quota: "适合日常高强度开发" },
      { plan: "Ultra", price: "$199/月（年付 $159/月）", quota: "最高额度" },
    ],
    notes: "Plus 及以上可用 Kimi K3 系列模型。",
  },
  {
    provider: "OpenCode Go",
    kind: "coding",
    sourceUrl: "https://opencode.ai/go",
    plans: [
      { plan: "Go", price: "$10/月", quota: "按模型给出每 5 小时请求数与月度用量上限" },
      { plan: "Go Plus", price: "$40/月", quota: "更高的每 5 小时与月度上限" },
    ],
    notes: "多模型订阅，可接入任意编程 Agent，额度用完可单独充值。",
  },
];
