import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { createDatabase } from "@price-radar/database";
import { hostThrottle } from "@price-radar/collector-sdk";
import { sql } from "drizzle-orm";
import { readDiscoveryHealth } from "./discovery-health.js";
import { mineCrawledCatalogLinks } from "./discovery-links.js";
import { telegramSeedHandles } from "./discovery-telegram.js";
import { boundedDiscoveryRead, runScheduledDiscovery } from "./discovery-schedule.js";
import { DISCOVERY_OWNERSHIP, DiscoveryHttpError } from "./discovery-policy.js";
import { discoverGithubTopicReadmes } from "./discovery-github.js";
import { discoverTelegramChannels } from "./discovery-telegram.js";
import { importSourceDirectories } from "./discovery-directories.js";
import { enumerate16688SourceMarketplace } from "./discovery-platforms.js";

const adminUrl = process.env.POLICY_TEST_DATABASE_URL;
const day = 24 * 60 * 60 * 1000;

test("16688 discovery persists failure cooldown and recovers when the public list returns", { skip: !adminUrl }, async t => {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const name = `price_discovery_test_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`create database "${name}"`);
  const url = new URL(adminUrl!); url.pathname = `/${name}`;
  let handle = createDatabase(url.toString());
  const fixture = new pg.Client({ connectionString: url.toString() });
  await fixture.connect();
  try {
    // Only discovery metadata is needed: no production data or external requests.
    await fixture.query(`create table discovery_runs (
      id uuid primary key default gen_random_uuid(), kind text not null, query text not null,
      provider text not null, status text not null default 'running', result_count integer not null default 0,
      candidate_count integer not null default 0, evidence jsonb not null default '{}', error_message text,
      started_at timestamptz not null default now(), finished_at timestamptz)`);
    await t.test("directory 429 cannot retry on each maintenance tick", async () => {
      let calls = 0;
      const providers = [{ id: "priceai_merchants", label: "test", homepage: "https://priceai.cc/channels", async fetchLeads() { calls++; throw new Error("directory_http_429:priceai.cc"); } }];
      await importSourceDirectories(handle.db, { providers, minIntervalMs: day });
      await handle.close(); handle = createDatabase(url.toString());
      const result = await importSourceDirectories(handle.db, { providers, minIntervalMs: day });
      assert.equal(calls, 1, "429 must survive a process restart and block the next maintenance tick");
      assert.equal(result[0]?.status, "deferred");
      await fixture.query("delete from discovery_runs");
    });
    await t.test("provider lock prevents overlapping CLI runs and cleans only owned orphan records", async () => {
      const input = {kind:"directory" as const,provider:"lock_test",query:"test"};
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>(resolve => {started=resolve;});
      const blocked = new Promise<void>(resolve => {release=resolve;});
      const first = runScheduledDiscovery(handle.db,input,{},async()=>{started();await blocked;return [];});
      await entered;
      try {
        const other = await runScheduledDiscovery(handle.db,input,{},async()=>{throw new Error("duplicate work");});
        assert.equal(other.status,"deferred");
        assert.equal((await fixture.query("select status from discovery_runs where provider='lock_test'")).rows[0].status,"running");
      } finally {release();await first;}
      await fixture.query("delete from discovery_runs");
      await fixture.query("insert into discovery_runs(kind,query,provider,evidence,started_at) values('directory','test','lock_test',$1,now()-interval '1 hour'),('directory','test','lock_test','{}',now()-interval '2 hours')",[JSON.stringify({ownership:DISCOVERY_OWNERSHIP})]);
      const orphan = await runScheduledDiscovery(handle.db,input,{},async()=>{throw new Error("must wait after interrupted owner");});
      assert.equal(orphan.status,"deferred");
      const rows=(await fixture.query("select status,evidence from discovery_runs order by started_at desc")).rows;
      assert.equal(rows[0].status,"failed");assert.equal(rows[1].status,"running");
      await fixture.query("delete from discovery_runs");
    });
    await t.test("GitHub and Telegram HTTP errors persist as failures with Retry-After", async () => {
      t.mock.method(hostThrottle, "run", async (_host:string,work:()=>Promise<unknown>)=>work());
      let calls=0;
      t.mock.method(globalThis,"fetch",async()=>{calls++;return new Response("busy",{status:429,headers:{"retry-after":"172800"}});});
      await assert.rejects(discoverGithubTopicReadmes(handle.db,{topics:["chatgpt-plus"]}),/github_http_429/);
      await assert.rejects(discoverTelegramChannels(handle.db,{seedHandles:["examplechannel"]}),/telegram_http_429/);
      assert.equal(calls,2);
      await handle.close(); handle=createDatabase(url.toString());
      assert.equal((await discoverGithubTopicReadmes(handle.db)).status,"deferred");
      assert.equal(calls,2);
      const rows=(await fixture.query("select status,evidence,finished_at from discovery_runs")).rows;
      assert.equal(rows.length,2);
      for(const row of rows){assert.equal(row.status,"failed");assert.ok(Date.parse(row.evidence.retryAt)-+new Date(row.finished_at)>day);}
      t.mock.restoreAll();await fixture.query("delete from discovery_runs");
    });
    await t.test("bounded catalog queries and monitoring use real read-only PostgreSQL transactions", async () => {
      await fixture.query(`create table sources(id uuid, enabled boolean, latest_complete_run_id uuid, canonical_entry_url text);
        create table raw_offer_snapshots(crawl_run_id uuid, product_url text, raw_description text);
        create table merchants(id uuid, contact_public jsonb)`);
      assert.deepEqual(await telegramSeedHandles(handle.db),[]);
      assert.equal((await mineCrawledCatalogLinks(handle.db)).status,"success");
      const health=await readDiscoveryHealth(handle.db,[{provider:"crawled_catalog_links",kind:"crawl",enabled:true,intervalMs:day}],new Date(0));
      assert.equal(health.healthy,true); assert.equal(health.providers[0]?.state,"skipped");
      await assert.rejects(boundedDiscoveryRead(handle.db,readDb=>readDb.execute(sql`delete from discovery_runs`)), /read-only|Failed query/);
      assert.equal((await fixture.query("select count(*)::int n from discovery_runs")).rows[0].n,1);
      await fixture.query("delete from discovery_runs");
    });
    let calls = 0;
    let mode: "disabled" | "network" | "other-rejection" | "open" = "disabled";
    t.mock.method(hostThrottle, "run", async (_host: string, work: () => Promise<unknown>) => work());
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
      calls++;
      if (mode === "network") throw new TypeError("fetch failed");
      const path = new URL(input instanceof Request ? input.url : input).pathname;
      if (path === "/index/SourceCategory/tree") return Response.json({ code: 1, data: { list: [{ id: 1, name: "AI与效率" }] } });
      assert.equal(path, "/index/SourceGoods/list");
      if (mode === "other-rejection") return Response.json({ code: 0, msg: "invalid request" });
      return Response.json(mode === "disabled"
        ? { code: 0, msg: "未开启货源商品列表", data: null }
        : { code: 1, data: { list: [], total: 0 } });
    });
    const options = { minIntervalMs: day };
    const first = await enumerate16688SourceMarketplace(handle.db, options);
    assert.equal(first.status, "unavailable", "a disabled public list must not fail the whole maintenance task");
    assert.equal(calls, 2);
    const failed = (await fixture.query("select * from discovery_runs")).rows;
    assert.equal(failed.length, 1);
    assert.equal(failed[0].status, "failed", "unavailable must not be recorded as successful discovery");
    assert.match(failed[0].error_message, /未开启货源商品列表/);

    // A fresh pool simulates a worker restart: cooldown must survive in PostgreSQL.
    await handle.close(); handle = createDatabase(url.toString());
    const finished = new Date(failed[0].finished_at);
    for (const minutes of [1, 2, 60]) {
      const result = await enumerate16688SourceMarketplace(handle.db, { ...options, now: new Date(finished.getTime() + minutes * 60_000) });
      assert.equal(result.status, "deferred");
    }
    assert.equal(calls, 2, "maintenance ticks must not repeat disabled marketplace requests");
    assert.equal((await fixture.query("select count(*)::int n from discovery_runs")).rows[0].n, 1);

    mode = "open";
    const recovered = await enumerate16688SourceMarketplace(handle.db, { ...options, now: new Date(finished.getTime() + day + 1) });
    assert.equal(recovered.status, "success");
    assert.equal(calls, 4);
    assert.equal((await enumerate16688SourceMarketplace(handle.db, options)).status, "skipped");
    assert.equal(calls, 4);

    // A transient transport error keeps its error signal, but is not retried every minute.
    await fixture.query("delete from discovery_runs");
    mode = "network";
    await assert.rejects(enumerate16688SourceMarketplace(handle.db, options), /fetch failed/);
    const networkEnd = new Date((await fixture.query("select finished_at from discovery_runs")).rows[0].finished_at);
    assert.equal((await enumerate16688SourceMarketplace(handle.db, { ...options, now: new Date(networkEnd.getTime() + 60_000) })).status, "deferred");
    assert.equal(calls, 5);
    mode = "open";
    assert.equal((await enumerate16688SourceMarketplace(handle.db, { ...options, now: new Date(networkEnd.getTime() + 15 * 60_000 + 1) })).status, "success");
    assert.equal(calls, 7);

    // Explicit CLI can refresh a successful run, but cannot override a failure cooldown.
    mode = "other-rejection";
    await assert.rejects(enumerate16688SourceMarketplace(handle.db), /16688_marketplace_rejected:invalid request/);
    assert.equal(calls, 9);
    const recentFailure = new Date((await fixture.query("select max(finished_at) at from discovery_runs")).rows[0].at);
    assert.equal((await enumerate16688SourceMarketplace(handle.db, { ...options, now: new Date(recentFailure.getTime() + 60_000) })).status, "deferred");
    assert.equal(calls, 9, "a recent failure takes precedence over an older successful attempt");
    mode = "open";
    assert.equal((await enumerate16688SourceMarketplace(handle.db)).status, "deferred");
    assert.equal(calls, 9);
  } finally {
    t.mock.restoreAll();
    await handle.close();
    await fixture.end();
    await admin.query(`drop database "${name}"`);
    await admin.end();
  }
});
