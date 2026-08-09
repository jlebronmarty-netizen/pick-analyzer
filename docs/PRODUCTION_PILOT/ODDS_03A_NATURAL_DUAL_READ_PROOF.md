# ODDS-03A Natural Dual-Read Proof

Status: `ODDS_03A_REPOSITORY_REPAIR_READY_FOR_NATURAL_SCHEDULER_PROOF`

ODDS-03 deployed the primary odds authority framework at `STAGE_1_DUAL_READ`, but production observation showed zero natural The Odds API provider calls. ODDS-03A traced the protected production scheduler path and found the root cause: the event planner exposed Stage 1 metadata, but active refresh execution still called only the SportsDataIO canonical acquisition.

## Root Cause

`/api/cron/operating-day` delegates to adaptive refresh. The active market-refresh branch executed:

1. event refresh plan;
2. SportsDataIO canonical acquisition;
3. stored-odds prediction generation.

It did not invoke The Odds API acquisition, and planner metadata marked The Odds API `activeExecutionAuthorized = false`.

## Repair

The repair wires a bounded shadow-only The Odds API acquisition into the same protected scheduler branch after SportsDataIO canonical acquisition.

- One league-wide MLB odds request.
- Uses only `THE_ODDS_API_KEY`.
- Does not read or replace legacy `ODDS_API_KEY`.
- Maps provider events to canonical `sport_events`.
- Stores rows in `sports_odds_snapshots` as shadow/non-authoritative evidence.
- Writes provider accounting to `sports_sync_jobs`.
- Keeps SportsDataIO as product odds authority.
- Filters Current Board product odds to the configured product authority provider.

## Safety

No prediction formulas, model weights, Official Pick thresholds, settlement rules, learning logic, provider budgets, scheduler cadence, HR-03 behavior, Current Era boundaries, or replay isolation were changed.

Certification validators make zero provider calls and zero database mutations. Natural production proof still requires a later Vercel scheduler execution after deployment.

## Current Classification

`ODDS_03A_REPOSITORY_REPAIR_READY_FOR_NATURAL_SCHEDULER_PROOF`
