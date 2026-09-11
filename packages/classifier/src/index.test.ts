import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOffer } from './index.js';
const classify = (rawTitle: string) => classifyOffer({sourceItemId:'test',rawTitle,price:'99',rawPriceText:'99',currency:'CNY',stockState:'in_stock',productUrl:'https://example.com/item/1',capturedAt:new Date().toISOString(),rawPayloadHash:'1234567890abcdef'});
test('real merchant spelling variants retain explicit plan identity', () => {
  for (const [title,slug] of [['GPT-Plus 年订阅','chatgpt-plus'],['GPT 一个月 Plus代充（卡付）','chatgpt-plus'],['Claude 5x（正价卡付 质保）','claude-max-5x'],['Claude 20x（正价卡付 质保）','claude-max-20x'],['ChatGPT Pro20X成品','chatgpt-pro-20x']]) assert.equal(classify(title!).canonicalProductSlug,slug,title!);
});
test('unknown delivery does not lower product confidence, mixed delivery stays unknown',()=>{
  assert.equal(classify('Claude 5x').confidence,0.9);
  assert.equal(classify('Claude 5x').attributes.offerMode,'unknown');
  const r=classify('ChatGPT Plus 代充 CDK'); assert.equal(r.confidence,0.9);assert.equal(r.attributes.offerMode,'unknown');assert.ok(r.requiresReview);
});
test('conflicting plans and unrelated goods are not made eligible',()=>{
  assert.ok(classify('ChatGPT Plus Claude Pro 成品号').confidence<0.75);
  assert.equal(classify('ChatGPT Plus 接码').canonicalProductSlug,'resource-openai-verification');
  assert.equal(classify('Claude普通账号').canonicalProductSlug,'claude-account');
  assert.equal(classify('Netflix 月卡').canonicalProductSlug,null);
});
test('explicit period and region, no inference from warranty or multiple regions',()=>{
  assert.equal(classify('GPT-Plus 年订阅 美区').attributes.durationDays,365);
  assert.equal(classify('GPT-Plus 年订阅 美区').attributes.region,'US');
  assert.equal(classify('Claude Pro 质保2天').attributes.durationDays,undefined);
  assert.equal(classify('Claude Pro 美区/日区').attributes.region,undefined);
});

test('resource categories do not replace a recognized subscription',()=>{
  assert.equal(classify('ChatGPT Plus 成品号 自带gmail邮箱').canonicalProductSlug,'chatgpt-plus');
  assert.equal(classify('谷歌邮箱 美区').canonicalProductSlug,'resource-gmail');
  assert.equal(classify('SuperGrok Heavy 成品').canonicalProductSlug,'supergrok-heavy');
});

test('bundled mail and registration age are not standalone mailbox specifications',()=>{
  assert.equal(classify('G-Free普号 codex未接phone 微软邮箱').canonicalProductSlug,'chatgpt-account');
  assert.equal(classify('Gmail邮箱 注册满3个月 链接可用7天').attributes.durationDays,undefined);
});

test('explicit Pro tiers stay separate and unspecified accounts cannot set a plan minimum',()=>{
 assert.equal(classify('GPT-PRO-5X CDK').canonicalProductSlug,'chatgpt-pro-5x');
 assert.equal(classify('GPT Pro20x 拼车').canonicalProductSlug,'chatgpt-pro-20x');
 assert.ok(classify('GPT Pro5x Pro20x 成品').confidence<0.75);
 const r=classify('Gemini三个月成品号');assert.equal(r.canonicalProductSlug,'gemini-account');assert.equal(r.attributes.offerMode,'unknown');
});

test('brandless plan wording from real shop catalogs resolves to the right plan', () => {
  for (const [title, slug] of [
    ['plus官方充值月卡（质保一个月）自动发货', 'chatgpt-plus'],
    ['4个月plus 学生优惠正价开的成品号', 'chatgpt-plus'],
    ['1个月 PLUS会员 CDK充值 菲律宾卡冲充值（质保订阅）', 'chatgpt-plus'],
    ['PRO 20X官方充值月卡(质保一个月) 自动发货', 'chatgpt-pro-20x'],
    ['20x PRO月卡（官方直充）', 'chatgpt-pro-20x'],
    ['ios 20x自助充值卡密 质保订阅 不保封号', 'chatgpt-pro-20x'],
    ['【正规秒充】Pro 5x 官方充值', 'chatgpt-pro-5x'],
    ['1个月 PRO 5X 会员 ios订阅', 'chatgpt-pro-5x'],
    ['5x team 周限制 （质保1h）', 'chatgpt-team'],
    ['5X TEAM｜轮转号｜质保首登', 'chatgpt-team'],
  ] as const) assert.equal(classify(title).canonicalProductSlug, slug, title);
});

