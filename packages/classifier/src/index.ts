import type {
  ClassificationResult,
  OfferAttributes,
  OfferMode,
  RawOfferInput,
} from "@price-radar/schema";

const VERSION = "rules-2026-09-11.1";

interface ProductRule {
  slug: string;
  include: RegExp[];
  exclude?: RegExp[];
  /** Every pattern must also match. Gates brandless plan words on card-shop wording. */
  require?: RegExp[];
}

// Card-shop purchase wording. Note: `\b` is defined on [A-Za-z0-9_] and therefore
// never matches beside a Chinese character, so these alternatives carry no `\b`.
const PURCHASE_CONTEXT = /充值|代充|直充|成品|普号|空号|账号|月卡|年卡|季卡|周卡|质保|订阅|卡密|兑换|cdk|秒发|自动发货|车位|席位|拼车|轮转|开票|发票|反代|会员|限制/i;

// Other vendors' plans, and unrelated memberships that also use "plus"/"team".
// Only the brandless rules below consult these; branded rules keep reporting
// cross-vendor matches as conflicts.
const VENDOR_OTHER = /claude|gemini|google\s*ai|grok|cursor|perplexity|kiro|suno|即梦|dreamina|midjourney|sora|runway|kling|可灵|canva|可画|figma|notion|firefly/i;
const NON_AI_BRANDS = /京东|淘宝|拼多多|百度|华为|小米|腾讯|爱奇艺|优酷|芒果|酷狗|网易云|喜马拉雅|剪映|网盘|文库|影视|视频会员|音乐|打车|外卖|粉丝|抖音|快手|美团|饿了么|迅雷|夸克|steam|netflix|spotify|youtube|disney|office|wps/i;

// Another vendor's assistant, often shelved under an OpenAI category by mistake.
const OTHER_ASSISTANTS = /豆包|doubao|文心|通义|讯飞|kimi|智谱|glm|混元/i;

// A phone-verification service is sold per use; 马/🐎 is the common homophone for 码.
// "已接码"/"未接马" instead describes an account that is already verified, so it is an
// attribute of the thing being sold and must never outrank the plan or mailbox it modifies.
const VERIFICATION_SERVICE = /(?<![已未带含不])接\s*(?:码|马|🐎)(?!\s*(?:后|之后|可|能|即))|(?<![未没不无]绑定?手机)验证码/i;

// A mailbox bundled with an AI account is an accessory; a mailbox sold in order to
// register one announces itself ("长效微软邮箱注册") and stays a mailbox offer.
const MAILBOX_AS_ITEM = /(?:长效|注册专用|注册用|账密|自助)[^,，。]{0,8}邮箱|邮箱[^,，。]{0,6}(?:注册|账密|直登|成品|自助)/i;

// Mentioning Plus is not selling Plus: "非plus" denies it, "可升级plus"/"开plus绑定专用"
// describe what a mailbox can later be used for, and 子邮箱/隐私邮箱 name the mailbox itself.
const PLUS_NOT_SOLD = /非\s*plus|(?:可|支持|能)\s*升级[^a-z]{0,2}plus|开\s*plus[^。]{0,4}(?:绑定|专用)|子邮箱|隐私邮箱|邮箱\s*母号|free\s*号/i;

