# Historical Progressive Replay V1

P2.3 introduces an isolated historical progressive replay contract for Pick Analyzer V2.

Replay answers: how a selected frozen engine and feature contract would have performed if historical games were evaluated sequentially using only stored evidence available before cutoff.

## Contract

- Scope: `REPLAY`.
- Supported companion scopes: `BACKTEST`, `SHADOW_REPLAY`.
- Forbidden scopes: `CURRENT_V2_PRODUCTION`, `LEGACY_PRE_V2`.
- Engine version: `historical_progressive_replay_v1`.
- Feature version: `historical_prediction_snapshot_lineage_pilot_v1`.
- Policy version: `p2_3_frozen_engine_replay_policy_v1`.
- Storage: replay-only rows in `universal_projection_history` with `projection_family = historical_progressive_replay_v1`.
- Checkpoint: `historical_import_checkpoints.checkpoint_key = p2_3_historical_progressive_replay_v1:bounded`.
- Job ledger: `sports_sync_jobs.job_type = historical_progressive_replay_v1`.

## Sequence

1. Load settled non-production historical validation rows from `prediction_history`.
2. Select events by `commence_time` ascending and stable event id.
3. Select one canonical prediction per event-market for Moneyline, Spread/Run Line and Total.
4. Load linked `sport_events`, `historical_feature_snapshots` and `sports_odds_snapshots` rows.
5. Enforce stored odds timestamp before cutoff.
6. Enforce feature `as_of_timestamp` before or equal to cutoff.
7. Reject leakage-risk rows before replay persistence.
8. Persist replay-only projection rows.
9. Store cumulative metrics before and after each replay prediction.
10. Update checkpoint and job status.

## Isolation

Replay never writes `prediction_history`, Current Board, Official Picks, production settlement, production learning, model weights, scheduler cadence or provider budgets. Replay reads stored data only and records provider calls as zero.

## Bounded Execution

P2.3 execution is capped at 10 events per run and 3 canonical replay predictions per event. Broad season replay remains out of scope.

## APIs

- `GET /api/operations/historical-replay` returns read-only status, metrics, checkpoint, latest job and recent rows.
- `POST /api/operations/historical-replay` runs dry-run by default. `dryRun=false` requires `CRON_SECRET` authorization.
- `GET /api/operations/historical-replay/jobs/[id]` returns the selected job-scoped status view.

## Performance

`/api/performance` now exposes `replayPerformance` as a separate read-only mode. Current Era trust, accuracy and readiness remain unchanged and exclude replay rows.
