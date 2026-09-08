import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const commercialRelationEnum = pgEnum("commercial_relation", [
  "none",
  "affiliate",
  "sponsor",
  "merchant_direct",
  "unknown",
]);

export const sourceHealthEnum = pgEnum("source_health", [
  "healthy",
  "retrying",
  "failing",
  "paused",
  "removed",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "prechecked",
  "trial_crawled",
  "review",
  "approved",
  "rejected",
]);

export const crawlRunStatusEnum = pgEnum("crawl_run_status", [
  "queued",
  "running",
  "success",
  "partial",
  "failed",
  "cancelled",
]);

export const stockStateEnum = pgEnum("stock_state", [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "unknown",
  "conflict",
]);

export const freshnessStateEnum = pgEnum("freshness_state", [
  "fresh",
  "aging",
  "stale",
  "unknown",
]);

export const availabilityStateEnum = pgEnum("availability_state", [
  "purchasable",
  "unavailable",
  "quarantined",
  "expired",
]);

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    websiteUrl: text("website_url"),
    contactPublic: jsonb("contact_public").$type<Record<string, string>>(),
    commercialRelation: commercialRelationEnum("commercial_relation")
      .notNull()
      .default("unknown"),
    status: text("status").notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("merchants_slug_uidx").on(table.slug)],
);

