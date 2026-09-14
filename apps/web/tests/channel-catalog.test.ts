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
  assert.equal(parseChannelFilters({ mode: "api_credit" }).mode, "api_credit");
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

test("merchant layouts and compatible links preserve filters and pagination", () => {
  const filters = parseChannelFilters({ scope: "merchants", layout: "table", q: "shop.example", sort: "low_price", page: "2" });
  assert.equal(filters.view, "merchants");
  assert.equal(filters.layout, "table");
  assert.equal(filters.sort, "low_price");
  const next = new URL(channelHref(filters, { page: 3 }), "http://localhost");
  assert.equal(next.searchParams.get("layout"), "table");
  assert.equal(next.searchParams.get("q"), "shop.example");
  assert.equal(next.searchParams.get("page"), "3");
  const compare = new URL(channelHref(filters, { view: "compare" }), "http://localhost");
  assert.equal(compare.searchParams.has("sort"), false);
  assert.equal(compare.searchParams.has("layout"), false);
  assert.equal(parseChannelFilters({ layout: "invalid" }).layout, "cards");
  assert.equal(parseChannelFilters({ view: "compare", scope: "merchants" }).view, "compare");
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
  assert.equal(activeChannelChips(parseChannelFilters({ catalog: "accounts" }))[0]?.label, "未定档账号");
  assert.equal(parseChannelFilters({ catalog: "accounts" }).catalog, "accounts");
  // A category is a shopper's question, not a brand: it is offered back as its own chip.
  assert.equal(activeChannelChips(parseChannelFilters({ category: "verification" }))[0]?.label, "接码");
  assert.equal(parseChannelFilters({ category: "mail" }).category, "mail");
  assert.equal(parseChannelFilters({ category: "nonsense" }).category, "");
  assert.equal(activeChannelChips(parseChannelFilters({ category: "video" }))[0]?.label, "视频生成");
  const byCategory = new URL(channelHref(parseChannelFilters({ q: "plus" }), { category: "mail" }), "http://localhost").searchParams;
  assert.equal(byCategory.get("category"), "mail", "the category strip keeps the rest of the narrowing");
  assert.equal(byCategory.get("q"), "plus");
  assert.equal(new URL(channelHref(parseChannelFilters({ category: "mail" }), { category: "" }), "http://localhost").searchParams.has("category"), false);
});

