import type {
  ClassificationResult,
  OfferAttributes,
  OfferMode,
  RawOfferInput,
} from "@price-radar/schema";

const VERSION = "rules-2026-09-09.1";

interface ProductRule {
  slug: string;
  include: RegExp[];
  exclude?: RegExp[];
}

const productRules: ProductRule[] = [
  {
    slug: "codex-credits",
    include: [/\bcodex\b.*(?:额度|点数|credits?)/i],
    exclude: [/接马|接码|绑定|手机号/i],
  },
  {
    slug: "chatgpt-team",
    include: [/(?:chat\s*gpt|g[-\s]*p[-\s]*t|openai).*\bteam\b/i, /\bg\s*team\b/i],
  },
  {
    slug: "chatgpt-go",
    include: [/(?:chat\s*gpt|gpt).*\bgo\b/i],
  },
  {
    slug: "chatgpt-pro",
    include: [
      /\bchat\s*gpt\b.*\bpro(?:\b|(?=20x|5x))/i,
      /\bgpt[-\s]*(?:5\s*x|20\s*x)?[-\s]*pro(?:\b|(?=20x|5x))/i,
    ],
    exclude: [/教程|免费|free/i],
  },
  {
    slug: "chatgpt-plus",
    include: [
      /\bchat\s*gpt\b.*\bplus\b/i,
      /\bgpt(?:[-\s]+|\s*)plus\b/i,
      /\bgpt\s*(?:[一二三四五六七八九十0-9]+个月|月卡|年卡)\s*plus\b/i,
      /\bg[-\s]*plus\b/i,
      /\bplus\b.*\b(?:codex|成品|账号|充值|代充)\b/i,
    ],
    exclude: [/\b(?:pro|go|team|k12|free)\b|接马|接码|额度/i],
  },
  {
    slug: "claude-max-20x",
    include: [/\bclaude\b.*(?:\bmax\s*)?\b20\s*x\b/i],
  },
  {
    slug: "claude-max-5x",
    include: [/\bclaude\b.*(?:\bmax\s*)?\b5\s*x\b/i],
  },
  {
    slug: "claude-pro",
    include: [/\bclaude\b.*\bpro\b/i],
    exclude: [/\bmax\b/i],
  },
  {
    slug: "google-ai-ultra",
    include: [/\b(?:google\s*ai|gemini)\b.*\bultra\b/i],
  },
  {
    slug: "gemini-pro",
    include: [
      /\bgemini\b.*\bpro\b/i,
      /\bgemini\s*\d+(?:\.\d+)?\s*pro\b/i,
      /\bgoogle\s*ai\s*pro\b/i,
    ],
    exclude: [/\bultra\b/i],
  },
  {
    slug: "supergrok",
    include: [/\bsuper\s*grok\b/i, /\bgrok\b.*\bsuper\b/i],
    exclude: [/heavy/i],
  },
  {
    slug: "cursor-pro",
    include: [/\bcursor\b.*\bpro\b/i],
  },
  {
    slug: "perplexity-pro",
    include: [/\bperplexity\b.*\bpro\b/i],
  },
  {
    slug: "x-premium",
    include: [/(?:x[-\s]*twitter|twitter|推特).*\bpremium\b/i],
  },
];

// Broad account/service categories never impersonate an exact paid plan.
const additionalRules: ProductRule[] = [
  { slug: 'chatgpt-account', include: [/(?:chat\s*gpt|gpt).*(?:普号|普通号|成品老号|空号)/i] },
  { slug: 'claude-account', include: [/claude.*(?:普号|普通账号|兑换号|空号)/i] },
  { slug: 'grok-account', include: [/grok.*(?:普号|体验号|普通账号)/i] },
  { slug: 'supergrok-heavy', include: [/(?:super\s*)?grok.*heavy/i] },
  { slug: 'cursor-account', include: [/cursor.*(?:账号|成品|账户)/i] },
  { slug: 'kiro-pro', include: [/kiro.*(?:pro|额度)/i] },
  { slug: 'kiro-account', include: [/kiro.*(?:普号|free|账号)/i] },
  { slug: 'suno-account', include: [/suno.*(?:账号|会员|pro|成品)/i] },
  { slug: 'dreamina-account', include: [/(?:即梦|dreamina).*(?:账号|会员|成品|积分)/i] },
  { slug: 'resource-gmail', include: [/(?:gmail|谷歌邮箱|google\s*邮箱)/i] },
  { slug: 'resource-outlook', include: [/(?:outlook|hotmail|微软邮箱)/i] },
  { slug: 'resource-icloud', include: [/icloud.*(?:邮箱|邮件)/i] },
  { slug: 'resource-education-email', include: [/(?:教育邮箱|edu\s*邮箱)/i] },
  { slug: 'resource-apple-account', include: [/apple\s*id|苹果账号/i] },
  { slug: 'resource-openai-verification', include: [/(?:openai|chat\s*gpt|codex|gpt).*(?:接码|验证码)/i] },
  { slug: 'resource-google-verification', include: [/(?:google|gemini|谷歌).*(?:接码|验证码)/i] },
  { slug: 'resource-telegram-premium', include: [/(?:telegram|电报|tg).*(?:premium|会员)/i] },
];