export const sourceCandidates = pgTable(
  "source_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateUrl: text("candidate_url").notNull(),
    merchantNameHint: text("merchant_name_hint"),
    platformHint: text("platform_hint"),
    discoveryKind: text("discovery_kind").notNull(),
    discoveryUrl: text("discovery_url"),
    submittedBy: text("submitted_by"),
    status: text("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    // Network-free identity guess used to collapse the same shop reached through
    // several directories or mirror domains before any trial crawl runs.
    platformKind: text("platform_kind"),
    platformMerchantId: text("platform_merchant_id"),
    // Number of independent discovery providers that listed this shop.
    priority: integer("priority").notNull().default(0),
    discoveryEvidence: jsonb("discovery_evidence")
      .$type<Array<{ provider: string; url: string | null; seenAt: string; nameHint?: string }>>()
      .notNull()
      .default([]),
    vettingResult: jsonb("vetting_result").$type<Record<string, unknown>>(),
    vettedAt: timestamp("vetted_at", { withTimezone: true }),
    nextVetAt: timestamp("next_vet_at", { withTimezone: true }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    submissionId: uuid("submission_id").references(() => sourceSubmissions.id, { onDelete: "set null" }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("source_candidates_status_idx").on(table.status),
    index("source_candidates_vetting_queue_idx").on(table.status, table.priority, table.discoveredAt),
    uniqueIndex("source_candidates_identity_uidx")
      .on(table.platformKind, table.platformMerchantId)
      .where(sql`platform_merchant_id is not null`),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").references(() => merchants.id, {
      onDelete: "set null",
    }),
    platformKind: text("platform_kind").notNull(),
    platformMerchantId: text("platform_merchant_id").notNull(),
    shopToken: text("shop_token"),
    canonicalEntryUrl: text("canonical_entry_url").notNull(),
    submittedUrl: text("submitted_url"),
    collectorKind: text("collector_kind").notNull(),
    collectorConfigEncrypted: text("collector_config_encrypted"),
    enabled: boolean("enabled").notNull().default(false),
    healthStatus: sourceHealthEnum("health_status")
      .notNull()
      .default("paused"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    expectedProductCount: integer("expected_product_count"),
    latestCompleteRunId: uuid("latest_complete_run_id"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("sources_platform_identity_uidx").on(
      table.platformKind,
      table.platformMerchantId,
    ),
    index("sources_scheduler_idx").on(table.enabled, table.nextRunAt),
    index("sources_health_idx").on(table.healthStatus),
  ],
);

export const sourceSubmissions = pgTable(
  "source_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    name: text("name"),
    contact: text("contact"),
    primaryProducts: text("primary_products"),
    notes: text("notes"),
    submitterFingerprint: text("submitter_fingerprint"),
    status: submissionStatusEnum("status").notNull().default("submitted"),
    detectedCollectorKind: text("detected_collector_kind"),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    trialRunId: uuid("trial_run_id"),
    precheckResult: jsonb("precheck_result").$type<Record<string, unknown>>(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("source_submissions_status_idx").on(table.status),
    index("source_submissions_fingerprint_idx").on(
      table.submitterFingerprint,
      table.createdAt,
    ),
  ],
);

export const crawlRuns = pgTable(
  "crawl_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    collectorKind: text("collector_kind").notNull(),
    collectorVersion: text("collector_version").notNull(),
    status: crawlRunStatusEnum("status").notNull().default("queued"),
    completeSnapshot: boolean("complete_snapshot").notNull().default(false),
    expectedTotal: integer("expected_total"),
    fetchedTotal: integer("fetched_total").notNull().default(0),
    parsedTotal: integer("parsed_total").notNull().default(0),
    duplicateTotal: integer("duplicate_total").notNull().default(0),
    quarantinedTotal: integer("quarantined_total").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    httpStatusSummary: jsonb("http_status_summary").$type<Record<string, number>>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    rawManifestUrl: text("raw_manifest_url"),
    rawManifestHash: text("raw_manifest_hash"),
    createdAt,
  },
  (table) => [
    index("crawl_runs_source_created_idx").on(table.sourceId, table.createdAt),
    index("crawl_runs_status_idx").on(table.status),
  ],
);

export const rawOfferSnapshots = pgTable(
  "raw_offer_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlRunId: uuid("crawl_run_id")
      .notNull()
      .references(() => crawlRuns.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceItemId: text("source_item_id").notNull(),
    rawTitle: text("raw_title").notNull(),
    rawDescription: text("raw_description"),
    rawCategory: text("raw_category"),
    rawPriceText: text("raw_price_text").notNull(),
    rawPriceNumeric: numeric("raw_price_numeric", {
      precision: 20,
      scale: 6,
    }),
    currency: text("currency").notNull(),
    rawStock: jsonb("raw_stock"),
    stockCount: integer("stock_count"),
    stockStateHint: stockStateEnum("stock_state_hint").notNull().default("unknown"),
    productUrl: text("product_url").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    rawPayloadUrl: text("raw_payload_url"),
    rawPayloadHash: text("raw_payload_hash").notNull(),
  },
  (table) => [
    uniqueIndex("raw_offer_run_source_item_uidx").on(
      table.crawlRunId,
      table.sourceId,
      table.sourceItemId,
    ),
    index("raw_offer_source_item_idx").on(table.sourceId, table.sourceItemId),
  ],
);

export const canonicalProducts = pgTable(
  "canonical_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brand: text("brand").notNull(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    planFamily: text("plan_family").notNull(),
    billingPeriod: text("billing_period"),
    baseDurationDays: integer("base_duration_days"),
    status: text("status").notNull().default("active"),
    officialProductUrl: text("official_product_url"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("canonical_products_slug_uidx").on(table.slug),
    index("canonical_products_brand_idx").on(table.brand),
  ],
);

export const manualOverrides = pgTable("manual_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  overrideKind: text("override_kind").notNull(),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value").notNull(),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt,
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const classificationOverrides = pgTable(
  "classification_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceItemId: text("source_item_id").notNull(),
    canonicalProductId: uuid("canonical_product_id").references(
      () => canonicalProducts.id,
      { onDelete: "set null" },
    ),
    decision: text("decision").notNull(),
    attributeOverrides: jsonb("attribute_overrides")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    reason: text("reason").notNull(),
    createdBy: text("created_by").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("classification_overrides_source_item_uidx").on(
      table.sourceId,
      table.sourceItemId,
    ),
    index("classification_overrides_active_idx").on(table.active),
  ],
);