// Card shops file tutorials, tools and spare mailboxes under a plan's category, which
// then sets that plan's minimum price. None of these deliver the subscription itself.
// Resource products are exempt: a mailbox or verification listing is its own product.
const NOT_A_SUBSCRIPTION = /教程|橙皮书|破甲|破限|提链|返利|不含\s*(?:plus|账号|会员)/i;

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
    // Shops write "Codex Go" as often as "GPT Go"; both are the Go plan, not Team.
    include: [/(?:chat\s*gpt|gpt|codex)[\s\S]{0,8}\bgo\b/i],
  },
  {
    slug: "chatgpt-pro-5x",
    include: [/(?:chat\s*gpt|gpt).*?(?:pro[\s\S]{0,20}?5\s*x|5\s*x[\s\S]{0,20}?pro)/i],
    exclude: [/教程|免费|free/i],
  },
  {
    slug: "chatgpt-pro-20x",
    include: [/(?:chat\s*gpt|gpt).*?(?:pro[\s\S]{0,20}?20\s*x|20\s*x[\s\S]{0,20}?pro)/i],
    exclude: [/教程|免费|free/i],
  },
  {
    slug: "chatgpt-pro",
    include: [
      /\bchat\s*gpt\b.*\bpro(?:\b|(?=20x|5x))/i,
      /\bgpt[-\s]*(?:5\s*x|20\s*x)?[-\s]*pro(?:\b|(?=20x|5x))/i,
    ],
    exclude: [/教程|免费|free|(?:5|20)\s*x/i],
  },
  {
    slug: "chatgpt-plus",
    include: [
      /\bchat\s*gpt\b.*\bplus\b/i,
      /\bgpt(?:[-\s]+|\s*)plus\b/i,
      /\bgpt\s*(?:[一二三四五六七八九十0-9]+个月|月卡|年卡)\s*plus\b/i,
      /\bg[-\s]*plus\b/i,
      // Bidirectional: "Codex Plus" and "Plus 代充" must both resolve.
      /plus[\s\S]*(?:codex|成品|账号|充值|代充)|(?:codex|成品|账号|充值|代充)[\s\S]*plus/i,
    ],
    exclude: [/\b(?:pro|go|team|k12|free)\b|额度/i, VERIFICATION_SERVICE, PLUS_NOT_SOLD],
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
      /\bgemini\b.*pro(?![a-z])/i,
      /\bgemini\s*\d+(?:\.\d+)?\s*pro\b/i,
      /\bgoogle\s*ai\s*pro\b/i,
    ],
    exclude: [/\bultra\b/i],
  },
  {
    slug: "supergrok",
    include: [/\bsuper\s*grok\b/i, /\bgrok\b.*\bsuper\b/i],
    exclude: [/heavy/i, /(?:包含|含|附赠|赠送|送)[^。]{0,10}supergrok/i],
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
  // Video generation is sold by tier, and the tiers are three times apart: shops quote
  // "RunwayML Pro…对应30美元" against "Max…对应95美元". One "Runway" product would put
  // the cheaper tier's price under the dearer tier's name, so they stay separate.
  {
    slug: "video-runway-max",
    include: [/runway(?:\s*ml)?[\s\S]{0,14}\bmax\b|\bmax\b[\s\S]{0,14}runway/i],
  },
  {
    slug: "video-runway-pro",
    include: [/runway(?:\s*ml)?[\s\S]{0,14}\bpro\b|\bpro\b[\s\S]{0,14}runway/i],
    exclude: [/\bmax\b/i],
  },
  // Kling is Kuaishou's own model and its listings say so ("快手视频图像Ai"). NON_AI_BRANDS
  // carries 快手, so guarding this rule with it would erase the product entirely.
  {
    slug: "video-kling",
    include: [/\bkling\b|可灵/i],
  },
  // Firefly is Adobe's image and video generator, and its own listings advertise
  // 视频生成/图片生成, so it belongs on the video shelf rather than with design tools.
  {
    slug: "video-firefly",
    include: [/\bfirefly\b/i],
  },
  // Design and office tools the shops resell. Canva is written 可画 as often as Canva,
  // Figma reaches this market as an education verification, and Notion is sold as
  // Notion AI 商业版 rather than as plain Notion.
  {
    slug: "design-canva",
    include: [/\bcanva\b|可画/i],
  },
  {
    slug: "design-figma",
    include: [/\bfigma\b/i],
  },
  {
    // No trailing \b: the commonest listing is "NotionAI商业版", where the next character
    // is a word character and \bnotion\b therefore never matches.
    slug: "design-notion",
    include: [/notion/i],
  },
  // Shops routinely drop the brand entirely ("PRO 20X 官方充值月卡", "5X TEAM 轮转号").
  // These sit last so any branded rule wins, and they only fire inside card-shop
  // purchase wording, never for another vendor or an unrelated membership.
  {
    slug: "chatgpt-team",
    include: [/(?:^|[^a-z])team(?:[^a-z]|$)/i],
    require: [PURCHASE_CONTEXT],
    exclude: [VENDOR_OTHER, NON_AI_BRANDS, /microsoft|teams(?:[^a-z]|$)/i],
  },
  {
    slug: "chatgpt-pro-20x",
    include: [/pro[^a-z]{0,8}20\s*x|20\s*x[^a-z]{0,8}pro|(?:^|[^a-z])20\s*x(?:[^a-z]|$)/i],
    require: [PURCHASE_CONTEXT],
    exclude: [VENDOR_OTHER, NON_AI_BRANDS, /(?:^|[^a-z])team(?:[^a-z]|$)|教程|免费|free/i],
  },
  {
    slug: "chatgpt-pro-5x",
    include: [/pro[^a-z]{0,8}5\s*x|5\s*x[^a-z]{0,8}pro|(?:^|[^a-z])5\s*x(?:[^a-z]|$)/i],
    require: [PURCHASE_CONTEXT],
    exclude: [VENDOR_OTHER, NON_AI_BRANDS, /(?:^|[^a-z])team(?:[^a-z]|$)|20\s*x|教程|免费|free/i],
  },
  {
    slug: "chatgpt-plus",
    include: [/(?:^|[^a-z])plus(?:[^a-z]|$)/i],
    require: [PURCHASE_CONTEXT],
    // 接码/接马 priced as a service must not set a ChatGPT Plus minimum price.
    exclude: [VENDOR_OTHER, NON_AI_BRANDS, /(?:^|[^a-z])(?:pro|go|team|k12)(?:[^a-z]|$)|额度/i, VERIFICATION_SERVICE, PLUS_NOT_SOLD],
  },
];


