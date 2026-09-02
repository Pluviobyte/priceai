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
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [index("source_candidates_status_idx").on(table.status)],
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