export const offerMatches = pgTable(
  "offer_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawOfferSnapshotId: uuid("raw_offer_snapshot_id")
      .notNull()
      .references(() => rawOfferSnapshots.id, { onDelete: "cascade" }),
    canonicalProductId: uuid("canonical_product_id").references(
      () => canonicalProducts.id,
      { onDelete: "set null" },
    ),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    matchedRules: jsonb("matched_rules").$type<string[]>().notNull().default([]),
    conflictingSignals: jsonb("conflicting_signals")
      .$type<string[]>()
      .notNull()
      .default([]),
    classifierVersion: text("classifier_version").notNull(),
    reviewStatus: text("review_status").notNull().default("pending"),
    manualOverrideId: uuid("manual_override_id").references(
      () => manualOverrides.id,
      { onDelete: "set null" },
    ),
    createdAt,
  },
  (table) => [
    uniqueIndex("offer_matches_snapshot_uidx").on(table.rawOfferSnapshotId),
    index("offer_matches_product_idx").on(table.canonicalProductId),
    index("offer_matches_review_idx").on(table.reviewStatus),
  ],
);

export const offerAttributes = pgTable(
  "offer_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerMatchId: uuid("offer_match_id")
      .notNull()
      .references(() => offerMatches.id, { onDelete: "cascade" }),
    offerMode: text("offer_mode").notNull(),
    durationDays: integer("duration_days"),
    region: text("region"),
    accountOwnership: text("account_ownership").notNull().default("unknown"),
    phoneBound: boolean("phone_bound"),
    emailType: text("email_type"),
    warrantyType: text("warranty_type").notNull().default("unknown"),
    warrantyHours: integer("warranty_hours"),
    autoDelivery: boolean("auto_delivery"),
    webAvailable: boolean("web_available"),
    desktopAvailable: boolean("desktop_available"),
    apiAvailable: boolean("api_available"),
    shared: boolean("shared"),
    invoiceAvailable: boolean("invoice_available"),
    refundPolicy: text("refund_policy"),
    riskFacts: jsonb("risk_facts").$type<string[]>().notNull().default([]),
    attributeEvidence: jsonb("attribute_evidence")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
  },
  (table) => [
    uniqueIndex("offer_attributes_match_uidx").on(table.offerMatchId),
  ],
);

export const publishGenerations = pgTable("publish_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("staging"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  offerCount: integer("offer_count").notNull().default(0),
  productCount: integer("product_count").notNull().default(0),
  sourceCount: integer("source_count").notNull().default(0),
  manifestUrl: text("manifest_url"),
  manifestHash: text("manifest_hash"),
  previousGenerationId: uuid("previous_generation_id"),
});

export const publicationChannels = pgTable("publication_channels", {
  channel: text("channel").primaryKey(),
  currentGenerationId: uuid("current_generation_id").references(
    () => publishGenerations.id,
    { onDelete: "set null" },
  ),
  previousGenerationId: uuid("previous_generation_id").references(
    () => publishGenerations.id,
    { onDelete: "set null" },
  ),
  updatedAt,
});

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceItemId: text("source_item_id").notNull(),
    canonicalProductId: uuid("canonical_product_id")
      .notNull()
      .references(() => canonicalProducts.id, { onDelete: "cascade" }),
    latestRawSnapshotId: uuid("latest_raw_snapshot_id")
      .notNull()
      .references(() => rawOfferSnapshots.id),
    price: numeric("price", { precision: 20, scale: 6 }).notNull(),
    currency: text("currency").notNull(),
    stockCount: integer("stock_count"),
    stockState: stockStateEnum("stock_state").notNull(),
    availabilityState: availabilityStateEnum("availability_state").notNull(),
    freshnessState: freshnessStateEnum("freshness_state").notNull(),
    riskFacts: jsonb("risk_facts").$type<string[]>().notNull().default([]),
    offerMode: text("offer_mode").notNull(),
    productUrl: text("product_url").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    offerVerifiedAt: timestamp("offer_verified_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    classificationConfidence: numeric("classification_confidence", {
      precision: 5,
      scale: 4,
    }).notNull(),
    quarantineReason: text("quarantine_reason"),
    publishGenerationId: uuid("publish_generation_id").references(
      () => publishGenerations.id,
      { onDelete: "set null" },
    ),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("offers_source_item_uidx").on(table.sourceId, table.sourceItemId),
    index("offers_product_rank_idx").on(
      table.canonicalProductId,
      table.availabilityState,
      table.freshnessState,
      table.price,
    ),
    index("offers_generation_product_rank_idx").on(
      table.publishGenerationId,
      table.canonicalProductId,
      table.availabilityState,
      table.price,
    ),
  ],
);

