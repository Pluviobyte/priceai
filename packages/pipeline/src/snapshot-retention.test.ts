import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogContentHash, offerContentHash } from './publication-content.js';
import { planSnapshotRetention, type RetentionGeneration } from './snapshot-retention.js';

const now=new Date('2026-09-16T12:00:00Z');
const policy={denseHours:12,checkpointDays:7,maxRetainedRows:1000};
function gen(id:string, ageHours:number, previous:string|null=null, extra:Partial<RetentionGeneration>={}):RetentionGeneration {
  return {id,channel:'card_prices',previous_generation_id:previous,status:'superseded',snapshot_state:'retained',snapshot_pinned:false,
    generated_at:new Date(now.getTime()-ageHours*3600000),offer_count:100,...extra};
}
test('content fingerprint is order independent and distinguishes business changes',()=>{
  const a=offerContentHash({price:'10.000000',freshness:'fresh',attributes:{a:1,b:2}});
  assert.equal(a,offerContentHash({attributes:{b:2,a:1},freshness:'fresh',price:'10.000000'}));
  const b=offerContentHash({price:'10.000000',freshness:'stale',attributes:{a:1,b:2}});
  assert.notEqual(a,b);
  assert.equal(catalogContentHash([a,b]),catalogContentHash([b,a]));
  assert.notEqual(catalogContentHash([a]),catalogContentHash([a,b]));
});
test('protects pointers, pins, recent versions and daily checkpoints with one predecessor',()=>{
  const rows=[gen('live',0,'recent',{status:'published'}),gen('recent',2,'checkpoint'),gen('checkpoint',26,'comparison'),
    gen('comparison',27,'old'),gen('old',28),gen('pin',300,null,{snapshot_pinned:true}),gen('expired',300)];
  const result=planSnapshotRetention(rows,[{channel:'card_prices',current_generation_id:'live',previous_generation_id:'recent'}],policy,now);
  assert.deepEqual(result.candidates.map(g=>g.id),['expired','old']);
  assert.equal(result.retained.find(g=>g.id==='comparison')?.reason,'comparison_predecessor');
});
test('unknown legacy branches are protected, reachable legacy history can be pruned',()=>{
  const rows=[gen('live',0,'old',{status:'published'}),gen('old',300,'older',{channel:null}),gen('older',301,null,{channel:null}),gen('unknown',300,null,{channel:null})];
  const result=planSnapshotRetention(rows,[{channel:'card_prices',current_generation_id:'live',previous_generation_id:'old'}],policy,now);
  assert.equal(result.retained.find(g=>g.id==='unknown')?.reason,'unknown_channel');
  assert.ok(!result.candidates.some(g=>g.id==='old'));
  assert.ok(!result.candidates.some(g=>g.id==='older')); // comparison predecessor of live previous pointer
});
test('budget overflow reports a conflict instead of deleting required coverage',()=>{
  const result=planSnapshotRetention([gen('live',0),gen('recent',1)],[],{...policy,maxRetainedRows:1},now);
  assert.equal(result.budgetExceeded,true);assert.equal(result.candidates.length,0);
});
test('a pruning generation resumes, and a completed one is not selected again',()=>{
  const result=planSnapshotRetention([gen('partial',300,null,{snapshot_state:'pruning'}),gen('done',301,null,{snapshot_state:'pruned'})],[],policy,now);
  assert.deepEqual(result.candidates.map(g=>g.id),['partial']);
});
test('ambiguous cross-channel ancestry fails closed',()=>{
  const rows=[gen('a',0,'old'),gen('b',0,'old',{channel:'other'}),gen('old',300,null,{channel:null})];
  const result=planSnapshotRetention(rows,[],policy,now);
  assert.ok(!result.candidates.some(g=>g.id==='old'));
});
