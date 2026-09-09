import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOffer } from './index.js';
const classify = (rawTitle: string) => classifyOffer({sourceItemId:'test',rawTitle,price:'99',rawPriceText:'99',currency:'CNY',stockState:'in_stock',productUrl:'https://example.com/item/1',capturedAt:new Date().toISOString(),rawPayloadHash:'1234567890abcdef'});
test('real merchant spelling variants retain explicit plan identity', () => {
  for (const [title,slug] of [['GPT-Plus 年订阅','chatgpt-plus'],['GPT 一个月 Plus代充（卡付）','chatgpt-plus'],['Claude 5x（正价卡付 质保）','claude-max-5x'],['Claude 20x（正价卡付 质保）','claude-max-20x'],['ChatGPT Pro20X成品','chatgpt-pro']]) assert.equal(classify(title!).canonicalProductSlug,slug,title!);
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
