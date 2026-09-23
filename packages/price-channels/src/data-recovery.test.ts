import assert from 'node:assert/strict';
import test from 'node:test';
import { extractClaudePlanPrice } from './storefront-parser.js';
import { seedVerificationDate } from './official-api.js';
import { numberOrNull } from './transit.js';

test('Claude help prices require explicit plan, USD and period', () => {
  assert.equal(extractClaudePlanPrice('<p>The Pro plan is available for <b>$20</b> per month (US), with pricing in your local currency where supported.</p>', 'claude-pro-monthly'), 20);
  const max = '<p>Max 5x : <b>$100 per month</b></p><p>Max 20x : $200 per month</p><p>Note: These prices are for web subscriptions only.</p>';
  assert.equal(extractClaudePlanPrice(max, 'claude-max-5x-monthly'), 100);
  assert.equal(extractClaudePlanPrice(max, 'claude-max-20x-monthly'), 200);
  assert.equal(extractClaudePlanPrice(max.replace('$100', 'From $100'), 'claude-max-5x-monthly'), null);
  assert.equal(extractClaudePlanPrice(max.replaceAll('per month', 'per year'), 'claude-max-20x-monthly'), null);
  assert.equal(extractClaudePlanPrice(max.replace('web subscriptions', 'mobile subscriptions'), 'claude-max-20x-monthly'), null);
});
test('annual total is not the discounted monthly equivalent', () => {
  const html = '<p data-plan="pro_annual" data-plan-field="amount_per_month">$17</p><p>Per month with annual subscription discount (<span data-plan="pro_annual" data-plan-field="amount_total">$200</span> billed up front).</p>';
  assert.equal(extractClaudePlanPrice(html, 'claude-pro-annual'), 200);
  assert.equal(extractClaudePlanPrice(html, 'claude-pro-monthly'), null);
  assert.equal(extractClaudePlanPrice(html.replace('billed up front', 'per month'), 'claude-pro-annual'), null);
});
test('document publication dates are not verification dates', () => {
  assert.equal(seedVerificationDate('verified-2026-09-03')?.toISOString(), '2026-09-03T00:00:00.000Z');
  for (const value of [undefined, 'updated-2026-07-09', 'effective-2026-09-01', 'verified-2026-02-30']) assert.equal(seedVerificationDate(value), null);
});
test('missing or invalid transit prices never become free prices', () => {
  for (const value of [null, undefined, '', ' ', false, [], -1, '-1', 'varies_by_provider', Infinity]) assert.equal(numberOrNull(value), null);
  assert.equal(numberOrNull('0'), 0);
  assert.equal(numberOrNull('0.0000003'), 0.0000003);
});