test('disguised brand spellings normalise before matching', () => {
  for (const [title, slug] of [
    ['【美区IOS】GTP Pro 20X 官方充值 质保30天', 'chatgpt-pro-20x'],
    ['【官方充值】菲区Gtp plus cdk24小时（质保30天）', 'chatgpt-plus'],
    ['越南货|Ggt plus| 硬货稳定| 质保首登', 'chatgpt-plus'],
    ['Gρt plus官方充值 (visa卡冲 质保订阅版)', 'chatgpt-plus'],
    ['PRO 20x GP.T 24小时可充 质保订阅30天', 'chatgpt-pro-20x'],
    ['Super gro lite 两个月（保15天）', 'supergrok'],
    ['Super gr0k heavy月卡成品/直充', 'supergrok-heavy'],
  ] as const) assert.equal(classify(title).canonicalProductSlug, slug, title);
});

test('loosened wording never claims unrelated memberships or another vendor plan', () => {
  for (const title of [
    '京东plus会员 年卡',
    '百度网盘 超级会员 月卡',
    '腾讯视频 超级影视 周卡（QQ号充值）',
    '安卓MAX 永久5开卡',
    '华为视频 少儿会员 月卡',
    '喜马拉雅 VIP会员 季卡',
  ]) assert.equal(classify(title).canonicalProductSlug, null, title);
  // Branded plans keep their identity and full confidence.
  assert.equal(classify('Claude 5x').canonicalProductSlug, 'claude-max-5x');
  assert.equal(classify('Claude 5x').confidence, 0.9);
  assert.equal(classify('Claude Pro 月卡 直充').canonicalProductSlug, 'claude-pro');
  assert.equal(classify('Gemini 三个月 成品号').canonicalProductSlug, 'gemini-account');
  // A brandless word with no purchase wording stays unidentified.
  assert.equal(classify('Pro').canonicalProductSlug, null);
  assert.equal(classify('Go').canonicalProductSlug, null);
});

test('a plan matched by both a branded and a brandless rule is not a self-conflict', () => {
  const r = classify('GPT Pro20x 官方充值 质保30天');
  assert.equal(r.canonicalProductSlug, 'chatgpt-pro-20x');
  assert.equal(r.confidence, 0.9, 'same plan from two rules must not look like a conflict');
});

test('a verification service is never priced as the mailbox it verifies', () => {
  for (const title of [
    'Google/Gmail/YouTube 接马 美国实卡 有效期10-30天谷歌注册',
    '【全球自助接马系统】Google/Gmail/YouTube接马 高质量',
    '【无限换号】Google/Gmail/YouTube 单次接验证码',
  ]) assert.equal(classify(title).canonicalProductSlug, 'resource-google-verification', title);
  assert.equal(classify('codex-接马-美区 高质量 Codex 接马').canonicalProductSlug, 'resource-openai-verification');
  // A real mailbox listing still resolves to the mailbox product.
  assert.equal(classify('【Google个人邮箱】2020-2025老号｜2FA').canonicalProductSlug, 'resource-gmail');
  assert.equal(classify('ChatGPT Plus 接码').canonicalProductSlug, 'resource-openai-verification');
});

test('already-verified is an account attribute, a bare 接码 is the service itself', () => {
  // The service outranks the mailbox it verifies.
  assert.equal(classify('Google/Gmail/YouTube 接马 美国实卡').canonicalProductSlug, 'resource-google-verification');
  assert.equal(classify('【全球自助接马系统】Google/Gmail/YouTube接马').canonicalProductSlug, 'resource-google-verification');
  // A real mailbox that merely states its verification status stays a mailbox.
  assert.equal(classify('谷歌邮箱 老号 已接码 2FA').canonicalProductSlug, 'resource-gmail');
  assert.equal(classify('【Google个人邮箱】未接马 2020-2025老号').canonicalProductSlug, 'resource-gmail');
  assert.equal(classify('微软邮箱 outlook 已接马').canonicalProductSlug, 'resource-outlook');
  // "接码后可用" is a condition for using the account, not a 接码 service on sale.
  assert.equal(classify('GPT Plus 成品号 【质保5天】【接码后可用codex】【未接码】').canonicalProductSlug, 'chatgpt-plus');
});

