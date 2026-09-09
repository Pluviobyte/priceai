import assert from "node:assert/strict";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import { getChannelCatalog } from "../src/lib/channel-catalog";
import { activeChannelChips, catalogView, parseChannelFilters, channelHref, channelMoney } from "../src/lib/channel-filters";

test("filter URLs preserve constraints, reset pagination and reject unsupported input", () => {
  const filters = parseChannelFilters({ q: [" ChatGPT ", "ignored"], mode: "recharge", page: "4", stock: "available" });
  const next = new URL(channelHref(filters, { group: "expanded" }), "http://localhost");
  assert.equal(next.searchParams.get("q"), "ChatGPT");
  assert.equal(next.searchParams.get("stock"), "available");
  assert.equal(next.searchParams.get("mode"), "recharge");
  assert.equal(next.searchParams.get("group"), "expanded");
  assert.equal(next.searchParams.has("page"), false);
  assert.equal(parseChannelFilters({ page: "-2", mode: "api_credit", view: "bad", spec: "bad" }).view, "compare");
  assert.equal(parseChannelFilters({ page: "-2" }).page, 1);
  assert.equal(parseChannelFilters({ mode: "api_credit" }).mode, "");
  assert.match(channelMoney("0", "CNY"), /0/);
  assert.equal(channelMoney(null, "CNY"), "暂无可比价");
});

test("the two tabs and the display toggle are separate dimensions, and old view URLs still resolve", () => {
  const merged = parseChannelFilters({});
  assert.equal(merged.view, "compare");
  assert.equal(merged.group, "merged");
  assert.equal(catalogView(merged), "products");
  const expanded = parseChannelFilters({ group: "expanded" });
  assert.equal(catalogView(expanded), "offers");
  // Pre-split links stay valid: view=products|offers were the two zoom levels.
  assert.equal(catalogView(parseChannelFilters({ view: "offers" })), "offers");
  assert.equal(catalogView(parseChannelFilters({ view: "products" })), "products");
  assert.equal(catalogView(parseChannelFilters({ view: "merchants" })), "merchants");
  // The zoom level is meaningless on the merchant tab, so it never reaches the URL.
  const merchants = parseChannelFilters({ view: "merchants", group: "expanded" });
  assert.equal(new URL(channelHref(merchants), "http://localhost").searchParams.has("group"), false);
  assert.equal(parseChannelFilters({ view: "merchants", sort: "price" }).sort, "freshness");
});

test("every narrowing is offered back as a removable chip", () => {
  const filters = parseChannelFilters({ q: "plus", platform: "OpenAI", mode: "recharge", duration: "30", warranty: "none", currency: "CNY", stock: "available" });
  const chips = activeChannelChips(filters);
  assert.deepEqual(chips.map(chip => chip.key), ["q", "platform", "mode", "duration", "warranty", "currency", "stock"]);
  assert.deepEqual(chips.map(chip => chip.label), ["搜索“plus”", "ChatGPT", "自己账号代充", "30 天", "无质保", "CNY", "仅已确认有货"]);
  const withoutMode = new URL(chips[2]!.clearHref, "http://localhost").searchParams;
  assert.equal(withoutMode.has("mode"), false);
  assert.equal(withoutMode.get("q"), "plus", "clearing one chip keeps the others");
  assert.equal(activeChannelChips(parseChannelFilters({})).length, 0);
});