// Broad account/service categories never impersonate an exact paid plan.
const additionalRules: ProductRule[] = [
  // Guides and helper tools are sold in their own right; NOT_A_SUBSCRIPTION keeps them
  // out of the plan rules, and these two give them a home instead of dropping them.
  { slug: 'resource-tutorial', include: [/教程|橙皮书|攻略/i], exclude: [NON_AI_BRANDS] },
  { slug: 'resource-tool', include: [/提链|破甲|破限|注册机/i], exclude: [NON_AI_BRANDS] },
  { slug: 'chatgpt-account', include: [/(?:chat\s*gpt|gpt).*(?:普号|普通号|成品老号|空号)/i, /g[-\s]*free.*(?:普号|codex)/i, /codex.*(?:成品|普号|空号)/i, /(?:chat\s*gpt|gpt)\s*free[\s\S]{0,4}账号/i] },
  { slug: 'claude-account', include: [/claude.*(?:普号|普通账号|兑换号|空号)/i] },
  { slug: 'gemini-account', include: [/gemini.*(?:账号|成品|账户)/i] },
  { slug: 'grok-account', include: [/grok.*(?:普号|体验号|普通账号)/i] },
  { slug: 'supergrok-heavy', include: [/(?:super\s*)?grok.*heavy/i] },
  { slug: 'cursor-account', include: [/cursor.*(?:账号|成品|账户)/i] },
  { slug: 'kiro-pro', include: [/kiro.*(?:pro|额度)/i] },
  { slug: 'kiro-account', include: [/kiro.*(?:普号|free|账号)/i] },
  { slug: 'suno-account', include: [/suno.*(?:账号|会员|pro|成品)/i] },
  { slug: 'dreamina-account', include: [/(?:即梦|dreamina).*(?:账号|会员|成品|积分)/i] },
  // Merchants write "Google个人邮箱"/"谷歌 邮箱"; allow a short filler before 邮箱.
  { slug: 'resource-gmail', include: [/(?:gmail|(?:谷歌|google)[^a-z]{0,4}邮箱)/i], exclude: [VERIFICATION_SERVICE] },
  { slug: 'resource-outlook', include: [/(?:outlook|hotmail|微软[^a-z]{0,4}邮箱)/i] },
  { slug: 'resource-icloud', include: [/icloud.*(?:邮箱|邮件)/i] },
  { slug: 'resource-education-email', include: [/(?:教育邮箱|edu\s*邮箱)/i] },
  { slug: 'resource-apple-account', include: [/apple\s*id|苹果账号/i] },
  { slug: 'resource-openai-verification', include: [/(?:openai|chat\s*gpt|codex|gpt)/i], require: [VERIFICATION_SERVICE] },
  { slug: 'resource-google-verification', include: [/(?:google|gmail|gemini|谷歌|youtube|油管)/i], require: [VERIFICATION_SERVICE] },
  { slug: 'resource-telegram-premium', include: [/(?:telegram|电报|tg).*(?:premium|会员)/i] },
];

