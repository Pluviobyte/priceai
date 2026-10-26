import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "drizzle-orm";
import { createDatabase } from "@price-radar/database";
import { refreshTransitStations, stationSlug } from "./transit-stations.js";

const url = process.env.POLICY_TEST_DATABASE_URL;

test("relay sweep lists readable relays, drops delisted models and keeps unsupported hosts private", { skip: !url }, async () => {
  const handle = createDatabase(url!);
  const run = randomUUID().slice(0, 8);
  const good = `relay-${run}.example`, closed = `closed-${run}.example`;
  let models = [
    { model_name: "gpt-6.1-sol", quota_type: 0, model_ratio: 2.5, completion_ratio: 6 },
    { model_name: "claude-opus-4-8", quota_type: 0, model_ratio: 2.5, completion_ratio: 5 },
  ];
  const fetchJson = async (target: string) => {
    if (target === `https://${good}/api/status`) return { status: 200, payload: { success: true, data: { system_name: "Relay", price: 1, usd_exchange_rate: 5 } }, latencyMs: 7 };
    if (target === `https://${good}/api/pricing`) return { status: 200, payload: { success: true, group_ratio: { default: 0.5 }, data: models }, latencyMs: 7 };
    return { status: 404, payload: null, latencyMs: 3 };
  };
  try {
    const first = await refreshTransitStations(handle.db, { namedHosts: [good, closed], fetchJson });
    assert.deepEqual([first.listed, first.unsupported], [1, 1]);
    const listed = await handle.db.execute<{ active: boolean; system_kind: string; models: string; lowest: string }>(sql`
      select p.active,p.system_kind,count(mp.id)::text models,min(mp.multiplier)::text lowest
        from transit_providers p left join transit_model_prices mp on mp.provider_id=p.id
       where p.slug=${stationSlug(good)} group by p.id`);
    assert.deepEqual(listed.rows[0], { active: true, system_kind: "new_api", models: "2", lowest: "0.100000" });
    const hidden = await handle.db.execute<{ active: boolean; system_kind: string }>(sql`select active,system_kind from transit_providers where slug=${stationSlug(closed)}`);
    assert.deepEqual(hidden.rows[0], { active: false, system_kind: "unsupported" });

    // The relay stops selling one model; a week has not passed, so the closed host is not probed again.
    models = models.slice(0, 1);
    const second = await refreshTransitStations(handle.db, { namedHosts: [good, closed], fetchJson });
    assert.equal(second.probed, 1);
    const remaining = await handle.db.execute<{ model_code: string }>(sql`
      select mp.model_code from transit_model_prices mp join transit_providers p on p.id=mp.provider_id where p.slug=${stationSlug(good)}`);
    assert.deepEqual(remaining.rows.map(row => row.model_code), ["gpt-6.1-sol"]);
  } finally {
    await handle.db.execute(sql`delete from transit_providers where slug in (${stationSlug(good)},${stationSlug(closed)})`);
    await handle.close();
  }
});
