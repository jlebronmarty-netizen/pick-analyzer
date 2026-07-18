# BSN Integration V1

BSN is now treated as a first-class registered sport with a conservative production-readiness contract. It is not promoted as betting-ready until approved source ingestion, odds coverage, score/stat coverage and calibration exist.

## Repository Audit

- Existing BSN routes existed under `/api/bsn/*`.
- Existing BSN services used `bsn_games`, `bsn_results` and a mock-odds V3 prediction path.
- Shared normalized basketball tables already exist: `sports_teams`, `sport_events`, `sport_standings`, `sport_game_stats`, `sport_players`, `sport_lineups` and `sports_odds_snapshots`.
- Shared systems reused: multi-sport registry, Provider Adapter SDK, Feature Store registry, Prediction Engine V7 readiness style, Confidence Engine V2 shape, Current Board blocker semantics, provider budget zero-call policy and normalized settlement primitives.
- No migration was added. The existing normalized NBA-era tables support BSN teams, games, results, standings, first-half points and quarter scores.

## Source Matrix

| Source | Status | Use | Risk |
| --- | --- | --- | --- |
| Official BSN website | Partial | Schedule, teams, recent results, leaders, venues | Public HTML only; no approved production API discovered |
| Official team sites | Degraded | Team-level context, venue/ticket context | Fragmented formats and varied terms |
| Stable public JSON feeds | Unknown | Future provider candidate | No stable documented feed approved |
| Existing provider compatibility | Unknown | Future odds/results candidate | BSN coverage not verified |
| Public score/standings sites | Blocked | Discovery only | Commercial/feed terms; not primary architecture |

Production ingestion remains blocked until a compliant feed, permissioned source or configured provider is approved.

## Capabilities

Capability statuses use `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`, `DEGRADED`, `BLOCKED` and `UNKNOWN`.

- Teams: `PARTIAL`
- Games: `PARTIAL`
- Results: `PARTIAL`
- Standings: `PARTIAL`
- Statistics: `PARTIAL`
- Players: `PARTIAL`
- Venues: `PARTIAL`
- Odds: `UNKNOWN`
- Lineups: `UNSUPPORTED`
- Injuries: `UNSUPPORTED`

## Implemented Surfaces

- `/api/bsn/capabilities`
- `/api/bsn/data-quality`
- `/api/bsn/sync`
- `/api/bsn/predictions`
- `/api/bsn/ai-coach`
- `/api/bsn/intelligence`
- `/api/bsn/features/validation`
- `/api/bsn/operations/readiness`
- `/api/bsn/admin/validation`
- `/api/bsn/current-board`
- `/api/bsn/analytics/readiness`

All new BSN surfaces make zero provider calls. `/api/bsn/predictions` now returns a V7 preflight and does not fabricate odds or write prediction history.

## Team Intelligence And Knowledge Engine

The provider-independent BSN basketball layer is prepared for:

- Team Rating
- Home Court Rating
- Travel Rating
- Momentum Rating
- Rest Rating
- Opponent Strength
- Recent Form Last 5/Last 10
- Home/Away Splits
- Playoff Pressure
- Series Pressure
- Close Game, Clutch, Fourth Quarter and Overtime context

These contracts are ready, but every value remains blocked until normalized schedule, result, standings, venue and game-stat history exists.

## Admin And Model Ops

Prepared but not executable:

- Manual game/result/odds/injury/lineup/note/override validation
- Audit-trail requirements
- Settlement contracts for moneyline, spread, total and first-half score basis
- Replay contract
- Calibration contract
- Learning contract
- Current Board empty-state contract
- Season, team, league, prediction, confidence and model dashboard contracts

Manual admin validation is dry-run only and refuses silent overwrites, official-pick mutation and write acceptance.

## Prediction And Confidence

BSN V7 is wired as a challenger-only preflight:

- Model version: `basketball_bsn_prediction_engine_v7`
- Feature version: `basketball_bsn_feature_set_v1`
- Model role: `challenger`
- Current champion promotion: disabled
- Official picks: blocked
- EV and Best Value: unavailable without verified odds

Confidence Engine V2 separates model, data, market and recommendation confidence. Missing odds, approved source ingestion, game stats, players, standings, calibration and shadow sample are explicit blockers.

## Known Limitations

- No approved live BSN feed is configured.
- No verified BSN odds source is configured.
- No official BSN source ingestion permission has been approved.
- No BSN calibrated historical sample exists.
- No injury, lineup or availability source exists.
- Quarter and first-half coverage depend on normalized `sport_game_stats` rows.

## Next Safe Phase

Approve or configure a compliant BSN source adapter. The first safe implementation target is a dry-run official-source parser or permissioned feed connector that normalizes teams, schedule and results into existing shared tables with provider mappings and zero prediction writes.
