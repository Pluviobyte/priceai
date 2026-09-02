# 核心数据模型方案

## 1. 分层原则

```text
候选来源层
→ 正式来源与商家层
→ 采集运行与原始快照层
→ 标准商品与属性匹配层
→ 当前有效报价层
→ 发布版本与历史层
```

原始事实不可被人工修正覆盖；人工纠错作用于分类、有效报价或规则层。

## 2. 核心表

### `merchants`

商家主体，与具体店铺入口分离。

```text
id
name
slug
website_url
contact_public
commercial_relation
status
created_at
updated_at
```

### `source_candidates`

```text
id
candidate_url
merchant_name_hint
platform_hint
discovery_kind
discovery_url
submitted_by
status
review_note
discovered_at
reviewed_at
```

### `sources`

```text
id
merchant_id
platform_kind
platform_merchant_id
shop_token
canonical_entry_url
submitted_url
collector_kind
collector_config_encrypted
enabled
health_status
first_seen_at
last_checked_at
last_success_at
consecutive_failures
last_error_code
expected_product_count
latest_complete_run_id
next_run_at
```

来源唯一键优先使用：

```text
platform_kind + platform_merchant_id
```

共享平台中的不同店铺必须是不同来源。

### `source_submissions`

```text
id
url
name
contact
notes
status
detected_collector_kind
trial_run_id
reviewed_by
reviewed_at
created_at
```

### `crawl_runs`

```text
id
source_id
collector_kind
collector_version
status
complete_snapshot
expected_total
fetched_total
parsed_total
duplicate_total
quarantined_total
started_at
finished_at
http_status_summary
error_code
error_message
raw_manifest_url
```

状态：`queued / running / success / partial / failed / cancelled`。

### `raw_offer_snapshots`

```text
id
crawl_run_id
source_id
source_item_id
raw_title
raw_description
raw_category
raw_price_text
raw_price_numeric
currency
raw_stock
stock_count
stock_state_hint
product_url
source_updated_at
captured_at
raw_payload_url
raw_payload_hash
```

唯一键优先使用：

```text
source_id + source_item_id + crawl_run_id
```

没有上游商品 ID 时，退化为规范化后的商品 URL。

### `canonical_products`

```text
id
brand
slug
display_name
plan_family
billing_period
base_duration_days
status
official_product_url
created_at
updated_at
```

只表达最终获得的权益，不把所有交付方式写进产品 ID。

### `offer_matches`

```text
id
raw_offer_snapshot_id
canonical_product_id
confidence
matched_rules
conflicting_signals
classifier_version
review_status
manual_override_id
created_at
```

### `offer_attributes`

```text
id
offer_match_id
offer_mode
duration_days
region
account_ownership
phone_bound
email_type
warranty_type
warranty_hours
delivery_mode
auto_delivery
web_available
desktop_available
api_available
shared
invoice_available
refund_policy
attribute_evidence
```

### `offers`

当前有效报价投影：

```text
id
source_id
source_item_id
canonical_product_id
latest_raw_snapshot_id
price
currency
stock_count
stock_state
availability_state
freshness_state
risk_facts
offer_mode
product_url
first_seen_at
last_seen_at
offer_verified_at
last_checked_at
classification_confidence
quarantine_reason
publish_generation_id
```

### `offer_price_history`

```text
id
offer_id
price
currency
stock_count
stock_state
observed_at
crawl_run_id
```

只有价格或库存发生变化时写历史，或按固定周期做压缩快照。

### `manual_overrides`

```text
id
target_type
target_id
override_kind
before_value
after_value
reason
created_by
created_at
expires_at
```

### `classification_rules`

```text
id
rule_type
pattern
result
priority
enabled
version
test_cases
created_at
updated_at
```

### `reports`

```text
id
target_type
target_id
report_type
details
evidence_url
status
resolution
created_at
resolved_at
```

### `publish_generations`

```text
id
status
generated_at
published_at
offer_count
product_count
source_count
manifest_url
previous_generation_id
```

### `outbound_clicks`

```text
id
offer_id
source_id
placement
commercial_relation
anonymous_session_id
clicked_at
```

避免存储不必要的用户敏感信息。

## 3. 官方订阅扩展表

```text
official_apps
official_plans
official_regions
official_price_observations
exchange_rates
official_sources
```

`official_price_observations` 至少保存：App、套餐、地区、渠道、原币价格、人民币估算、税费口径、证据 URL、抓取时间和汇率版本。

## 4. 官方 API 扩展表

```text
api_providers
api_models
api_price_dimensions
api_price_observations
api_plan_limits
api_source_documents
```

价格维度不能只存输入/输出 token，还要能表达缓存、批量、图片、视频秒数、音频和免费层。

## 5. 中转 API 扩展表

```text
transit_stations
transit_models
transit_price_observations
transit_monitor_targets
transit_probe_runs
transit_availability_samples
transit_incidents
```

站点自报价格、公开监测和平台实测必须保存不同的 `source_type`，不得混成同一证据。

## 6. 关键状态枚举

```text
source.health_status:
healthy / retrying / failing / paused / removed

offer.stock_state:
in_stock / low_stock / out_of_stock / unknown / conflict

offer.freshness_state:
fresh / aging / stale / unknown

offer.availability_state:
purchasable / unavailable / quarantined / expired

submission.status:
submitted / prechecked / trial_crawled / review / approved / rejected
```

## 7. 索引与约束

- `sources(platform_kind, platform_merchant_id)` 唯一；
- `offers(source_id, source_item_id)` 唯一；
- `raw_offer_snapshots(crawl_run_id, source_id, source_item_id)` 唯一；
- `offers(canonical_product_id, availability_state, freshness_state, price)` 组合索引；
- `sources(next_run_at, enabled)` 调度索引；
- 原始标题使用 `pg_trgm` 和全文索引；
- URL 保存前规范化，但同时保留最初提交 URL；
- 所有金额使用精确 decimal/numeric，禁止浮点；
- 原始 payload 放对象存储，数据库保存哈希、路径和必要检索字段。

## 8. 公开报价示例

```json
{
  "canonical_product": "chatgpt-plus",
  "offer_mode": "finished_account",
  "duration_days": 30,
  "price": "26.50",
  "currency": "CNY",
  "stock_state": "in_stock",
  "account_ownership": "merchant_account",
  "phone_bound": false,
  "warranty_type": "first_login",
  "web_available": true,
  "risk_facts": ["仅质保首登"],
  "source": {
    "merchant": "示例商家",
    "original_title": "源站原始商品标题",
    "url": "https://example.com/item/123",
    "verified_at": "2026-09-03T00:00:00Z"
  }
}
```

