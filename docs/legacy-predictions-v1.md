# Legacy Predictions V1

## Scope

Legacy Prediction Provenance V1 identifies the remaining unresolved `prediction_history` rows that look like pre-canonical automated prediction capture output. It does not delete rows, recover events, import provider data, settle predictions, backfill history, train models or promote recommendations.

## Evidence

- Writer lineage: commit `8efaab640854694c15ac2b44b69f67fa0c4aaeec` (`8efaab6`), `Add automated prediction capture and analytics dashboard`, introduced `src/services/prediction-capture.service.ts`, `src/services/prediction.service.ts` and `src/services/prediction-history.service.ts`.
- Provider-shape lineage: legacy rows use 32-character provider game IDs, `sport_key` values from The Odds API, `moneyline` markets and sportsbook names such as `DraftKings`, `FanDuel` and `MyBookie.ag`.
- Canonical-event timeline: `sport_events` was introduced by `supabase/migrations/202607110001_nba_data_sync_v1.sql`; most unresolved rows were created before that canonical event table existed.
- Data lineage gaps: legacy rows lack `model_version`, `feature_snapshot_id`, `odds_snapshot_id`, `operating_day_id` and `idempotency_key`.
- Production flag: legacy rows are `production_eligible=false`.

## Classification

Rows matching the legacy writer/provider shape and lineage gaps are classified as `LEGACY`, not production. They remain available to audit, immutable history, replay and backtest forensics, but are excluded from production-qualified performance, settlement backlog, ROI, accuracy, calibration, trust and official-pick readiness.

## API

- `GET /api/predictions/provenance`
- `GET /api/predictions/provenance?validate=true`

Both paths are read-only and report `providerCallsMade=0` and `remoteMutationsMade=0`.

## Guardrails

- No prediction rows are deleted.
- No event links are manufactured.
- No stored stats, odds, recommendations, settlement or Current Board behavior is changed.
- The `recommended_pick` flag on a legacy row is not treated as an official pick.
