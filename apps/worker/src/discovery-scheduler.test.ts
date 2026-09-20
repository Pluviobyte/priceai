import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@price-radar/database";
import { readWorkerConfig } from "./config.js";
import { discoveryProviders, runDiscoveryLoop, runDiscoveryPass } from "./discovery-scheduler.js";

test("continuous discovery revisits all providers without overlap; one failure does not stop later channels", async () => {
  const calls: string[] = [];
  let active=0, maximum=0, rounds=0;
  const config=readWorkerConfig({});
  const providers = Object.fromEntries(Object.keys(discoveryProviders).map(name => [name, async (_db:unknown, options:{minIntervalMs?:number}) => {
    active++; maximum=Math.max(maximum,active); calls.push(name);
    try {
      assert.equal(options.minIntervalMs, name==='discoverGithubTopicReadmes' ? config.autonomousDiscoveryIntervalMs*7 : config.sourceDirectoryImportIntervalMs);
      await Promise.resolve();
      if(name==='enumerate16688SourceMarketplace')throw new Error('upstream failed');
      return name==='importSourceDirectories'?[]:{status:'skipped'};
    } finally {active--;}
  }])) as unknown as typeof discoveryProviders;
  const controller=new AbortController();
  await runDiscoveryLoop(()=>runDiscoveryPass({} as Database,config,{signal:controller.signal},providers),controller.signal,error=>{throw error;},async()=>{if(++rounds===3)controller.abort();});
  assert.equal(maximum,1);
  for(const name of Object.keys(providers))assert.equal(calls.filter(item=>item===name).length,3,name);
});

test("disabled discovery makes no provider calls and shutdown aborts the wait", async () => {
  const config=readWorkerConfig({SOURCE_DISCOVERY_ENABLED:'false'});
  const providers=new Proxy(discoveryProviders,{get(){return ()=>{throw new Error('must not run');};}});
  await runDiscoveryPass({} as Database,config,{},providers);
  const controller=new AbortController();
  await runDiscoveryLoop(async()=>controller.abort(),controller.signal,error=>{throw error;});
});
