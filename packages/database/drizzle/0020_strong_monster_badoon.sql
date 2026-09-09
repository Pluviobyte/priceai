CREATE TABLE "collector_platform_state" (
	"key" text PRIMARY KEY NOT NULL,
	"waf_streak" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"next_request_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"budget_day" date DEFAULT (now() at time zone 'UTC')::date NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"last_served_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Recover only automatic WAF reviews, preserving prior evidence for inspection.
-- Ordinary/manual reviews and non-WAF failures are not touched.
WITH parked AS (
  UPDATE source_candidates SET status='blocked_egress', next_vet_at=now()+interval '24 hours',
    vetting_result=vetting_result || jsonb_build_object('previousAttempts',vetting_result->'attempts','attempts',0,'migration','platform-policy-0020')
  WHERE status='review' AND vetting_result->>'version' LIKE 'vetting-%'
    AND (vetting_result->'reasons') @> '["max_attempts_reached"]'::jsonb
    AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(case when jsonb_typeof(vetting_result->'reasons')='array' then vetting_result->'reasons' else '[]'::jsonb end) r
      WHERE r LIKE 'source_access_challenge:%' OR r LIKE 'waf_challenge:%')
  RETURNING id
)
INSERT INTO audit_logs(actor_id,action,target_type,target_id,reason,before_value,after_value)
SELECT 'automatic_vetting','source_candidate.blocked_egress','source_candidate',id::text,
  'migrate automatic WAF retry exhaustion to scheduled recovery', '{"status":"review"}'::jsonb,
  '{"status":"blocked_egress","migration":"0020"}'::jsonb FROM parked;
--> statement-breakpoint
-- Historical recent WAF evidence bootstraps a cooldown, so the backlog does not
-- need another sweep to rediscover an already observed platform challenge.
INSERT INTO collector_platform_state(key,waf_streak,blocked_until)
SELECT CASE WHEN lower(split_part(split_part(candidate_url,'://',2),'/',1)) IN
  ('wzyp.cn','www.wzyp.cn','pay.ldxp.cn','www.ldxp.cn','ldxp.cn') THEN 'ldxp_shop_api'
  ELSE 'host:' || lower(split_part(split_part(candidate_url,'://',2),'/',1)) END,
  count(*)::int, now()+interval '24 hours'
FROM source_candidates
WHERE status='blocked_egress' AND vetted_at > now()-interval '24 hours'
  AND vetting_result->>'migration'='platform-policy-0020'
GROUP BY 1 HAVING count(*) >= 3
ON CONFLICT DO NOTHING;
