# NBA Prediction Validation & Settlement V1

NBA Prediction Validation & Settlement V1 adds production guardrails around the NBA Prediction Engine V1 without introducing a new model.

## Scope

- Validates NBA prediction candidates before persistence.
- Stores lifecycle, model version, cutoff timestamp, odds timestamp, line, feature snapshot and validation warnings.
- Settles moneyline, spread, total, first-half total and first-half spread markets.
- Computes NBA prediction performance, ROI, Brier score, calibration and market splits.
- Adds NBA Model Health V2 checks for stale odds, missing line, missing event, duplicate keys, leakage risk, incomplete snapshots and settlement backlog.

## Lifecycle

Predictions move through:

- `generated`
- `active`
- `skipped`
- `closed`
- `settled`
- `void`

Runtime validation persists only `active` rows. Skipped rows are returned by validation APIs and are not saved by the generator.

## APIs

- `POST /api/nba/predictions/validate`
- `POST /api/nba/predictions/settle`
- `POST /api/nba/predictions/settle/event/[eventId]`
- `GET /api/nba/predictions/performance`
- `GET /api/nba/predictions/model-health`
- `GET /api/nba/predictions/settlement-backlog`

Protected POST routes use the existing `CRON_SECRET` authorization pattern.

## Settlement Rules

- Full-game markets use final `sport_events.home_score` and `sport_events.away_score`.
- Full-game settlement includes overtime.
- First-half markets use first-half period scores when present, or the first two quarter scores from `sport_game_stats`.
- Cancelled events are void.
- Postponed, live, scheduled or incomplete events remain pending.
- Manual adjustments and already-final predictions are not overwritten.
- Trial lineage settlement may grade only bounded trial rows when deterministic event results exist. Missing offered prices are not backfilled; ROI remains ineligible and profit is not fabricated.

## Database

Migration `202607110003_nba_prediction_validation_settlement_v1.sql` adds NBA prediction metadata to `prediction_history`.

Migration `202607140001_historical_feature_snapshots_v1.sql` adds durable feature-snapshot lineage columns. The bounded trial lineage pilot requires `feature_snapshot_id`, `feature_snapshot_key`, `feature_set_version`, `feature_snapshot_generated_at`, `trial`, `scrambled` and `production_eligible` to be preserved on any linked prediction row.

Apply it after the NBA Data Sync migrations:

```bash
supabase db push
```

Or paste the migration SQL into the Supabase SQL Editor for the project.
