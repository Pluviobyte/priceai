import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkerConfig } from './config.js';

test('publication maintenance window defaults to 30s and can be disabled or bounded',()=>{
  assert.equal(readWorkerConfig({}).channelPublishCooldownMs,30_000);
  for(const value of ['', '-1','NaN','Infinity'])assert.equal(readWorkerConfig({CHANNEL_PUBLISH_COOLDOWN_MS:value}).channelPublishCooldownMs,30_000);
  assert.equal(readWorkerConfig({CHANNEL_PUBLISH_COOLDOWN_MS:'0'}).channelPublishCooldownMs,0);
  assert.equal(readWorkerConfig({CHANNEL_PUBLISH_COOLDOWN_MS:'15000'}).channelPublishCooldownMs,15_000);
  assert.equal(readWorkerConfig({CHANNEL_PUBLISH_COOLDOWN_MS:'9999999999'}).channelPublishCooldownMs,60_000);
});
