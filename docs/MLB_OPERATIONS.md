# MLB Operations

Status: Production Stable
Version: MLB Production Complete v1.0.0

## Operating Workflow

The MLB operating workflow is organized around a Puerto Rico operating day and uses the existing operating-day services and routes.

Stages:

1. Schedule discovery and operating-day selection.
2. Next slate rollover.
3. Odds availability and refresh readiness.
4. Feature and prediction readiness.
5. Recommendation policy evaluation.
6. Current Board publication.
7. Results synchronization when games are terminal.
8. Scoped settlement.
9. Replay, calibration and learning readiness checks.

## Temporal Truth

MLB event time uses a single canonical contract:

- SportsDataIO MLB `Game.DateTime` and `GameInfo.DateTime` values without an offset are provider-local Eastern times and must be interpreted in `America/New_York`.
- Stored event starts and API timestamps are UTC instants with an explicit `Z` or offset.
- Dashboard/UI times are display conversions only and must not change betting, lifecycle or freshness meaning.
- Naive timestamps must not be parsed through the server or Vercel local timezone.
- Legacy SportsDataIO event rows are repaired at read time when metadata proves the row came from SportsDataIO and was not already normalized by `mlb_temporal_truth_v1`.

Lifecycle and eligibility are intentionally separate. Fresh official provider status has priority; time-only fallback may produce `PREGAME`, `STARTING_SOON` or `STATUS_UNCONFIRMED`, but it must not fabricate `LIVE`, `FINAL`, `POSTPONED` or `CANCELED`.

`/api/mlb/temporal-health` is the canonical zero-provider-call diagnostic for normalized starts, lifecycle distribution, eligibility distribution, freshness status, legacy repair count, stale status count, projection temporal integrity and adaptive refresh execution mode.

## Production Validation Snapshot

Production validation on 2026-07-18 confirmed:

- `/api/dashboard?mode=today&includeValidation=true`: HTTP 200, success true, providerCallsMade 0, remoteMutationsMade 0, officialPicks 0.
- `/api/current-board?includeValidation=true`: HTTP 200, success true, mode `current_board_intelligence_engine_v1`.
- `/api/operating-day/status`: HTTP 200, success true, providerCallsMade 0, officialPicks 0.
- `/api/operating-day/automation/status`: HTTP 200, success true, providerCallsMade 0, officialPicks 0.
- `/api/settlement/core`: HTTP 200, success true.
- `/api/model/learning`: HTTP 200, success true.
- `/api/model/calibration`: HTTP 200, success true.

## Operational Readiness

Ready:

- Dashboard status and Today contract.
- Current Board read path.
- Market opportunity read paths.
- Operating-day status.
- Automation status.
- Adaptive Operations status, data freshness, refresh plan and provider-budget forecast.
- Provider budget status.
- Feature Store status.
- Settlement core.
- Learning and calibration contracts.

Provider-limited:

- Confirmed lineups.
- Detailed injury feed.
- Some player importance inputs.
- Historical sample growth.
- Deeper bullpen workload sample.

Performance note:

Some heavy composite diagnostic routes can exceed a 30-second external smoke-test timeout. This is a known operational issue for internal summary endpoints, not a recommendation-policy blocker. Future work may optimize those summaries without changing architecture.

## Live Freshness Operations

Adaptive Operations V1 is the canonical visibility layer for live data readiness:

- Scheduler audit reads configured cron state and lifecycle events.
- Freshness policies separate fresh, aging, stale, pending, unavailable and unsupported inputs.
- Stale or missing odds are not actionable.
- Confirmed lineup absence is never inferred.
- Detailed injury diagnosis and expected return remain unavailable under the current provider plan.
- Provider-call forecasts are budget-aware and status reads make 0 provider calls.

The current production cron remains `/api/cron/operating-day`. Adaptive refresh execution is a plan-only bridge unless the existing operating-day executor is called through its protected route.
# Production Operations V1

Pick Analyzer now exposes `/api/operations/health` as the authoritative operational readiness surface.

Adaptive Refresh can execute due supported MLB work through the existing operating-day executor when called with `dryRun=false` and valid `CRON_SECRET` authorization. The scheduler remains the single Vercel cron on `/api/cron/operating-day`; intraday cadence requires the existing external scheduler fallback or protected manual execution.

Operations health reports provider budgets, freshness, Current Board state, projection state, settlement backlog, migration checks and exact blockers. It does not certify production-ready status merely because HTTP routes respond.
