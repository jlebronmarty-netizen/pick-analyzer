# Edge Lab restart — 2026-11-04

Owner approved fresh prospective history inside Pick. NHL is explicitly excluded and managed in a concurrent chat. Do not remove or modify its routes, models, schedules, schemas or deployments.

## Scope
Soccer: new isolated LaLiga-only first-seen forecast ledger for 1X2 and statistical total 2.5. Mathematical port of Soccer V0 constants with a separately versioned input contract. No odds are manufactured, no bets or ROI are generated. Statistical results are not sportsbook settlement. Insufficient warmup is an immutable abstention for this cohort. Identity or kickoff changes are disputes, not retroactive replacements.

TT and MLB Edge: pure mathematical modules and synthetic tests only; sources and gated production serving remain pending. NBA and NCAAB remain independent existing modules. NCAAF is not activated. No new empirical validation is claimed.

## Security
Five additive edge_lab_*_v1 tables in Pick, RLS enabled, no anon/authenticated table privileges; service SELECT/INSERT only for immutable sources/forecasts/outcomes, SELECT/INSERT/UPDATE only for runs/lock. Lease RPC SECURITY INVOKER with empty search_path and service-only execute. RLS-without-policies informational advisory is intentional for these server-only tables. Supabase advisor also reported unrelated existing issues; no global security certification is claimed.

/private generated deployment host/edge-lab is protected by existing Vercel authentication. Public canonical routes redirect without returning private records. API status and preview are read-only. The preview may query free sources but never insert forecasts. The cron requires CRON_SECRET and production runtime, not a share link. No secret values are retrieved or committed.

## Tests
Run `node --test tests/edge-lab.test.mjs`. Fixtures are synthetic. Live source probes, build readiness, database writes and actual cron completion must be documented separately. A deployed cron is not proof of execution.

## Operations
Pick schedule: :15 and :45 hourly. All existing schedules must remain unchanged. Each cycle ordinarily fetches one history CSV and nine daily scoreboards, plus outstanding settlement dates (24 date ceiling). Upper bounds and fail-closed errors prevent partial calendars from creating picks. Deduped original forecasts are never overwritten. The earlier Hub soccer scheduler has not been retired by this change; it must be assessed separately without touching NHL.

## Completion limits
The free Hub project has NOT been deleted or paused, its slot is NOT freed, and the previous unrecovered history is NOT called migrated. Read-only API failures are never shown as zero forecasts or an empty slate. Keep original Pick records and recovered private archives.