test("published channel catalog queries against PostgreSQL", { skip: !process.env.CHANNEL_TEST_DATABASE_URL }, async (t) => {
  const db = new Client({ connectionString: process.env.CHANNEL_TEST_DATABASE_URL });
  await db.connect();
  const read = async <Row extends QueryResultRow>(sql: string, values: readonly unknown[] = []): Promise<Row[]> => (await db.query<Row>(sql, [...values])).rows;
  try {
    // Session-local tables: tests never write application tables or publish fixtures.
    await db.query(`
      create temp table publication_channels(channel text,current_generation_id text);
      create temp table canonical_products(id text,slug text,display_name text,brand text,status text);
      create temp table sources(id text,merchant_id text,enabled boolean,health_status text,canonical_entry_url text);
      create temp table merchants(id text,slug text,name text,status text);
      create temp table raw_offer_snapshots(id text,raw_title text);
      create temp table offer_matches(id text,raw_offer_snapshot_id text);
      create temp table offer_attributes(offer_match_id text,duration_days int,region text,account_ownership text,warranty_type text,warranty_hours int);
      create temp table offers(id text,canonical_product_id text,source_id text,latest_raw_snapshot_id text,
        offer_mode text,currency text,price numeric,stock_state text,stock_count int,offer_verified_at timestamptz,
        availability_state text,risk_facts jsonb,publish_generation_id text);
      insert into publication_channels values ('card_prices','live');
      insert into canonical_products values ('p1','chatgpt-plus','ChatGPT Plus','OpenAI','active'),('p2','claude-pro','Claude Pro','Anthropic','active');
      insert into merchants values ('m1','shop-a','卡网 A','active'),('m2','shop-b','卡网 B','active');
      insert into sources values ('s1','m1',true,'healthy','https://shop-a.example/shop/A'),('s2','m2',true,'healthy','https://shop-b.example/shop/B'),('disabled','m1',false,'healthy','https://shop-a.example/shop/X');
    `);
    async function offer(id: string, price: number, options: { days?: number | null; currency?: string; stock?: string; hours?: number; state?: string; source?: string; mode?: string; warranty?: string; region?: string; count?: number; product?: string } = {}) {
      await db.query("insert into raw_offer_snapshots values ($1,$2)", [id, `${id} 原始商品`]);
      await db.query("insert into offer_matches values ($1,$1)", [id]);
      await db.query("insert into offer_attributes values ($1,$2,$3,'buyer',$4,null)", [id, options.days === undefined ? 30 : options.days, options.region ?? "HK", options.warranty ?? "subscription_period"]);
      await db.query(`insert into offers values ($1,$2,$3,$1,$4,$5,$6,$7,$8,now()-($9::text||' hours')::interval,$10,'[]','live')`,
        [id, options.product ?? "p1", options.source ?? "s1", options.mode ?? "recharge", options.currency ?? "CNY", price, options.stock ?? "in_stock", options.count ?? 10, options.hours ?? 1, options.state ?? "purchasable"]);
    }
    await offer("normal", 100);
    await offer("cheap", 80, { source: "s2" });
    await offer("stale", 1, { hours: 25 });
    await offer("unknown", 2, { stock: "unknown" });
    await offer("sold", 3, { stock: "out_of_stock", state: "unavailable" });
    await offer("year", 50, { days: 365 });
    await offer("usd", 5, { currency: "USD" });
    await offer("no-duration", 4, { days: null });
    await offer("quarantined", 1, { state: "quarantined" });
    await offer("disabled", 1, { source: "disabled" });
    await offer("api", 1, { mode: "api_credit" });
    await offer("region", 90, { region: "US" });
    await offer("no-warranty", 70, { warranty: "none" });
    await offer("zero-stock", 6, { count: 0 });
    await offer("claude", 40, { product: "p2" });

    await t.test("minimum excludes stale, unknown, sold-out, zero-stock and quarantined prices", async () => {
      const data = await getChannelCatalog(parseChannelFilters({}), read);
      const row = data.rows.find(row => row.product_slug === "chatgpt-plus" && row.duration_days === 30 && row.currency === "CNY" && row.region === "HK" && row.warranty_type === "subscription_period");
      assert.equal(Number(row?.price), 80);
      assert.equal(row?.available_count, 2);
      assert.equal(row?.merchant_count, 2);
      assert.equal(data.offerCount, 12);
      assert.equal(data.rows.find(row => row.duration_days === null)?.price, null);
    });
    await t.test("specification drill-down returns only the exact group", async () => {
      const groups = await getChannelCatalog(parseChannelFilters({ duration: "365" }), read);
      assert.equal(groups.total, 1);
      const exact = await getChannelCatalog(parseChannelFilters({ group: "expanded", spec: groups.rows[0]!.spec_key }), read);
      assert.equal(exact.total, 1);
      assert.equal(exact.rows[0]?.id, "year");
      // The lock must be describable, otherwise the reader cannot see what holds them.
      assert.equal(exact.spec?.product_name, "ChatGPT Plus");
      assert.equal(exact.spec?.duration_days, 365);
      assert.equal(exact.spec?.currency, "CNY");
      // It resolves on the merchant tab too, where rows carry no specification fields.
      const merchants = await getChannelCatalog(parseChannelFilters({ view: "merchants", spec: groups.rows[0]!.spec_key }), read);
      assert.equal(merchants.spec?.duration_days, 365);
      assert.equal(merchants.total, 1);
    });
    await t.test("combined filters, currencies and merchant search work", async () => {
      const data = await getChannelCatalog(parseChannelFilters({ view: "offers", platform: "OpenAI", mode: "recharge", duration: "30", stock: "available", currency: "CNY", warranty: "subscription_period", q: "卡网 B" }), read);
      assert.equal(data.total, 1);
      assert.equal(data.rows[0]?.id, "cheap");
      const noWildcard = await getChannelCatalog(parseChannelFilters({ q: "%" }), read);
      assert.equal(noWildcard.total, 0);
    });
    await t.test("merchant view aggregates distinct merchants", async () => {
      const data = await getChannelCatalog(parseChannelFilters({ view: "merchants" }), read);
      assert.equal(data.total, 2);
      assert.equal(data.rows.find(row => row.merchant_slug === "shop-b")?.offer_count, 1);
      // Same-named shops must stay distinguishable, so the entry host travels with the row.
      assert.equal(data.rows.find(row => row.merchant_slug === "shop-b")?.merchant_host, "https://shop-b.example/shop/B");
    });
    await t.test("pagination clamps out-of-range pages and preserves zero prices", async () => {
      for (let i = 0; i < 30; i++) await offer(`extra-${i}`, i);
      const data = await getChannelCatalog(parseChannelFilters({ view: "offers", page: "999" }), read);
      assert.equal(data.total, 42);
      assert.equal(data.page, 2);
      assert.equal(data.rows.length, 18);
      const cheapest = await getChannelCatalog(parseChannelFilters({ view: "offers", stock: "available", currency: "CNY", sort: "price" }), read);
      assert.equal(Number(cheapest.rows[0]?.price), 0);
    });
  } finally { await db.end(); }
});
