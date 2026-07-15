# MLB Historical Recommendation Replay V1

Status: completed for the existing July 12, 2026 quarantined validation batch.

## Scope

- Data source: stored `prediction_history`, `historical_feature_snapshots` and `sport_events`.
- Provider calls: 0.
- Remote mutations: 0.
- API routes added: 0.
- Existing API extended: `GET /api/predictions/by-sport`.
- Existing dashboard section extended: MLB Prediction Engine panel.

The replay requires explicit historical validation parameters:

```text
/api/predictions/by-sport?sport=baseball_mlb&historicalValidation=true&validationMode=quarantined&date=2026-07-12
```

Default production-facing calls to `/api/predictions/by-sport`, `/api/predictions/top`, daily report, analytics, bankroll, portfolio and AI Coach remain filtered to production-eligible rows.

## Replay Contract

The replay exposes only curated prediction and lineage fields:

- event ID, matchup and scheduled start
- market, selected side, line and offered American odds
- predicted probability, implied probability, confidence, edge and EV
- feature snapshot ID, model version and feature-set version
- prediction timestamp, cutoff timestamp and odds timestamp
- sportsbook
- final score, settlement result, stake/profit and technical units
- `trial=false`, `scrambled=false`, `production_eligible=false`, `quarantined=true`
- compact explanation factors from linked pregame snapshot lineage
- recommendation status at prediction time
- current shared-policy status and qualification blockers
- whether the row would pass current official-pick policy

The replay does not expose raw provider payloads, secret values, production labels or unsupported feature claims.

Replay rows are analyzed technical validation rows, not official picks. Negative-edge,
negative-EV, low-confidence, low-quality or low-sufficiency rows remain visibly
not recommended even if their final result was a win. Final outcome never changes
recommendation eligibility.

## Verified Counts

- Predictions: 45
- Events: 15
- Feature snapshots linked: 45
- Wins: 21
- Losses: 24
- Pushes: 0
- Voids: 0
- Brier score: 0.2512
- Production-eligible rows: 0
- Replay recommended rows: 0

By market:

| Market | Predictions | Result |
| --- | ---: | --- |
| Moneyline | 15 | 7-8 |
| Run line | 15 | 7-8 |
| Total | 15 | 7-8 |

## Dashboard

The existing MLB Prediction Engine panel now includes:

- heading: `MLB Historical Validation Replay - July 12, 2026`
- warning labels for real, quarantined, completed-game replay
- summary cards for predictions, wins, losses, win rate, units, Brier score and production leaks
- filters for market, result, confidence band and matchup
- sort modes for chronological, confidence, edge and wins/losses
- per-prediction before-game and after-game presentation
- user-friendly "Why this selection?" explanation
- advanced lineage collapsed behind details

The default sort is chronological so losing picks are not hidden or buried by a best-looking-results order.

## Explanation Policy

Explanations are built from linked pregame feature snapshot lineage and prediction fields. They can mention event context, odds position, line-movement rows represented in the snapshot, data quality, sufficiency and missing-data warnings.

They must not claim use of postgame stats, final scores, unavailable probable pitchers, weather, confirmed lineups, injury detail or bullpen workload as prediction inputs.