const modeRules: Array<{ mode: OfferMode; patterns: RegExp[] }> = [
  { mode: "recharge", patterns: [/代充|直充|充值到.*账号|自己账号|原号/i] },
  { mode: "finished_account", patterns: [/成品号|成号|账号密码|账密|独享账号/i] },
  { mode: "redeem_code", patterns: [/卡密|兑换码|礼品卡|\bcdk\b/i] },
  { mode: "team_seat", patterns: [/team\s*席位|团队席位|business\s*席位/i] },
  { mode: "shared_account", patterns: [/拼车|合租|共享账号|共享会员/i] },
  { mode: "web_mirror", patterns: [/镜像|网页共享|仅网页|共享站/i] },
  { mode: "reverse_proxy", patterns: [/反代|号池|逆向/i] },
  { mode: "api_credit", patterns: [/\bapi\b|额度包|token/i] },
  { mode: "short_term", patterns: [/日抛|小时号|[1-9]\s*天号/i] },
];

function normalizedText(offer: RawOfferInput): string {
  return [offer.rawTitle, offer.rawDescription, offer.rawCategory]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedProductText(offer: RawOfferInput): string {
  return [offer.rawTitle, offer.rawCategory]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function matchProduct(text: string): {
  slug: string | null;
  matchedRules: string[];
  conflicts: string[];
} {
  let matches = productRules.filter(
    (rule) =>
      rule.include.some((pattern) => pattern.test(text)) &&
      !rule.exclude?.some((pattern) => pattern.test(text)),
  );

  if (!matches.length) matches = additionalRules.filter(rule => rule.include.some(pattern => pattern.test(text)));
  if (matches.length === 0) {
    return { slug: null, matchedRules: [], conflicts: [] };
  }

  const [first] = matches;
  if (!first) {
    return { slug: null, matchedRules: [], conflicts: [] };
  }

  return {
    slug: first.slug,
    matchedRules: [`product:${first.slug}`],
    conflicts: matches.slice(1).map((match) => `also_matches:${match.slug}`),
  };
}

function matchOfferMode(text: string): {
  mode: OfferMode;
  matchedRules: string[];
  conflicts: string[];
} {
  const matches = modeRules.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(text)),
  );

  const [first] = matches;
  if (!first) {
    return { mode: "unknown", matchedRules: [], conflicts: [] };
  }

  return {
    mode: first.mode,
    matchedRules: [`mode:${first.mode}`],
    conflicts: matches.slice(1).map((match) => `also_mode:${match.mode}`),
  };
}

function extractDurationDays(text: string): number | undefined {
  text = text.replace(/质保\s*\d+\s*(?:小时|天|个月|月|年)/g, " ");
  if (/年卡|年订阅|年付|一年|一整年/.test(text)) return 365;
  if (/季卡|季付|三个月/.test(text)) return 90;
  if (/月卡|月订阅|月付|一个月|一月/.test(text)) return 30;
  const monthMatch = text.match(/(\d{1,2})\s*(?:个)?月/);
  if (monthMatch?.[1]) {
    return Number(monthMatch[1]) * 30;
  }

  const dayMatch = text.match(/(\d{1,3})\s*天/);
  if (dayMatch?.[1]) {
    return Number(dayMatch[1]);
  }

  const yearMatch = text.match(/(\d{1,2})\s*年/);
  if (yearMatch?.[1]) {
    return Number(yearMatch[1]) * 365;
  }

  return undefined;
}