const modeRules: Array<{ mode: OfferMode; patterns: RegExp[] }> = [
  // This market writes 充 as 冲 about as often, and "官方充值" is its commonest
  // wording for recharging the buyer's own account.
  { mode: "recharge", patterns: [/代[充冲]|直[充冲]|官[充冲]|秒[充冲]|官方[充冲]值|充值到.*账号|自己账号|原号/i] },
  // Credentials are written with whatever separator the shop happens to use. "成品"
  // on its own is not added: it appears in descriptions often enough to outrank the
  // delivery the title itself states, turning 日抛 and 直充 offers into stock accounts.
  { mode: "finished_account", patterns: [/成品号|成号|账号\s*[-—|、\/]*\s*密码|账密|独享账号|普号|普通号|空号/i] },
  { mode: "redeem_code", patterns: [/卡密|兑换码|兑换链接|激活码|礼品卡|\bcdk\b/i] },
  { mode: "team_seat", patterns: [/team\s*席位|团队席位|business\s*席位/i] },
  { mode: "shared_account", patterns: [/拼车|合租|共享账号|共享会员|家庭组|家庭版|家庭车位/i] },
  { mode: "web_mirror", patterns: [/镜像|网页共享|仅网页|共享站/i] },
  { mode: "reverse_proxy", patterns: [/反代|号池|逆向/i] },
  { mode: "api_credit", patterns: [/\bapi\b|额度包|token/i] },
  { mode: "short_term", patterns: [/日抛|小时号|[1-9]\s*天号/i] },
];

/**
 * Merchants disguise brand names to dodge platform filters ("GP.T", "Gtp", "Gρt",
 * "Co dex", "Super gr0k"). Normalising once here lets every rule benefit instead
 * of each one growing its own alias list.
 */
function normalizeBrandAliases(text: string): string {
  return text
    .replace(/[\u03c1\u0440]/g, "p")
    .replace(/\bgr0k\b/gi, "grok")
    .replace(/[×✖╳]/g, "x")
    .replace(/\bg\s*[.\u00b7\u30fb]\s*p\s*[.\u00b7\u30fb]?\s*t\b/gi, "gpt")
    .replace(/\bg\s*[皮屁]\s*t\b/gi, "gpt")
    .replace(/\b(?:gtp|gpp|ggt|jpt)\b/gi, "gpt")
    .replace(/\bco\s+dex\b/gi, "codex")
    .replace(/\bcla\s+ude\b/gi, "claude")
    .replace(/\bgro\s+k\b/gi, "grok")
    .replace(/\bsuper\s*gr[o0](?!k)\b/gi, "supergrok")
    .replace(/\boai\b/gi, "openai")
    // Merchants write 帐密/帐号 as often as 账密/账号; one normalisation serves every rule.
    .replace(/帐/g, "账");
}

function normalizedText(offer: RawOfferInput): string {
  return normalizeBrandAliases([offer.rawTitle, offer.rawDescription, offer.rawCategory]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim());
}

function normalizedProductText(offer: RawOfferInput): string {
  return normalizeBrandAliases([offer.rawTitle, offer.rawCategory]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim());
}

// The title alone, for deciding whether the listing names its own plan.
function normalizedTitleText(offer: RawOfferInput): string {
  return normalizeBrandAliases(offer.rawTitle
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim());
}

function matchProduct(text: string): {
  slug: string | null;
  matchedRules: string[];
  conflicts: string[];
} {
  const eligible = (rule: ProductRule) =>
    rule.include.some((pattern) => pattern.test(text)) &&
    (rule.require?.every((pattern) => pattern.test(text)) ?? true) &&
    !rule.exclude?.some((pattern) => pattern.test(text)) &&
    (rule.slug.startsWith("resource-") || !NOT_A_SUBSCRIPTION.test(text)) &&
    (rule.slug.startsWith("resource-") || !OTHER_ASSISTANTS.test(text));
  let matches = productRules.filter(eligible);

  if (!matches.length) matches = additionalRules.filter(rule => {
    // Mail bundled with an AI account is not a separate mailbox offer.
    if (['resource-gmail','resource-outlook','resource-icloud','resource-education-email'].includes(rule.slug)
      && /chat\s*gpt|codex|claude|gemini|grok/i.test(text) && !MAILBOX_AS_ITEM.test(text)) return false;
    return eligible(rule);
  });
  if (matches.length === 0) {
    return { slug: null, matchedRules: [], conflicts: [] };
  }

  const [first] = matches;
  if (!first) {
    return { slug: null, matchedRules: [], conflicts: [] };
  }

  // Two rules naming the same plan agree; only a different plan is a conflict.
  const otherSlugs = [...new Set(matches.map((match) => match.slug))].filter(
    (slug) => slug !== first.slug,
  );
  return {
    slug: first.slug,
    matchedRules: [`product:${first.slug}`],
    conflicts: otherSlugs.map((slug) => `also_matches:${slug}`),
  };
}