export const publishedOfferSnapshots = pgTable(
  "published_offer_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publishGenerationId: uuid("publish_generation_id")
      .notNull()
      .references(() => publishGenerations.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    sourceId: uuid("source_id").notNull().references(() => sources.id),
    sourceItemId: text("source_item_id").notNull(),
    canonicalProductId: uuid("canonical_product_id").notNull().references(() => canonicalProducts.id),
    latestRawSnapshotId: uuid("latest_raw_snapshot_id").notNull().references(() => rawOfferSnapshots.id),
    price: numeric("price", { precision: 20, scale: 6 }).notNull(),
    currency: text("currency").notNull(),
    stockCount: integer("stock_count"),
    stockState: stockStateEnum("stock_state").notNull(),
    availabilityState: availabilityStateEnum("availability_state").notNull(),
    freshnessState: freshnessStateEnum("freshness_state").notNull(),
    riskFacts: jsonb("risk_facts").$type<string[]>().notNull().default([]),
    offerMode: text("offer_mode").notNull(),
    productUrl: text("product_url").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    offerVerifiedAt: timestamp("offer_verified_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    classificationConfidence: numeric("classification_confidence", { precision: 5, scale: 4 }).notNull(),
    quarantineReason: text("quarantine_reason"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("published_offer_snapshot_generation_identity_uidx").on(
      table.publishGenerationId,
      table.sourceId,
      table.sourceItemId,
    ),
    index("published_offer_snapshot_generation_rank_idx").on(
      table.publishGenerationId,
      table.canonicalProductId,
      table.availabilityState,
      table.price,
    ),
  ],
);

export const offerPriceHistory = pgTable(
  "offer_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 20, scale: 6 }).notNull(),
    currency: text("currency").notNull(),
    stockCount: integer("stock_count"),
    stockState: stockStateEnum("stock_state").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    crawlRunId: uuid("crawl_run_id").references(() => crawlRuns.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("offer_price_history_offer_idx").on(table.offerId, table.observedAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reportType: text("report_type").notNull(),
    details: text("details"),
    evidenceUrl: text("evidence_url"),
    submitterFingerprint: text("submitter_fingerprint"),
    status: text("status").notNull().default("open"),
    resolution: text("resolution"),
    createdAt,
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("reports_status_idx").on(table.status),
    index("reports_fingerprint_idx").on(table.submitterFingerprint, table.createdAt),
  ],
);

export const offerAnomalies = pgTable(
  "offer_anomalies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawOfferSnapshotId: uuid("raw_offer_snapshot_id")
      .notNull()
      .references(() => rawOfferSnapshots.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    severity: text("severity").notNull(),
    observedValue: jsonb("observed_value"),
    baselineValue: jsonb("baseline_value"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("open"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("offer_anomalies_snapshot_kind_uidx").on(
      table.rawOfferSnapshotId,
      table.kind,
    ),
    index("offer_anomalies_status_idx").on(table.status, table.severity),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    beforeValue: jsonb("before_value"),
    afterValue: jsonb("after_value"),
    createdAt,
  },
  (table) => [index("audit_logs_target_idx").on(table.targetType, table.targetId)],
);

export const outboundClickDaily = pgTable(
  "outbound_click_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    clickCount: integer("click_count").notNull().default(0),
    updatedAt,
  },
  (table) => [
    uniqueIndex("outbound_click_daily_offer_day_uidx").on(table.offerId, table.day),
    index("outbound_click_daily_day_idx").on(table.day),
  ],
);

export const apiRateLimitWindows = pgTable(
  "api_rate_limit_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt,
  },
  (table) => [
    uniqueIndex("api_rate_limit_fingerprint_window_uidx").on(
      table.fingerprint,
      table.windowStart,
    ),
    index("api_rate_limit_window_idx").on(table.windowStart),
  ],
);

export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalProductId: uuid("canonical_product_id")
      .notNull()
      .references(() => canonicalProducts.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(),
    email: text("email").notNull(),
    targetPrice: numeric("target_price", { precision: 20, scale: 6 }),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull().default("pending_verification"),
    verificationTokenHash: text("verification_token_hash").notNull(),
    unsubscribeTokenHash: text("unsubscribe_token_hash").notNull(),
    lastObservedPrice: numeric("last_observed_price", { precision: 20, scale: 6 }),
    lastObservedAvailable: boolean("last_observed_available"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("price_alerts_active_idx").on(table.status, table.canonicalProductId),
    index("price_alerts_email_idx").on(table.email),
  ],
);

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    destination: text("destination").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [index("notification_outbox_delivery_idx").on(table.status, table.availableAt)],
);

export const officialSubscriptionPlans = pgTable(
  "official_subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendor: text("vendor").notNull(),
    planCode: text("plan_code").notNull(),
    displayName: text("display_name").notNull(),
    billingPeriod: text("billing_period").notNull(),
    canonicalProductId: uuid("canonical_product_id").references(
      () => canonicalProducts.id,
      { onDelete: "set null" },
    ),
    officialUrl: text("official_url").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("official_subscription_plans_vendor_code_uidx").on(
      table.vendor,
      table.planCode,
    ),
    index("official_subscription_plans_vendor_idx").on(table.vendor),
  ],
);

export const exchangeRateSnapshots = pgTable(
  "exchange_rate_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    baseCurrency: text("base_currency").notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    rate: numeric("rate", { precision: 24, scale: 10 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceName: text("source_name").notNull(),
    effectiveDate: date("effective_date").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("exchange_rate_pair_date_uidx").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.effectiveDate,
    ),
    index("exchange_rate_latest_idx").on(
      table.baseCurrency,
      table.quoteCurrency,
      table.effectiveDate,
    ),
  ],
);