function extractRiskFacts(text: string): string[] {
  const facts = new Set<string>();

  if (/无质保|不质保/i.test(text)) facts.add("无质保");
  if (/质保首登|只保首登|保首次登录/i.test(text)) facts.add("仅质保首登");
  if (/仅反代|只能反代|不可网页/i.test(text)) facts.add("使用范围受限");
  if (/共享|拼车|合租/i.test(text)) facts.add("共享使用");
  if (/需要.*密码|提供.*账密|账号密码/i.test(text)) facts.add("涉及账号凭据");
  if (/不可囤|不能囤/i.test(text)) facts.add("不可囤积");
  if (/不退不换|不可退款|拒绝退款/i.test(text)) facts.add("不支持退款");
  if (/封号.*不售后|封禁.*不质保/i.test(text)) facts.add("封禁不质保");
  if (/自动重置|定期重置/i.test(text)) facts.add("权益可能重置");
  if (/日抛|小时号/i.test(text)) facts.add("短期商品");
  if (/未接码|未绑.*手机/i.test(text)) facts.add("未完成手机号验证");

  return [...facts];
}

function extractAttributes(text: string, mode: OfferMode): OfferAttributes {
  const durationDays = extractDurationDays(text);
  const riskFacts = extractRiskFacts(text);
  const noWarranty = /无质保|不质保/i.test(text);
  const firstLoginWarranty = /质保首登|只保首登|保首次登录/i.test(text);
  const fixedWarranty = text.match(/质保\s*(\d{1,3})\s*(小时|天)/i);

  let warrantyType: OfferAttributes["warrantyType"] = "unknown";
  let warrantyHours: number | undefined;

  if (noWarranty) {
    warrantyType = "none";
  } else if (firstLoginWarranty) {
    warrantyType = "first_login";
  } else if (fixedWarranty?.[1] && fixedWarranty[2]) {
    warrantyType = "fixed_hours";
    warrantyHours =
      Number(fixedWarranty[1]) * (fixedWarranty[2] === "天" ? 24 : 1);
  } else if (/质保.*订阅|全程质保|订阅期质保/i.test(text)) {
    warrantyType = "subscription_period";
  }

  const attributes: OfferAttributes = {
    offerMode: mode,
    accountOwnership: /自己账号|原号|你的账号|您账号/i.test(text)
      ? "buyer"
      : mode === "shared_account"
        ? "shared"
        : mode === "finished_account"
          ? "merchant"
          : "unknown",
    warrantyType,
    riskFacts,
  };

  const regions = [...new Set([...text.matchAll(/(美|美国|菲|菲律宾|印|印度|日|日本|港|香港|土|土耳其|台|台湾)区/g)].map(m => ({美:"US",美国:"US",菲:"PH",菲律宾:"PH",印:"IN",印度:"IN",日:"JP",日本:"JP",港:"HK",香港:"HK",土:"TR",土耳其:"TR",台:"TW",台湾:"TW"}[m[1]!])) )];
  if (regions.length === 1 && regions[0]) attributes.region = regions[0];
  if (durationDays !== undefined) attributes.durationDays = durationDays;
  if (warrantyHours !== undefined) attributes.warrantyHours = warrantyHours;
  if (/未接码|未绑.*手机/i.test(text)) attributes.phoneBound = false;
  if (/已接码|已绑.*手机/i.test(text)) attributes.phoneBound = true;
  if (/自动发货|秒发|秒冲/i.test(text)) attributes.autoDelivery = true;
  if (/不可网页|仅反代/i.test(text)) attributes.webAvailable = false;
  if (/网页可用|网页登录|网页直接登/i.test(text)) attributes.webAvailable = true;
  if (/\bapi\b|反代/i.test(text)) attributes.apiAvailable = true;
  if (/共享|拼车|合租/i.test(text)) attributes.shared = true;
  if (/开发票|可开票|发票/i.test(text)) attributes.invoiceAvailable = true;

  return attributes;
}

export function classifyOffer(offer: RawOfferInput): ClassificationResult {
  const text = normalizedText(offer);
  const product = matchProduct(normalizedProductText(offer));
  const mode = matchOfferMode(text);
  const conflictingSignals = [...product.conflicts, ...mode.conflicts];
  const matchedRules = [...product.matchedRules, ...mode.matchedRules];
  const attributes = extractAttributes(text, mode.mode);

  // Product confidence is independent of delivery metadata. Mixed product
  // identities remain quarantined; unknown/mixed modes cannot win default ranking.
  const confidence = !product.slug ? 0.2 : product.conflicts.length ? 0.6 : 0.9;
  if (mode.conflicts.length) attributes.offerMode = "unknown";

  return {
    canonicalProductSlug: product.slug,
    attributes,
    confidence,
    matchedRules,
    conflictingSignals,
    classifierVersion: VERSION,
    requiresReview: !product.slug || confidence < 0.75 || mode.conflicts.length > 0,
  };
}