// Shops describe one sale twice: "官方直充" beside "自助卡密续费", or "成品号" beside
// "日抛". Treating that as a conflict and voiding the delivery left 82% of subscription
// offers with no delivery, and therefore no comparable price at all. Rank them instead:
// what the buyer receives outranks how it ships, which outranks how long it lasts.
const MODE_PRIORITY: OfferMode[] = [
  "team_seat", "shared_account", "web_mirror",
  "finished_account", "recharge", "redeem_code",
  "api_credit", "reverse_proxy", "short_term",
];

// A listing that states it cannot be logged into is a proxy, whatever else it mentions.
const PROXY_ONLY = /仅反代|无账密|只能反代|不支持登录/i;

// A shelf name listing several categories ("其他（Team，K12，镜像，拼车等）") says nothing
// about this item's delivery, yet its stray words win the match: it turned 额度充值 into
// 拼车 and a 镜像站 into a shared account. A category naming one form still counts.
const SHELF_CATEGORY = /其他|等[）)]/;

function deliveryText(offer: RawOfferInput, fullText: string): string {
  if (!offer.rawCategory || !SHELF_CATEGORY.test(offer.rawCategory)) return fullText;
  return normalizeBrandAliases([offer.rawTitle, offer.rawDescription]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim());
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

  const proxyOnly = PROXY_ONLY.test(text)
    ? matches.find((match) => match.mode === "reverse_proxy")
    : undefined;
  const chosen = proxyOnly ?? [...matches].sort(
    (left, right) => MODE_PRIORITY.indexOf(left.mode) - MODE_PRIORITY.indexOf(right.mode),
  )[0] ?? first;

  return {
    mode: chosen.mode,
    matchedRules: [`mode:${chosen.mode}`],
    conflicts: matches.filter((match) => match.mode !== chosen.mode).map((match) => `also_mode:${match.mode}`),
  };
}

function extractDurationDays(text: string): number | undefined {
  // A warranty is a promise about the goods, never their term, so it is dropped first.
  // Shops write it with digits and with characters alike ("质保30天", "质保半年").
  text = text.replace(/质保\s*(?:\d+|半|一|二|两|三|六)\s*(?:小时|天|个月|月|年)/g, " ");
  if (/半年/.test(text)) return 180;
  if (/年卡|年订阅|年付|年费|包年|一年|一整年/.test(text)) return 365;
  if (/季卡|季付|包季|季度|三个月/.test(text)) return 90;
  if (/月卡|月订阅|月付|月费|月权益|月度|包月|一个月|一月/.test(text)) return 30;
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
  // A title that names its own plan outranks the category: shops file a Plus listing
  // under a "Pro 20X" category. But a title that only says "account" is not more precise
  // than the category, so it defers unless it calls itself a free or basic account.
  const titleText = normalizedTitleText(offer);
  const titleMatch = matchProduct(titleText);
  const titleIsPrecise = titleMatch.slug !== null
    && (!/-account$/.test(titleMatch.slug) || /free|普号|空号|普通号|半成品/i.test(titleText));
  const product = titleIsPrecise ? titleMatch : matchProduct(normalizedProductText(offer));
  const mode = matchOfferMode(deliveryText(offer, text));
  const conflictingSignals = [...product.conflicts, ...mode.conflicts];
  const matchedRules = [...product.matchedRules, ...mode.matchedRules];
  const attributes = extractAttributes(text, mode.mode);
  if (product.slug && ['resource-gmail','resource-outlook','resource-icloud','resource-education-email','resource-apple-account','resource-tutorial','resource-tool'].includes(product.slug)) {
    // Mailbox registration age and download-link validity are not subscription periods.
    delete attributes.durationDays;
  }

  // Product confidence is independent of delivery metadata. Mixed product
  // identities remain quarantined; unknown/mixed modes cannot win default ranking.
  const confidence = !product.slug ? 0.2 : product.conflicts.length ? 0.6 : 0.9;
  // Neither an overlapping description nor an unconfirmed plan erases the delivery. A
  // "普通账号" product is a finished account by definition, so its delivery is the most
  // certain part of it; voiding it left all 450 account-class offers uncomparable.
  // requiresReview still carries any conflict forward.

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
