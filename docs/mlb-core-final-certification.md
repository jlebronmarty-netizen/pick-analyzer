# MLB Core Final Certification

Certification: `MLB_CORE_PRODUCTION_PASS`

Premium classification: `MLB_PREMIUM_PROVIDER_BLOCKED`

Date: 2026-07-21

## Architecture

MLB Core remains on the existing Pick Analyzer architecture:

- SportsDataIO and MLB Stats API provider paths use existing budget guards, sync jobs, normalized tables and operational routes.
- Prediction, recommendation, Current Board, Official Pick, settlement, calibration and scheduler contracts are preserved.
- Feature Store and model-readiness audits are additive and read-only.
- Historical import durability uses `sports_sync_jobs` checkpoints before provider transport and terminal status reporting after execution returns.

## Verified Routes

- `/api/system/version`
- `/api/operations/validation`
- `/api/providers/budget/status`
- `/api/historical-import/jobs`
- `/api/mlb/historical-backfill/player-game-stats`
- `/api/mlb/current-season/data-quality`
- `/api/mlb/features/model-readiness`
- `/api/mlb/model-audit`
- Existing MLB data-quality, feature store, Current Board, Today, odds coverage, provider capability and observability routes remain preserved.

## Production Evidence

Latest production code smoke reported:

- Environment: production.
- Deployed behavior commit: `c9534afa275743a071bff0f9a2f92e12326a7c01`.
- Operations Validation: PASS.
- Provider calls during read-only final smoke: 0.
- Remote mutations during read-only final smoke: 0.
- Provider budget: AVAILABLE and VALID.
- Accounting uncertainty: false.
- Calls made today: 8.
- Calls made last hour: 0.
- Hourly remaining: 12.
- Hard remaining: 1492.
- Historical jobs: 100 checked, 0 running, 0 pending, 0 stuck, 0 reconciliationRequired.

## Season Coverage

MLB current-season player game stats are certified complete by the backfill planner:

- Eligible dates: 110.
- Completed checkpoints: 113.
- Remaining dates: 0.
- Ambiguous checkpoints: 0.
- Active jobs: 0.

The data-quality audit reported:

- Player game stat rows: 44,459.
- Imported player-stat dates: 114.
- Missing player-stat dates: 0.
- Event mapping rate: 100%.
- Team mapping rate: 100%.
- Duplicate stat row IDs: 0.

## Quality Metrics

Current-season data quality:

- Overall MLB data readiness: 79.64 / GOOD.
- Exact player identity resolution: 71.2%.
- Unresolved player stat rows: 12,806 across 656 provider player IDs.
- Natural-key collision candidates: 244.
- Odds rows: 46,002.
- Odds coverage: 62.69%.
- Opening odds rows: 0.
- Closing odds rows: 0.

Unresolved player rows remain preserved and reviewable. Fuzzy identity resolution remains forbidden.

## Model Sample Metrics

Feature/model readiness:

- Status: PASS_WITH_CAVEATS.
- Feature Store status: ready.
- Feature Store validation: true.
- Compatible prediction snapshots inspected: 50.
- Feature quality: 72.
- Data sufficiency: 68.
- Critical completeness: 60.

Model audit:

- Certification: `MLB_MODEL_AUDIT_PASS_INSUFFICIENT_SAMPLE`.
- Prediction rows: 909.
- Settled rows: 593.
- Leakage-safe immutable-snapshot eligible rows: 0.
- Official eligible audit rows: 0.
- Post-start settled rows excluded: 561.
- Settled rows missing immutable feature snapshots excluded: 548.
- Duplicate prediction key review candidates: 282.
- Calibration status: `INSUFFICIENT_SAMPLE_FOR_THRESHOLD_CHANGE`.

No calibration, threshold, Official Pick, Current Board, settlement or scheduler change was made.

## Blocked Premium Features

These do not block MLB Core and remain classified as `MLB_PREMIUM_PROVIDER_BLOCKED`:

- player props
- live betting
- advanced pitch tracking
- verified injuries
- expected lineups
- advanced weather
- robust CLV
- steam moves
- arbitrage
- multi-book premium market intelligence

## Operating Procedures

- Use read-only audits before any provider-touching action.
- Keep provider calls behind the existing budget guard and durable sync jobs.
- Use one-date child imports for historical player game stats.
- Treat batch boundaries and hourly budget pauses as resumable progress only when checkpoints are terminal and unambiguous.
- Do not retry ambiguous provider calls.
- Preserve provisional unresolved player identities until exact trusted mapping or manual/admin approval exists.

## Failure Recovery

- `sports_sync_jobs` is the durable operational ledger.
- Stuck/ambiguous historical import jobs are visible through `/api/historical-import/jobs`.
- `canceled` and `timed_out` terminal statuses are supported in production.
- Reconciliation must be explicit and read-only first.
- Data repairs may only be deterministic, additive and non-destructive.

## Provider Budget Policy

Final smoke confirms SportsDataIO budget accounting is AVAILABLE, configuration is VALID, uncertainty is false and no provider calls were made by certification routes.

## Scheduler Behavior

Existing scheduler and operating-day behavior remain unchanged. The final certification did not alter cron cadence, adaptive refresh behavior, Current Board generation, settlement timing or official recommendation policy.

## Known Caveats

- CLV and line movement are not certified because genuine opening and closing odds rows are absent.
- Player-level features must exclude unresolved rows or keep them low-confidence until exact trusted mapping exists.
- Natural-key collision candidates require review before high-confidence player-level player-stat features.
- Model audit sample is insufficient for calibration or threshold changes.
- Post-start historical prediction rows must be excluded from model-audit/backtesting cohorts.

## Next Roadmap Item

Proceed to BSN Source Inventory and Contract using legitimate, verifiable sources only.