export const officialSubscriptionPrices = pgTable(
  "official_subscription_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => officialSubscriptionPlans.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    countryCode: text("country_code").notNull(),
    currency: text("currency").notNull(),
    priceKind: text("price_kind").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }),
    lowerAmount: numeric("lower_amount", { precision: 20, scale: 6 }),
    upperAmount: numeric("upper_amount", { precision: 20, scale: 6 }),
    cnyEstimate: numeric("cny_estimate", { precision: 20, scale: 6 }),
    exchangeRateSnapshotId: uuid("exchange_rate_snapshot_id").references(
      () => exchangeRateSnapshots.id,
      { onDelete: "set null" },
    ),
    rawPlanName: text("raw_plan_name").notNull(),
    appId: text("app_id"),
    evidenceUrl: text("evidence_url").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    evidenceHash: text("evidence_hash").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("official_subscription_price_identity_uidx").on(
      table.planId,
      table.channel,
      table.countryCode,
      table.rawPlanName,
    ),
    index("official_subscription_price_rank_idx").on(
      table.planId,
      table.priceKind,
      table.cnyEstimate,
    ),
  ],
);

export const officialSubscriptionPriceHistory = pgTable(
  "official_subscription_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officialPriceId: uuid("official_price_id")
      .notNull()
      .references(() => officialSubscriptionPrices.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    priceKind: text("price_kind").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }),
    lowerAmount: numeric("lower_amount", { precision: 20, scale: 6 }),
    upperAmount: numeric("upper_amount", { precision: 20, scale: 6 }),
    cnyEstimate: numeric("cny_estimate", { precision: 20, scale: 6 }),
    evidenceUrl: text("evidence_url").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt,
  },
  (table) => [
    index("official_subscription_history_price_idx").on(
      table.officialPriceId,
      table.observedAt,
    ),
  ],
);

export const officialApiVendors = pgTable(
  "official_api_vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    pricingUrl: text("pricing_url").notNull(),
    modelsUrl: text("models_url").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("official_api_vendors_slug_uidx").on(table.slug)],
);