test("published channel catalog queries against PostgreSQL", { skip: !process.env.CHANNEL_TEST_DATABASE_URL }, async (t) => {
  const db = new Client({ connectionString: process.env.CHANNEL_TEST_DATABASE_URL });
  await db.connect();
  const read = async <Row extends QueryResultRow>(sql: string, values: readonly unknown[] = []): Promise<Row[]> => (await db.query<Row>(sql, [...values])).rows;
  try {
    // Session-local tables: tests never write application tables or publish fixtures.
    await db.query(`
      create temp table publication_channels(channel text,current_generation_id text);
      create temp table canonical_products(id text,slug text,display_name text,brand text,status text,category text);
      create temp table sources(id text,merchant_id text,enabled boolean,health_status text,canonical_entry_url text);
      create temp table merchants(id text,slug text,name text,status text);
      create temp table raw_offer_snapshots(id text,raw_title text);
      create temp table offer_matches(id text,raw_offer_snapshot_id text);
      create temp table offer_attributes(offer_match_id text,duration_days int,region text,account_ownership text,warranty_type text,warranty_hours int);
      create temp table offers(id text,canonical_product_id text,source_id text,latest_raw_snapshot_id text,
        offer_mode text,currency text,price numeric,stock_state text,stock_count int,offer_verified_at timestamptz,
        availability_state text,risk_facts jsonb,publish_generation_id text);
      insert into publication_channels values ('card_prices','live');
      insert into canonical_products values ('p1','chatgpt-plus','ChatGPT Plus','OpenAI','active','chatgpt'),('p2','claude-pro','Claude Pro','Anthropic','active','claude');
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
      // One row per product and currency, carrying the specification that produced the minimum.
      const row = data.rows.find(row => row.product_slug === "chatgpt-plus" && row.currency === "CNY");
      assert.equal(Number(row?.price), 50, 'the cheapest comparable offer wins, whatever its term');
      assert.equal(row?.duration_days, 365, 'and the row states the term that price belongs to');
      // An API-credit offer belongs to the catalogue of the product it is sold for, not
      // to 周边; it is counted with its product and still cannot set the minimum.
      assert.equal(row?.available_count, 7);
      assert.equal(row?.merchant_count, 2);
      assert.equal(data.offerCount, 13);
      // A foreign-currency offer is its own row and is never judged against yuan prices.
      assert.equal(Number(data.rows.find(row => row.product_slug === "chatgpt-plus" && row.currency === "USD")?.price), 5);
      // The warranty minimum, the out-of-stock tally and the shop behind the lowest price.
      assert.equal(Number(row?.warranty_price), 50, 'warranty minimum ignores offers without one');
      assert.equal(row?.unavailable_count, 4, 'stale, unknown-stock, sold-out and zero-stock offers all count as unavailable');
      assert.equal(row?.lowest_merchant_name, '卡网 A', 'the lowest price is traceable to its shop');
      assert.match(String(row?.lowest_raw_title), /^year/, 'and to the shop\'s own wording');
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
    await t.test("merchant scores use fresh comparable specs and keep competitors during search", async () => {
      const all = await getChannelCatalog(parseChannelFilters({ view: "merchants", sort: "low_price" }), read);
      assert.equal(all.rows[0]?.merchant_slug, "shop-b");
      const a = all.rows.find(row => row.merchant_slug === "shop-a")!;
      assert.equal(a.comparable_count, 1, "unique currency, duration, region and warranty groups are not competitive");
      assert.equal(a.lowest_count, 0, "stale, unknown and zero-stock cheap offers cannot win");
      assert.equal(a.top_five_count, 1);
      assert.deepEqual(a.merchant_platforms, ["Anthropic", "OpenAI"]);
      assert.deepEqual(a.merchant_products, ["ChatGPT Plus", "Claude Pro"]);
      const searched = await getChannelCatalog(parseChannelFilters({ view: "merchants", q: "shop-a.example" }), read);
      assert.equal(searched.total, 1);
      assert.equal(searched.rows[0]?.lowest_count, 0, "search must not remove competitors");
      assert.equal(searched.rows[0]?.comparable_count, 1);
      const unique = await getChannelCatalog(parseChannelFilters({ view: "merchants", duration: "365" }), read);
      assert.equal(unique.rows[0]?.comparable_count, 0);
      await offer("tied", 80);
      await offer("duplicate", 80);
      const tied = await getChannelCatalog(parseChannelFilters({ view: "merchants" }), read);
      assert.equal(tied.rows.find(row => row.merchant_slug === "shop-a")?.lowest_count, 1, "duplicates count once and tied prices both win");
      assert.equal(tied.rows.find(row => row.merchant_slug === "shop-b")?.lowest_count, 1);
      await db.query("delete from offers where id in ('tied','duplicate')");
    });
    await t.test("summary and merchant page share one query, including empty pages", async () => {
      let queries = 0;
      const counted = async <Row extends QueryResultRow>(sql: string, values: readonly unknown[] = []) => {
        queries++;
        return read<Row>(sql, values);
      };
      const merchants = await getChannelCatalog(parseChannelFilters({ view: "merchants" }), counted);
      assert.equal(queries, 1);
      assert.ok(merchants.rows.length > 0);
      assert.ok(merchants.rows[0]?.verified_at instanceof Date);
      queries = 0;
      const empty = await getChannelCatalog(parseChannelFilters({ q: "no-matching-shop-xyz", page: "99" }), counted);
      assert.equal(queries, 1);
      assert.equal(empty.total, 0);
      assert.equal(empty.page, 1);
      assert.deepEqual(empty.rows, []);
    });
    await t.test("pagination clamps out-of-range pages and preserves zero prices", async () => {
      for (let i = 0; i < 30; i++) await offer(`extra-${i}`, i);
      const data = await getChannelCatalog(parseChannelFilters({ view: "offers", page: "999" }), read);
      assert.equal(data.total, 43);
      assert.equal(data.pageSize, 20);
      assert.equal(data.page, 3);
      assert.equal(data.rows.length, 3);
      const first = await getChannelCatalog(parseChannelFilters({ view: "offers" }), read);
      const second = await getChannelCatalog(parseChannelFilters({ view: "offers", page: "2" }), read);
      assert.equal(first.rows.length, 20);
      assert.equal(second.rows.length, 20);
      assert.equal(second.rows.some(row => first.rows.some(other => other.id === row.id)), false);
      for (const pageSize of ["50", "100"]) {
        const larger = await getChannelCatalog(parseChannelFilters({ view: "offers", page: "999", pageSize }), read);
        assert.equal(larger.pageSize, Number(pageSize));
        assert.equal(larger.page, 1);
        assert.equal(larger.rows.length, 43);
      }
      const cheapest = await getChannelCatalog(parseChannelFilters({ view: "offers", stock: "available", currency: "CNY", sort: "price" }), read);
      assert.equal(Number(cheapest.rows[0]?.price), 0);
    });
    await t.test("resources stay separate and unknown delivery cannot set a minimum", async () => {
      await db.query("insert into canonical_products values ('pr','resource-gmail','Gmail 邮箱','Google','active','mail')");
      await offer('mail',1,{product:'pr',mode:'unknown'});
      const ordinary=await getChannelCatalog(parseChannelFilters({group:'expanded',q:'mail'}),read);
      assert.equal(ordinary.total,0);
      const resources=await getChannelCatalog(parseChannelFilters({catalog:'resources',q:'mail'}),read);
      assert.equal(resources.total,1);assert.equal(resources.rows[0]?.price,null);
      assert.equal(parseChannelFilters({catalog:'resources'}).catalog,'resources');
    });
    await t.test("a resource is priced without a term, since it merges on a key that has none", async () => {
      await db.query("insert into canonical_products values ('pr3','resource-tool','账号工具 / 助手','OpenAI','active','other')");
      // A mailbox or a helper tool carries no subscription term. Asking one of them
      // anyway left seven of the ten resource products blank with stock on the shelf.
      await offer('toolA', 5, { product: 'pr3', mode: 'redeem_code', days: null });
      await offer('toolB', 9, { product: 'pr3', mode: 'finished_account', days: null, source: 's2' });
      // A shelf listing priced at a token cent is a menu entry, not this product's floor.
      // Resources are exempt from the median rule, so nothing else would keep it out.
      await offer('toolMenu', 0.01, { product: 'pr3', mode: 'redeem_code', days: null });
      const resources = await getChannelCatalog(parseChannelFilters({ catalog: 'resources', q: 'tool' }), read);
      const tool = resources.rows.find(row => row.product_slug === 'resource-tool');
      assert.equal(Number(tool?.price), 5, 'a termless resource still has a floor');
      assert.equal(tool?.duration_days, null, 'and the merged row still states no term');
      await db.query("delete from offers where id in ('toolA','toolB','toolMenu')");
      await db.query("delete from canonical_products where id='pr3'");
    });
    await t.test("bare accounts keep their own heading, and a product with no outright sale still shows a floor", async () => {
      await db.query(`insert into canonical_products values ('pa','chatgpt-account','ChatGPT 普通账号','OpenAI','active','chatgpt'),
        ('pu','google-ai-ultra','Google AI Ultra','Google','active','gemini')`);
      await offer('bare', 0.7, { product: 'pa', mode: 'finished_account' });
      // Ultra reaches this market only as family seats, so its strict comparable set is empty.
      await offer('seatA', 300, { product: 'pu', mode: 'shared_account' });
      await offer('seatB', 260, { product: 'pu', mode: 'shared_account', source: 's2' });
      const subs = await getChannelCatalog(parseChannelFilters({}), read);
      assert.equal(subs.rows.some(row => row.product_slug === 'chatgpt-account'), false,
        'a tierless account must not sit beside the tier it is not');
      const accounts = await getChannelCatalog(parseChannelFilters({ catalog: 'accounts' }), read);
      assert.deepEqual(accounts.rows.map(row => row.product_slug), ['chatgpt-account']);
      assert.equal(Number(accounts.rows[0]?.price), 0.7);
      const ultra = subs.rows.find(row => row.product_slug === 'google-ai-ultra');
      assert.equal(Number(ultra?.price), 260, 'the product is compared against itself rather than left blank');
      assert.equal(ultra?.offer_mode, 'shared_account', 'and the row names the delivery that produced the price');
      await db.query("delete from offers where id in ('bare','seatA','seatB')");
      await db.query("delete from canonical_products where id in ('pa','pu')");
    });
    await t.test("a category crosses the catalogue headings instead of being trapped by one", async () => {
      await db.query("insert into canonical_products values ('pmail','resource-icloud','iCloud 邮箱','Apple','active','mail')");
      await offer('mailbox', 3, { product: 'pmail', mode: 'finished_account', days: null });
      // The default heading is subscriptions, yet 邮箱 is a resource. A category that had
      // to satisfy the heading as well would return nothing at all, so it replaces it.
      const mail = await getChannelCatalog(parseChannelFilters({ category: 'mail' }), read);
      assert.ok(mail.rows.some(row => row.product_slug === 'resource-icloud'),
        'a mailbox is reachable without first switching the catalogue heading');
      assert.ok(mail.rows.every(row => ['resource-gmail', 'resource-outlook', 'resource-icloud', 'resource-education-email'].includes(row.product_slug)),
        'and nothing that is not a mailbox comes with it');
      const chatgpt = await getChannelCatalog(parseChannelFilters({ category: 'chatgpt' }), read);
      assert.ok(chatgpt.rows.length > 0 && chatgpt.rows.every(row => row.platform === 'OpenAI'),
        'ChatGPT keeps to OpenAI products');
      await db.query("delete from offers where id='mailbox'");
      await db.query("delete from canonical_products where id='pmail'");
    });
    await t.test("resource listings merge instead of standing alone per offer", async () => {
      await db.query("insert into canonical_products values ('pr2','resource-outlook','Outlook 邮箱','Microsoft','active','mail')");
      // A mailbox has no term and no delivery tier, so these three belong on one row.
      await offer('mailA',2,{product:'pr2',mode:'unknown',days:null});
      await offer('mailB',3,{product:'pr2',mode:'redeem_code',days:null,source:'s2'});
      await offer('mailC',4,{product:'pr2',mode:'finished_account'});
      const resources=await getChannelCatalog(parseChannelFilters({catalog:'resources'}),read);
      const outlook=resources.rows.filter(row=>row.product_slug==='resource-outlook');
      assert.equal(outlook.length,1,'a mailbox must not split into one row per offer');
      assert.equal(outlook[0]?.offer_count,3);
      assert.equal(outlook[0]?.merchant_count,2);
      assert.equal(outlook[0]?.offer_mode,'unknown','resources do not claim a delivery tier');
      // One row stands for many offers, so it must not borrow one of their terms or warranties.
      assert.equal(outlook[0]?.duration_days,null,'a merged resource row states no term');
      assert.equal(outlook[0]?.warranty_type,'unknown','a merged resource row states no warranty');
      // Subscriptions keep their boundaries: delivery, duration and warranty still split.
      const subscriptions=await getChannelCatalog(parseChannelFilters({}),read);
      assert.equal(subscriptions.rows.filter(row=>row.product_slug==='chatgpt-plus'&&row.currency==='CNY').length,1,
        'a product occupies exactly one row per currency');
    });
  } finally { await db.end(); }
});


test("page sizes are bounded and survive navigation while changes reset the page", () => {
  for (const pageSize of [undefined, "24", "0", "-1", "1000", "bad"]) {
    assert.equal(parseChannelFilters({ pageSize }).pageSize, 20);
  }
  for (const pageSize of ["20", "50", "100"]) {
    const filters = parseChannelFilters({ pageSize, page: "4", q: "plus", stock: "available", view: "merchants", layout: "table" });
    assert.equal(filters.pageSize, Number(pageSize));
    const next = new URL(channelHref(filters, { page: 5 }), "http://localhost");
    assert.equal(parseChannelFilters(Object.fromEntries(next.searchParams)).pageSize, Number(pageSize));
    assert.equal(next.searchParams.get("page"), "5");
    const changed = new URL(channelHref(filters, { pageSize: 100 }), "http://localhost");
    assert.equal(changed.searchParams.has("page"), false);
    assert.equal(changed.searchParams.get("q"), "plus");
    assert.equal(changed.searchParams.get("stock"), "available");
    assert.equal(changed.searchParams.get("layout"), "table");
  }
});