test('the category column carries plan identity when the title omits it', () => {
  const withCategory = (rawTitle: string, rawCategory: string) => classifyOffer({
    sourceItemId: 'test', rawTitle, rawCategory, price: '99', rawPriceText: '99', currency: 'CNY',
    stockState: 'in_stock', productUrl: 'https://example.com/item/1',
    capturedAt: new Date().toISOString(), rawPayloadHash: '1234567890abcdef',
  });
  assert.equal(withCategory('Cursor月卡--质保', 'Cursor Pro').canonicalProductSlug, 'cursor-pro');
  assert.equal(withCategory('perplexity-年卡-独享', 'Perplexity Pro').canonicalProductSlug, 'perplexity-pro');
});

test('verification status, tier spacing and fullwidth glyphs do not erase plan identity', () => {
  const withCategory = (rawTitle: string, rawCategory: string) => classifyOffer({
    sourceItemId: 'test', rawTitle, rawCategory, price: '99', rawPriceText: '99', currency: 'CNY',
    stockState: 'in_stock', productUrl: 'https://example.com/item/1',
    capturedAt: new Date().toISOString(), rawPayloadHash: '1234567890abcdef',
  });
  // "已接马"/"未接码" describe the account on sale, so a Plus listing stays a Plus listing.
  assert.equal(withCategory('已接马-PLUS成品号-质保首登-带2FA认证', 'chat Plus 已接码').canonicalProductSlug, 'chatgpt-plus');
  assert.equal(withCategory('GPT Plus 菲律宾区官充月费 未接码 成品号 质保', 'ChatGpt 成品号').canonicalProductSlug, 'chatgpt-plus');
  // A fullwidth multiplication sign is how merchants write the 20x tier.
  assert.equal(classify('[正规秒冲]Pro 20× IOS官方订阅(质保订阅)').canonicalProductSlug, 'chatgpt-pro-20x');
  // The tier need not sit next to "Pro".
  assert.equal(withCategory('GPT Pro自助卡密一个月（质保订阅） 5x 100刀版本', 'Gemini').canonicalProductSlug, 'chatgpt-pro-5x');
  // A mailbox sold in order to register an AI account is still a mailbox offer.
  assert.equal(withCategory('gro 长效微软邮箱注册 无会员普通号 附赠微软邮箱', 'gr0k').canonicalProductSlug, 'resource-outlook');
  // Mail merely bundled with an AI account is not.
  assert.equal(classify('G-Free普号 codex未接phone 微软邮箱').canonicalProductSlug, 'chatgpt-account');
});

test('tutorials, tools and spare mailboxes never set a subscription price', () => {
  const withCategory = (rawTitle: string, rawCategory: string) => classifyOffer({
    sourceItemId: 'test', rawTitle, rawCategory, price: '99', rawPriceText: '99', currency: 'CNY',
    stockState: 'in_stock', productUrl: 'https://example.com/item/1',
    capturedAt: new Date().toISOString(), rawPayloadHash: '1234567890abcdef',
  });
  // A card shop files these under a plan's category, which then sets that plan's minimum price.
  for (const [title, category] of [
    ['使用教程', 'GTP Plus中转'],
    ['codex橙皮书', 'GTP Plus中转'],
    ['🚀防封必看！G Plus土区稳定订阅保姆级教程，同步更新', '教程'],
    ['G·P·T Plus会员提取支付链接--GCash提链助手--含10个CDK', 'OpenAI PLUS 提链'],
    ['codex 破甲 破限', 'G Plus'],
    ['Gemini登陆教程（仅文字教程，不含账号）', '教程'],
  ] as const) assert.equal(withCategory(title, category).canonicalProductSlug, null, title);
  // A mailbox filed under a plan category is still the mailbox, not the plan.
  assert.equal(withCategory('iCloud邮箱母号', 'iCloud邮箱Plus成品号').canonicalProductSlug, 'resource-icloud');
  // Real deliveries keep their plan: a mirror site and a virtual-card top-up both sell Plus.
  assert.equal(withCategory('G PLUS 镜像站(天卡)', 'G PlUS 镜像').canonicalProductSlug, 'chatgpt-plus');
  assert.equal(withCategory('虚拟卡代充 plus 官方直充月卡 质保', 'G Plus').canonicalProductSlug, 'chatgpt-plus');
});

