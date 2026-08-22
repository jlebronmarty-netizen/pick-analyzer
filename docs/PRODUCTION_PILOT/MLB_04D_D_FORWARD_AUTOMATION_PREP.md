# MLB-04D-D Forward Automation Preparation

Classification: `MLB_04D_D_FORWARD_AUTOMATION_PREP_CERTIFIED`

MLB-04D-D prepares the future forward research lifecycle without activating it. It adds a planner/contract layer for `MORNING` capture, `FINAL_PREGAME` capture, frozen MLB-04C V2 scorecard ledgering and postgame research evaluation. It does not add a cron job, does not persist research rows, does not create observations, does not call providers and does not change product, settlement, prediction, learning, calibration, bankroll or notification behavior.

## Scheduler Inventory

| Job | Schedule | Route | Auth | Purpose | Provider Usage | DB Mutation Scope |
| --- | --- | --- | --- | --- | --- | --- |
| `vercel_operating_day_primary` | `7-57/10 * * * *` | `/api/cron/operating-day` | `CRON_SECRET` bearer/query guard | Existing primary operating-day planner | Existing planner actions only; Package D adds none | Existing lifecycle/sync/odds/result/settlement scopes |
| `github_operating_day_fallback` | `7-57/10 * * * *` | `/api/cron/operating-day?dryRun=false&scheduler=github-fallback` | `CRON_SECRET` workflow secret | Existing fallback execution path | Existing planner actions only; Package D adds none | Existing operating-day scopes |
| `github_operating_day_heartbeat` | `3,33 * * * *` | `/api/cron/operating-day?dryRun=true` | `CRON_SECRET` workflow secret | Read-only heartbeat evidence | Expected zero provider calls | Expected zero writes |
| `vercel_nba_current_era_shadow` | `*/30 * * * *` | `/api/cron/nba-current-era-shadow` | Protected NBA scheduler guard | NBA-only shadow canary scheduler | NBA-only | NBA-only shadow scope when separately authorized |
| `manual_master_sync` | manual | `/api/cron/master-sync` | `CRON_SECRET` | Legacy/manual master sync | Existing services only | Existing sync/learning scopes |
| `manual_daily_sync` | manual | `/api/cron/daily-sync` | `CRON_SECRET` | Manual daily pipeline | Existing services only | Existing daily pipeline scopes |
| `manual_capture_predictions` | manual | `/api/cron/capture-predictions` | `CRON_SECRET` | Manual prediction capture | None from Package D | Existing prediction capture scope |

No new schedule is registered by MLB-04D-D.

## Lifecycle

Future rows move forward only:

`SCHEDULED` -> `MORNING_CAPTURE_ELIGIBLE` -> `MORNING_CAPTURED` -> `FINAL_PREGAME_CAPTURE_ELIGIBLE` -> `FINAL_PREGAME_CAPTURED` -> `FROZEN_SCORECARD_READY` -> `LEDGER_FROZEN` -> `WAITING_FOR_CANONICAL_RESULT` -> `CANONICAL_RESULT_READY` -> `RESEARCH_EVALUATED` -> `COHORT_AGGREGATED`.

Fail-closed states include disabled automation, disabled capture/evaluation, missing authorization, post-start snapshots, duplicate snapshot defects, duplicate ledger defects, unavailable results, unpairable scorecards, provider budget blocks and unapproved provider needs. Existing observations are immutable; no state overwrites are allowed to improve old evidence.

## Scheduling Contracts

The `MORNING` and `FINAL_PREGAME` contracts reuse the MLB-04B temporal windows and deterministic snapshot identity. Repeated passes must reuse one existing row, create only when zero rows exist and stop if more than one matching row is found. Package D recommends `QUEUE_BASED` multi-event execution for future activation because it provides exactly-once identity, row-level failure isolation, bounded budget stops and resumable no-op behavior.

## Authorization

Scheduled execution must require `CRON_SECRET`, the existing `MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED=true` guard and future kill switches:

- `MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED`
- `MLB_MORNING_CAPTURE_ENABLED`
- `MLB_FINAL_PREGAME_CAPTURE_ENABLED`
- `MLB_RESEARCH_RESULT_EVALUATION_ENABLED`

All are default-false/unset. Missing authorization returns an auditable no-op, not a partial write.

## Provider Budget

Stored evidence is first. SportsDataIO is forbidden. Weather and injury providers are not approved. This preparation phase makes zero provider calls. Future MLB Official or The Odds API current-only use must be explicitly budgeted by the already-certified source layer and must fail closed rather than fabricate context.

## Frozen Context Compatibility

Future scorecards consume frozen fields only:

- `starterContext`
- `offenseRecentFormContext`
- `bullpenDirectionalInputs`
- source timestamps
- lineage
- blockers
- missing-state markers

The scorecard consumer remains `evaluateMlb04cR6FrozenSnapshotScorecard(...)` with `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2`.

## Ledger Decision

Activation requires a new additive research ledger table. `mlb_context_snapshots` stores frozen inputs, while `prediction_history` and product settlement tables have product semantics. The future ledger identity must include sport, event, snapshot type, snapshot id, market, selection, exact line, sportsbook, methodology version and scorecard version. Zero matching rows may create, one matching row reuses and more than one matching row fails closed.

No migration is applied in this phase.

## Result Evaluation

Postgame evaluation reads only stored `sport_events` and `game_results`. Result sync remains separate. Research settlement uses certified moneyline, run-line and total semantics in a local evaluator and does not call the broad product settlement route.

Metrics include wager result, flat 100-unit profit, raw/calibrated Brier, raw/calibrated log loss, Chat-Method directional result and scorecard completeness. The Chat-Method score is not a probability, so Chat Brier/log-loss are forbidden.

## Cohorts And Claims

Cohort checkpoints are `5`, `10`, `25`, `50` and `100`, segmented by market, methodology version and scorecard version. The Chat directional ratio must not be marketed as accuracy until sample size, completeness, market mix, outcome availability and no-leakage gates pass.

## Isolation

Package D does not change MLB-03, the raw model, calibrated model, Official Pick thresholds, product recommendations, learning, calibration, bankroll, notifications, props, NRFI/YRFI, NFL or NBA. Observations #1, #2 and #3 remain frozen with no retrospective enrichment.
