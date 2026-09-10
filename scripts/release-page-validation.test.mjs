import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReleasePage } from './release-page-validation.mjs';

test('accepts a catalog heading with layout markup and React comments', () => {
  for (const title of ['选对交付方式，再比较价格', '选对交付方式，<br/>再比较价格', '选对交付方式，<!-- -->\n<br /><span>再比较价格</span>']) {
    assert.doesNotThrow(() => validateReleasePage('/channels', `<h1 class="title">${title}</h1>`));
  }
  assert.doesNotThrow(() => validateReleasePage('/channels?view=merchants', '<h1>卡网商家，一览再比较</h1>'));
});

test('rejects missing/wrong headings and catalog failure even when text occurs elsewhere', () => {
  for (const html of ['<p>选对交付方式，再比较价格</p>', '<h1>其他页面</h1>', '<h1>选对交付方式，<br/>再比较价格</h1><h2>暂时无法读取渠道报价</h2>']) {
    assert.throws(() => validateReleasePage('/channels', html), /catalog did not load/);
  }
  assert.throws(() => validateReleasePage('/channels?view=merchants', '<h1>选对交付方式，再比较价格</h1>'), /catalog did not load/);
});