export const officialApiModels = pgTable(
  "official_api_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => officialApiVendors.id, { onDelete: "cascade" }),
    modelCode: text("model_code").notNull(),
    displayName: text("display_name").notNull(),
    modality: text("modality").notNull(),
    contextWindow: integer("context_window"),
    availability: text("availability").notNull().default("public"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("official_api_models_vendor_code_uidx").on(
      table.vendorId,
      table.modelCode,
    ),
    index("official_api_models_vendor_idx").on(table.vendorId),
  ],
);

export const officialApiPrices = pgTable(
  "official_api_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => officialApiModels.id, { onDelete: "cascade" }),
    priceTier: text("price_tier").notNull().default("standard"),
    unit: text("unit").notNull(),
    currency: text("currency").notNull().default("USD"),
    inputPrice: numeric("input_price", { precision: 20, scale: 8 }),
    cachedInputPrice: numeric("cached_input_price", { precision: 20, scale: 8 }),
    outputPrice: numeric("output_price", { precision: 20, scale: 8 }),
    additionalPrices: jsonb("additional_prices").$type<Record<string, unknown>>().notNull().default({}),
    freeTier: jsonb("free_tier").$type<Record<string, unknown>>().notNull().default({}),
    rateLimits: jsonb("rate_limits").$type<Record<string, unknown>>().notNull().default({}),
    evidenceUrl: text("evidence_url").notNull(),
    documentVersion: text("document_version"),
    evidenceHash: text("evidence_hash").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("official_api_price_model_tier_uidx").on(
      table.modelId,
      table.priceTier,
      table.unit,
    ),
    index("official_api_price_verified_idx").on(table.verifiedAt),
  ],
);

export const officialApiPriceHistory = pgTable(
  "official_api_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officialApiPriceId: uuid("official_api_price_id")
      .notNull()
      .references(() => officialApiPrices.id, { onDelete: "cascade" }),
    inputPrice: numeric("input_price", { precision: 20, scale: 8 }),
    cachedInputPrice: numeric("cached_input_price", { precision: 20, scale: 8 }),
    outputPrice: numeric("output_price", { precision: 20, scale: 8 }),
    additionalPrices: jsonb("additional_prices").$type<Record<string, unknown>>().notNull().default({}),
    evidenceUrl: text("evidence_url").notNull(),
    evidenceHash: text("evidence_hash").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt,
  },
  (table) => [
    index("official_api_history_price_idx").on(
      table.officialApiPriceId,
      table.observedAt,
    ),
  ],
);

export const transitProviders = pgTable(
  "transit_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    apiBaseUrl: text("api_base_url"),
    modelsEndpoint: text("models_endpoint"),
    statusUrl: text("status_url"),
    operatorName: text("operator_name"),
    systemKind: text("system_kind").notNull().default("unknown"),
    discoverySource: text("discovery_source").notNull(),
    evidenceUrl: text("evidence_url").notNull(),
    active: boolean("active").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("transit_providers_slug_uidx").on(table.slug)],
);

export const transitModelPrices = pgTable(
  "transit_model_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => transitProviders.id, { onDelete: "cascade" }),
    modelCode: text("model_code").notNull(),
    displayName: text("display_name").notNull(),
    currency: text("currency").notNull().default("USD"),
    unit: text("unit").notNull().default("per_million_tokens"),
    inputPrice: numeric("input_price", { precision: 20, scale: 8 }),
    outputPrice: numeric("output_price", { precision: 20, scale: 8 }),
    multiplier: numeric("multiplier", { precision: 12, scale: 6 }),
    fixedPlan: jsonb("fixed_plan").$type<Record<string, unknown>>().notNull().default({}),
    evidenceKind: text("evidence_kind").notNull(),
    evidenceUrl: text("evidence_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("transit_model_price_provider_model_uidx").on(
      table.providerId,
      table.modelCode,
    ),
  ],
);

export const transitProbes = pgTable(
  "transit_probes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => transitProviders.id, { onDelete: "cascade" }),
    probeKind: text("probe_kind").notNull(),
    success: boolean("success").notNull(),
    latencyMs: integer("latency_ms"),
    httpStatus: integer("http_status"),
    modelCount: integer("model_count"),
    errorCode: text("error_code"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transit_probes_provider_checked_idx").on(
      table.providerId,
      table.checkedAt,
    ),
  ],
);

