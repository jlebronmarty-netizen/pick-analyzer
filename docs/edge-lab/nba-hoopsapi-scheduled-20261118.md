# NBA HoopsAPI: controlled automatic quote archive (2026-11-18)

## Scope
Add **one** independent native Vercel Cron Job (11 current including HoopsAPI) to Pick Analyzer. Existing 10 cron routes, GOAT NBA feeds, predictions, model weights, official picks, outcomes, other sports and production page routes are untouched.

Vercel team uses Pro. A single cron expression invokes GET /api/cron/nba-hoopsapi at:
- 15:15 UTC = 11:15 AM Puerto Rico
- 21:15 UTC = 5:15 PM Puerto Rico
- 23:15 UTC = 7:15 PM Puerto Rico
Puerto Rico does not observe daylight saving time.

Cron endpoint:
1. Requires the existing CRON_SECRET in the Authorization Bearer header, constant-time comparison, no query params, and VERCEL_ENV=production.
2. No outbound calls unless HOOPS_API_SCHEDULED_ENABLED=true, secret HOOPS_API_KEY is in Production, and HOOPS_API_ACCOUNT_SCOPE refers to the SAME ledger used in Preview.
3. Rejects a run outside a 20-minute window after the configured UTC scheduled minute.
4. Reads the most recent (within 120 minutes) BALLDONTLIE NBA schedule from existing Supabase archive and skips if no NBA games are scheduled for the current Puerto Rico calendar day and remain at least 5 minutes from tipoff. No new schedule provider call. Fail-closed on stale or missing archives.
5. Reads the quota ledger; skips if <=2 slots remain, blocked cooldown, uncertainty or disabled.
6. Uses a deterministic UUID request ID per account/slot. A separate claim_nba_hoopsapi_scheduled_capture_v1 RPC reserves atomically with an account row lock, maximum three scheduled attempts per Puerto Rico day, and two-allowance reserve floor.
7. Dispatches HoopsAPI once with the existing guarded snapshot service; archives exact raw payload, normalized Q1-Q4/H1-H2/FT quotes, SHA-256 and failure/429 evidence. No retry, synthetic prices, models or official picks.
8. Logs only safe status/counts/identifiers, never credentials or raw payload.

## Limitations
- Provider free account limit is 10 per rolling 24 hours. Up to 3 scheduled attempts per local day, with 2 allowances reserved for manual use. Existing manual calls can reduce scheduled attempts.
- The ledger covers this application only. Calls directly from the HoopsAPI dashboard or another integration are not counted; provider 429 is the final authority.
- The first 2026-11-18 17:57 AST call is recorded as external_observed, not a raw capture. The second 20:44 AST call is safely archived. No new HoopsAPI calls for this feature.
- FanDuel Puerto Rico jurisdiction and direct execution availability remain unverified; normalized quotes are research-only, no probabilities or EV.
- Vercel cron entries register on production releases. The new path is disabled by default even after merge, and GET in Preview is production-only.
- A new migration is additive to already isolated HoopsAPI tables; no GOAT table or official model schema mutation.

## Activation gates
- SQL additive migration: docs/edge-lab/nba-hoopsapi-auto-quota-20261118.sql. Run rollback-only fixture tests after migration.
- CI: both HoopsAPI preview and scheduler tests, hardcoded-key check, Next.js build and TypeScript validation.
- Production env: HOOPS_API_KEY sensitive, HOOPS_API_ACCOUNT_SCOPE=pick-analyzer-hoopsapi-free-primary, and HOOPS_API_SCHEDULED_ENABLED=false initially. Existing CRON_SECRET is reused.
- Merge reviewed PR, verify new production cron endpoint responds SCHEDULE_DISABLED with zero provider calls; then set HOOPS_API_SCHEDULED_ENABLED=true (requires new production deployment or platform config refresh where applicable) only after reviewing Vercel costs and readiness.
- Observe next scheduled run and inspect archive, quota, and existing crons. Do not manually force off-schedule provider calls.
