import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDiscoveryHealth } from "./discovery-health.js";
const now=new Date("2026-09-20T12:00:00Z"), started=new Date(+now-3600_000);
const schedule={provider:"test",kind:"directory",enabled:true,intervalMs:86_400_000};
const empty={attempts:[],lastSuccessAt:null,attemptsHour:0,attemptsDay:0};
test("monitor distinguishes paused, never-run, historical rate and ongoing runaway",()=>{
  assert.deepEqual(evaluateDiscoveryHealth({...schedule,enabled:false},empty,now,started).issues,[]);
  assert.ok(evaluateDiscoveryHealth(schedule,empty,now,started).issues.includes("never_run"));
  assert.ok(evaluateDiscoveryHealth(schedule,{...empty,attemptsHour:43},now,started).issues.includes("attempt_rate_excessive"));
  assert.ok(evaluateDiscoveryHealth(schedule,{...empty,attemptsDay:1031},now,started).warnings.includes("attempts_24h_excessive"));
});
test("monitor recognizes cooldown, overdue scheduler and sustained failure separately",()=>{
  const failed={status:"failed",startedAt:new Date(+now-10_000),finishedAt:new Date(+now-5_000),errorMessage:"directory_http_429:test",evidence:{}};
  const recent={...empty,attempts:[failed]};
  assert.deepEqual(evaluateDiscoveryHealth(schedule,recent,now,started).issues,[]);
  assert.ok(evaluateDiscoveryHealth(schedule,{...recent,attempts:[failed,failed,failed]},now,started).issues.includes("persistent_failure"));
  const old=new Date(+now-2*86_400_000);
  assert.ok(evaluateDiscoveryHealth(schedule,{...empty,attempts:[{...failed,status:"success",finishedAt:old,startedAt:old}],lastSuccessAt:old},now,started).issues.includes("scheduler_overdue"));
});