export const transitEvents = pgTable(
  "transit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => transitProviders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    evidenceUrl: text("evidence_url"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("transit_events_provider_started_idx").on(
      table.providerId,
      table.startedAt,
    ),
  ],
);

export const merchantFeedSubmissions = pgTable(
  "merchant_feed_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantName: text("merchant_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    feedUrl: text("feed_url").notNull(),
    schemaKind: text("schema_kind").notNull().default("auto"),
    contact: text("contact").notNull(),
    notes: text("notes"),
    submitterFingerprint: text("submitter_fingerprint"),
    status: text("status").notNull().default("submitted"),
    reviewNote: text("review_note"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("merchant_feed_submissions_status_idx").on(table.status),
    index("merchant_feed_submissions_fingerprint_idx").on(table.submitterFingerprint, table.createdAt),
  ],
);

export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    query: text("query").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("running"),
    resultCount: integer("result_count").notNull().default(0),
    candidateCount: integer("candidate_count").notNull().default(0),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("discovery_runs_kind_started_idx").on(table.kind, table.startedAt)],
);

export const crawlLeases = pgTable(
  "crawl_leases",
  {
    sourceId: uuid("source_id").primaryKey().references(() => sources.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    platformKind: text("platform_kind").notNull().default("unknown"),
    platformSlot: integer("platform_slot").notNull().default(0),
    leaseToken: uuid("lease_token").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("crawl_leases_hostname_uidx").on(table.hostname),
    uniqueIndex("crawl_leases_platform_slot_uidx").on(table.platformKind, table.platformSlot),
  ],
);

export const semanticDuplicateCandidates = pgTable(
  "semantic_duplicate_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    leftSnapshotId: uuid("left_snapshot_id").notNull().references(() => rawOfferSnapshots.id, { onDelete: "cascade" }),
    rightSnapshotId: uuid("right_snapshot_id").notNull().references(() => rawOfferSnapshots.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 5, scale: 4 }).notNull(),
    signals: jsonb("signals").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("candidate"),
    createdAt,
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("semantic_duplicate_pair_uidx").on(table.leftSnapshotId, table.rightSnapshotId),
    index("semantic_duplicate_status_idx").on(table.status, table.score),
  ],
);

// Merchant-level vetting facts. They describe what a shop's public catalog looks
// like (AI relevance, stock, warranty wording, overlap with other shops) and are
// recomputed from complete crawl runs. They are facts for operators and merchant
// pages, never fraud scores and never inputs to the minimum price.
export const sourceQualityProfiles = pgTable(
  "source_quality_profiles",
  {
    sourceId: uuid("source_id")
      .primaryKey()
      .references(() => sources.id, { onDelete: "cascade" }),
    crawlRunId: uuid("crawl_run_id").references(() => crawlRuns.id, { onDelete: "set null" }),
    itemCount: integer("item_count").notNull().default(0),
    aiRelevantCount: integer("ai_relevant_count").notNull().default(0),
    aiRelevantShare: numeric("ai_relevant_share", { precision: 5, scale: 4 }).notNull().default("0"),
    inStockCount: integer("in_stock_count").notNull().default(0),
    outOfStockShare: numeric("out_of_stock_share", { precision: 5, scale: 4 }).notNull().default("0"),
    noWarrantyShare: numeric("no_warranty_share", { precision: 5, scale: 4 }).notNull().default("0"),
    riskFactCount: integer("risk_fact_count").notNull().default(0),
    contactPresent: boolean("contact_present").notNull().default(false),
    priceOutlierShare: numeric("price_outlier_share", { precision: 5, scale: 4 }),
    priceComparableCount: integer("price_comparable_count").notNull().default(0),
    catalogOverlapMax: numeric("catalog_overlap_max", { precision: 5, scale: 4 }),
    catalogOverlapSourceId: uuid("catalog_overlap_source_id").references(() => sources.id, { onDelete: "set null" }),
    merchantCreatedAt: timestamp("merchant_created_at", { withTimezone: true }),
    verdict: text("verdict").notNull().default("review"),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    products: jsonb("products").$type<Record<string, number>>().notNull().default({}),
    profileVersion: text("profile_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("source_quality_profiles_verdict_idx").on(table.verdict, table.computedAt),
  ],
);

export const llmExtractionCandidates = pgTable(
  "llm_extraction_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawOfferSnapshotId: uuid("raw_offer_snapshot_id").notNull().references(() => rawOfferSnapshots.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    candidate: jsonb("candidate").$type<Record<string, unknown>>().notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    status: text("status").notNull().default("candidate"),
    createdAt,
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("llm_extraction_snapshot_model_prompt_uidx").on(table.rawOfferSnapshotId, table.model, table.promptVersion),
    index("llm_extraction_status_idx").on(table.status),
  ],
);

