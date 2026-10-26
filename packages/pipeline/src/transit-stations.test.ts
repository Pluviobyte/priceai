import assert from "node:assert/strict";
import test from "node:test";
import { extractStationHosts, parseNewApiStation, parseSub2ApiStation, readStation, stationSlug } from "./transit-stations.js";

// Shapes as served by live relays on 2026-10-26, trimmed to the fields that are read.
const newApiStatus = { success: true, data: { system_name: "麒麟API", version: "main-c09871d75", price: 1, usd_exchange_rate: 6.66, quota_per_unit: 500000 } };
const newApiPricing = {
  success: true,
  group_ratio: { "s4:gpt-plus-特惠组": 0.13, "s4:claude-华强北": 0.8, "测试": 0.001, "Adm内测": 10 },
  data: [
    { model_name: "gpt-6.1-sol", quota_type: 0, model_ratio: 2.5, completion_ratio: 6, enable_groups: ["s4:gpt-plus-特惠组", "测试"] },
    { model_name: "claude-opus-4-8", quota_type: 0, model_ratio: 2.5, completion_ratio: 5, enable_groups: ["s4:claude-华强北"] },
    { model_name: "grok-imagine-image", quota_type: 1, model_price: 0.03, enable_groups: ["s4:claude-华强北"] },
  ],
};

test("New API prices combine model, group and top-up ratios, and skip private groups", () => {
  const station = parseNewApiStation(newApiStatus, newApiPricing, "https://qilinapi.example");
  assert.ok(station);
  assert.equal(station.system, "new_api");
  assert.equal(station.topUpRatio, 0.15015);
  assert.deepEqual(station.groups.map(group => group.name), ["s4:gpt-plus-特惠组", "s4:claude-华强北"]);
  const gpt = station.models.find(model => model.modelCode === "gpt-6.1-sol")!;
  // The 0.001 test group is ignored; 0.13 × ¥1 per dollar of balance ÷ ¥6.66 per dollar.
  assert.equal(gpt.group, "s4:gpt-plus-特惠组");
  assert.equal(gpt.multiplier, 0.01952);
  assert.equal(gpt.inputPerMillion, Number((2.5 * 2 * 0.13 * 0.15015).toFixed(8)));
  assert.equal(gpt.outputPerMillion, Number((gpt.inputPerMillion * 6).toFixed(8)));
  // A per-call image price has no token rate to compare.
  assert.equal(station.models.some(model => model.modelCode === "grok-imagine-image"), false);
});

test("a New API relay without public prices is not listed", () => {
  assert.equal(parseNewApiStation(newApiStatus, { success: false, message: "unauthorized" }, "https://x.example"), null);
  assert.equal(parseNewApiStation({ success: false }, newApiPricing, "https://x.example"), null);
});

const sub2ApiSettings = { code: 0, data: { site_name: "loveapi", version: "0.2.14", model_plaza_enabled: true, model_plaza_require_auth: false } };
const sub2ApiPlaza = {
  code: 0,
  data: {
    groups: [
      { name: "Codex-Plus 激励组0.05x", rate_multiplier: 0.05, is_exclusive: false, models: [
        { name: "gpt-5.6-sol", pricing: { billing_mode: "token", input_price: 5e-6, output_price: 3e-5 }, official_pricing: { input_price: 5e-6, output_price: 3e-5 } },
      ] },
      { name: "Claude Max", rate_multiplier: 1.6, is_exclusive: false, models: [
        { name: "claude-opus-4-8", pricing: { billing_mode: "token", input_price: 5e-6, output_price: 2.5e-5 }, official_pricing: { input_price: 5e-6 } },
        { name: "gpt-5.6-sol", pricing: { billing_mode: "token", input_price: 5e-6, output_price: 3e-5 }, official_pricing: { input_price: 5e-6 } },
      ] },
      { name: "VIP 专属", rate_multiplier: 0.01, is_exclusive: true, models: [
        { name: "claude-opus-4-8", pricing: { billing_mode: "token", input_price: 5e-6 }, official_pricing: { input_price: 5e-6 } },
      ] },
    ],
  },
};

test("Sub2API prices take each model's cheapest open group and ignore exclusive ones", () => {
  const station = parseSub2ApiStation(sub2ApiSettings, sub2ApiPlaza, "https://loveapi.example");
  assert.ok(station);
  assert.equal(station.system, "sub2api");
  assert.equal(station.name, "loveapi");
  assert.equal(station.topUpRatio, null);
  const gpt = station.models.find(model => model.modelCode === "gpt-5.6-sol")!;
  assert.deepEqual([gpt.group, gpt.multiplier, gpt.inputPerMillion], ["Codex-Plus 激励组0.05x", 0.05, 0.25]);
  const claude = station.models.find(model => model.modelCode === "claude-opus-4-8")!;
  assert.deepEqual([claude.group, claude.multiplier], ["Claude Max", 1.6]);
});

test("the reader tells New API from Sub2API and reports a closed model plaza", async () => {
  const responses: Record<string, { status: number; payload: unknown }> = {
    "https://a.example/api/status": { status: 200, payload: newApiStatus },
    "https://a.example/api/pricing": { status: 200, payload: newApiPricing },
    "https://b.example/api/status": { status: 404, payload: null },
    "https://b.example/api/v1/settings/public": { status: 200, payload: sub2ApiSettings },
    "https://b.example/api/v1/model-plaza": { status: 200, payload: sub2ApiPlaza },
    "https://c.example/api/status": { status: 404, payload: null },
    "https://c.example/api/v1/settings/public": { status: 200, payload: { code: 0, data: { site_name: "c", model_plaza_enabled: true, model_plaza_require_auth: true } } },
  };
  const fetchJson = async (url: string) => ({ ...(responses[url] ?? { status: 404, payload: null }), latencyMs: 5 });
  assert.equal((await readStation("https://a.example", fetchJson)).snapshot?.system, "new_api");
  assert.equal((await readStation("https://b.example", fetchJson)).snapshot?.system, "sub2api");
  assert.equal((await readStation("https://c.example", fetchJson)).reason, "sub2api_model_plaza_not_public");
  assert.equal((await readStation("https://d.example", fetchJson)).reason, "unsupported_system");
});

test("relay hosts come out of shop listings without shop, chat, document or file hosts", () => {
  const hosts = extractStationHosts([
    "耀耀中转站 地址 https://api.botmind.tech/v1 教程 doc.ccttt99.com 售后 t.me/xxx",
    "Codex/Claude 官方中转API 站点：loveapi.top，下载 installer.exe 打开 index.html，购买 wzyp.cn/item/abc",
    "备用 www.Kimera.cc｜交流群 qq.com",
  ]);
  assert.deepEqual(hosts, ["api.botmind.tech", "kimera.cc", "loveapi.top"]);
  assert.equal(stationSlug("api.botmind.tech"), "relay-api-botmind-tech");
});