test('mentioning Plus as a capability or a negation does not make it a Plus offer', () => {
  assert.equal(classify('【G Free 成品号】未接马 | 账密 AT | 长效outlook | 不支持codex | 非plus').canonicalProductSlug, 'chatgpt-account');
  assert.equal(classify('iCloud/gmail邮箱 已开通2fa | 已注册G free | 可升级plus | cpa反代需绑卡').canonicalProductSlug, 'resource-gmail');
  assert.equal(classify('CDK 专用【子邮箱】iCloud 隐私邮箱 （开plus 绑定专用） 不会用不要下').canonicalProductSlug, 'resource-icloud');
  // The real Plus listings these sit next to keep their identity.
  assert.equal(classify('【未接马】PLUS成品号（icloud/gmail邮箱-家宽注册-质保首登）').canonicalProductSlug, 'chatgpt-plus');
  // 验证码 is the product when it is what is sold, an attribute when the account merely lacks it.
  assert.equal(classify('美国短效codex验证和手机号注册codex Codex手机验证码').canonicalProductSlug, 'resource-openai-verification');
  assert.equal(classify('Gplus成品号，未绑定手机验证码，纯邮箱注册，质保首登').canonicalProductSlug, 'chatgpt-plus');
});

test('a title that names its own plan outranks a category naming another', () => {
  const withCategory = (rawTitle: string, rawCategory: string) => classifyOffer({
    sourceItemId: 'test', rawTitle, rawCategory, price: '99', rawPriceText: '99', currency: 'CNY',
    stockState: 'in_stock', productUrl: 'https://example.com/item/1',
    capturedAt: new Date().toISOString(), rawPayloadHash: '1234567890abcdef',
  });
  // Shops file a Plus listing under a "Pro 20X" category; the category must not rename it.
  assert.equal(withCategory('【官方正规】G Plus 官方充值 【品质有保障】', 'OpenAI Pro 20X 充值').canonicalProductSlug, 'chatgpt-plus');
  assert.equal(withCategory('【官方代充】Codex Plus 月卡（源头代充）', 'G代充/20X Pro').canonicalProductSlug, 'chatgpt-plus');
  // A Free account filed under Plus/team is still a free account.
  assert.equal(withCategory('G Free-账密 RT-长效outlook-适合各类业务(可网页反代，除Codex)', '❤️Plus/team/K12').canonicalProductSlug, 'chatgpt-account');
  // Titles that do name the tier keep it.
  assert.equal(withCategory('G PRO 20x 1个月充值【官方卡充｜菲区｜质保掉订阅】', 'Codex 充值').canonicalProductSlug, 'chatgpt-pro-20x');
  assert.equal(withCategory('5x team 非轮转', 'Codex 成品').canonicalProductSlug, 'chatgpt-team');
  // A title with no plan of its own still defers to the category.
  assert.equal(withCategory('Cursor月卡--质保', 'Cursor Pro').canonicalProductSlug, 'cursor-pro');
  assert.equal(withCategory('perplexity-年卡-独享', 'Perplexity Pro').canonicalProductSlug, 'perplexity-pro');
});

test('a title saying only "account" is not more precise than a category naming the tier', () => {
  const withCategory = (rawTitle: string, rawCategory: string) => classifyOffer({
    sourceItemId: 'test', rawTitle, rawCategory, price: '99', rawPriceText: '99', currency: 'CNY',
    stockState: 'in_stock', productUrl: 'https://example.com/item/1',
    capturedAt: new Date().toISOString(), rawPayloadHash: '1234567890abcdef',
  });
  // "成品号" names no tier, so the category still decides which plan it is.
  assert.equal(withCategory('Gemini成品号12个月，6-8月份订阅的号。质保6小时首登', 'Gemini Pro会员').canonicalProductSlug, 'gemini-pro');
  assert.equal(withCategory('库存老号，只能登录网页，需要codex接🐴，成品号', 'G PLUS').canonicalProductSlug, 'chatgpt-plus');
  // A title calling itself free or 普号 does contradict the category, and wins.
  assert.equal(withCategory('G Free-账密 RT-长效outlook-适合各类业务(可网页反代，除Codex)', '❤️Plus/team/K12').canonicalProductSlug, 'chatgpt-account');
  assert.equal(withCategory('【groK 普号】【帐密+sso】成品｜域名邮箱】无保', 'super gro').canonicalProductSlug, 'grok-account');
  // A plan bundled in as a freebie is not what the listing sells.
  assert.equal(withCategory('【正规实付】X Premium 12个月 全程质保订阅（包含同时长Supergro Lite）', 'X 推特 Premium/P+').canonicalProductSlug, 'x-premium');
  // "Pro18个月" puts a digit after the tier; the tier still counts.
  assert.equal(withCategory('Gemini-Pro18个月全年激活-到自己账号', 'Gemini pro').canonicalProductSlug, 'gemini-pro');
});