export const sponsorshipPlacements = pgTable(
  "sponsorship_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    position: text("position").notNull(),
    label: text("label").notNull().default("赞助"),
    destinationUrl: text("destination_url").notNull(),
    imageUrl: text("image_url"),
    disclosure: text("disclosure").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("draft"),
    createdAt,
    updatedAt,
  },
  (table) => [index("sponsorship_active_idx").on(table.status, table.position, table.startsAt, table.endsAt)],
);

export const siteAnnouncements = pgTable(
  "site_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    badge: text("badge").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    actionLabel: text("action_label").notNull(),
    destinationUrl: text("destination_url").notNull(),
    kind: text("kind").notNull().default("update"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [index("site_announcements_public_idx").on(table.status, table.sortOrder, table.updatedAt)],
);

export const siteAnnouncementSettings = pgTable("site_announcement_settings", {
  key: text("key").primaryKey().default("global"),
  rotationEnabled: boolean("rotation_enabled").notNull().default(true),
  rotationIntervalSeconds: integer("rotation_interval_seconds").notNull().default(4),
  updatedAt,
});

export const systemMetricSamples = pgTable(
  "system_metric_samples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    service: text("service").notNull(),
    metric: text("metric").notNull(),
    value: numeric("value", { precision: 24, scale: 6 }).notNull(),
    unit: text("unit").notNull(),
    labels: jsonb("labels").$type<Record<string, string>>().notNull().default({}),
    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("system_metric_service_metric_time_idx").on(table.service, table.metric, table.sampledAt)],
);

export const errorEvents = pgTable(
  "error_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    service: text("service").notNull(),
    operation: text("operation").notNull(),
    errorCode: text("error_code").notNull(),
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("error_events_service_time_idx").on(table.service, table.occurredAt)],
);

export const operatorJobRequests = pgTable(
  "operator_job_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull(),
    reason: text("reason").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    createdAt,
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("operator_job_requests_status_idx").on(table.status, table.createdAt)],
);

// Collection attempts are separate from prices: a missing SKU must never become a zero price.
export const officialSubscriptionChecks = pgTable("official_subscription_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  planCode: text("plan_code").notNull(),
  vendor: text("vendor").notNull(),
  channel: text("channel").notNull(),
  countryCode: text("country_code").notNull(),
  status: text("status").notNull(),
  reason: text("reason").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  httpStatus: integer("http_status"),
  finalUrl: text("final_url"),
  parsedCount: integer("parsed_count"),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("official_subscription_checks_identity_uidx").on(table.vendor, table.planCode, table.channel, table.countryCode)]);

/** 各来源（Apple 商店、Google 官网、OpenAI 官网）逐国家的可用性登记，用于枚举与复扫。 */
export const officialStorefronts = pgTable(
  "official_storefronts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    countryCode: text("country_code").notNull(),
    storefront: text("storefront"),
    currency: text("currency"),
    status: text("status").notNull().default("unknown"),
    detail: text("detail"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastAvailableAt: timestamp("last_available_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("official_storefronts_source_country_uidx").on(table.source, table.countryCode),
    index("official_storefronts_source_status_idx").on(table.source, table.status),
  ],
);
