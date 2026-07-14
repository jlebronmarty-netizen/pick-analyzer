# NBA Backtesting & Calibration V1

Update 2026-07-14: NBA backtest and calibration responses now apply Production Data Gate V1 to production summaries. Trial/scrambled rows remain visible only in explicit `trialTechnicalValidation` sections and are excluded from production ROI, calibration, model promotion and recommendation evidence.

NBA Backtesting & Calibration V1 measures NBA prediction quality from stored `prediction_history` rows. It does not train a model and does not write synthetic results.

## Scope

- Computes NBA backtest summaries from existing prediction records.
- Measures win rate, ROI, profit, units, Brier score, average probability, confidence, edge and EV.
- Segments performance by market, model version, confidence bucket and data sufficiency bucket.
- Builds moneyline calibration buckets from settled NBA rows.
- Checks timestamp leakage risk using `cutoff_at`, `generated_at`, `odds_timestamp` and `commence_time`.
- Exposes shared `backtestInputReadiness` from Historical Feature Generation Orchestrator V1.
- Exposes `featureSnapshotEligibility` so durable feature lineage blockers are explicit.
- Reports durable feature snapshot counts by total, trial, production-eligible, linked predictions, settled linked predictions, ROI eligibility and CLV eligibility.
- Reports missing model version and feature snapshot counts.
- Returns typed empty responses when no settled NBA predictions exist.

## APIs

- `GET /api/nba/predictions/backtest`
- `POST /api/nba/predictions/backtest/run`
- `GET /api/nba/predictions/calibration`

Supported query parameters:

- `dateFrom`
- `dateTo`
- `market`
- `modelVersion`
- `recommendedOnly=true`

`POST /api/nba/predictions/backtest/run` uses the existing `CRON_SECRET` authorization pattern. It currently computes on demand and returns `persisted: false`.

## Dashboard

`NbaBacktestingCalibrationPanel` is included in the NBA dashboard section. It shows:

- sample size
- settled record
- ROI
- Brier score
- calibration status and buckets
- leakage checks
- metadata quality warnings
- market backtest splits

## Persistence

No migration is required for V1. The module reads from `prediction_history`, including metadata added by NBA Prediction Validation & Settlement V1.

Durable historical feature snapshots use migration `202607140001_historical_feature_snapshots_v1.sql`, which is verified by runtime schema probing rather than migration-file presence. The bounded NBA trial write pilot inserted 15 trial snapshots and reused all 15 on rerun, but real production backtesting, ROI, CLV and calibration remain blocked when rows lack `feature_snapshot_id` lineage, when feature snapshots were generated after prediction time, when offered price is missing, when CLV lacks a genuine closing snapshot, or when trial/scrambled rows are involved.

The corrected trial lineage pilot first reported 5 linked trial predictions after odds-enriched snapshot versions were created from corrected SportsDataIO prices. NBA Trial Validation Batch V1 then scaled the same path to 27 linked, settled trial predictions across moneyline, spread and total. Backtest readiness counters distinguish linked, unlinked, trial-linked, production-linked, ROI-eligible, calibration-eligible and CLV-eligible rows, with trial and missing-closing-snapshot blockers reported separately.

The 2026-07-14 SportsDataIO `GameOddsByDate` priced pilot persisted trial-only odds rows. The approved cleanup removed 936 alternate-like rows, the corrected retry inserted 180 null-line moneyline replacements, and the supersession cleanup removed 180 legacy non-null-line moneylines. Batch V1 produced a technical trial-only backtest sample of 27 settled rows: 9 moneyline, 9 spread and 9 total. These rows do not create production ROI, calibration or CLV eligibility.

Batch V1 technical trial summary from `/api/nba/predictions/backtest`:

- settled rows: 27
- wins/losses/pushes/voids: 9 / 18 / 0 / 0
- win rate: 33.33%
- trial units: -4.49
- Brier score: 0.2896
- rows eligible for production ROI/calibration/CLV: 0

## Validation

When no settled NBA predictions exist, the APIs should still return:

- `success: true`
- zero sample counts
- `INSUFFICIENT_DATA` calibration status
- warnings explaining the insufficient sample

No provider data is fabricated for backtesting.
