# Official data recovery — first release

Scope agreed on 2026-09-23: repair Claude Pro monthly/annual and Max 5x/20x
web references using explicit official billing evidence; read xAI pricing once
through the existing browser with its HTML structure preserved; label homepage
counts as quotes of the same delivery mode, and explain missing official baselines.

Do not infer monthly billing from App Store amounts or convert a “From” price to
an exact price. Failed retrieval/parse must not advance verifiedAt. Browser reads
must be bounded, share one request per source, and leave existing OpenAI behavior
unchanged. Hostinger single-request preflight returned HTTP 200 and parsed xAI
30/100 USD per month. Claude's three current official pages parsed 20/200/100/200.

Transit catalogs run serially under their own advisory lock, independently of the
long subscription sweep. Daily success interval and failed-attempt backoff must
survive restarts. Invalid/missing prices are not zero; report skipped models.
Command failures must be visible. Do not claim public catalog access tests paid
inference or provider reliability.

Static API prices are historical seeds, never a live refresh. Only an explicit
verified date is a verification date; effective/updated dates are insufficient.
Never replace existing prices with seeds. No production historical seed import
is part of this release. A live official API collector is a separate follow-up.

Keep discovery expansion, old database recovery, human-decision migration and
retention maintenance outside this release. Preserve all existing resource limits.
Build in CI only; DMIT deployment remains gated off. Deploy Hostinger Web and
Official Worker only, retaining database, Channel Worker and tunnel containers.
Inspect other running services and host resources before and after each step.

Validation: real-page Claude parsing, parser negative cases, local isolated
PostgreSQL tests for evidence freshness and transit locking/due checks, typecheck,
full unit suite, production build and two-axis code review. Public website and
production database acceptance must be recorded separately from local results.
