# Historical Feature Trial Lineage Pilot V1

## Status

Implemented as a bounded, trial-only operational contract on the existing `/api/features/store` route. It adds no routes, makes zero provider calls and does not create production recommendations.

## Route Action

`POST /api/features/store`

Action: `historical_prediction_snapshot_lineage_pilot`

Caps:

- maximum snapshots considered: 15
- maximum predictions persisted: 5
- maximum one prediction per snapshot
- concurrency: 1
- retries: 0
- trial only
- production eligible: false

## Validation Result

Initial runtime validation on 2026-07-14 considered the 15 existing NBA trial historical feature snapshots and found 0 eligible prediction-link candidates because the snapshots lacked genuine offered prices.

Initial blocker:

- `missing_genuine_offered_price`: 15

The current `prediction_history.odds` column is not nullable. Because the trial snapshots do not contain genuine stored offered prices, persisting prediction rows would require fabricated odds. The pilot therefore stops with `no_eligible_candidates`.

After the corrected SportsDataIO `GameOddsByDate/2025-12-26` retry and legacy-moneyline cleanup, five odds-enriched trial feature snapshot versions were available. The lineage selector now loads a bounded local pool, prioritizes snapshots with genuine odds, and still considers at most 15 snapshots for the pilot.

Corrected verification result:

- provider calls: 0
- snapshots considered: 15
- eligible snapshots: 5
- predictions inserted on first run: 5
- predictions reused on immediate rerun: 5
- rejected predictions: 0
- duplicate prediction identities: 0
- duplicate snapshot links: 0
- trial predictions: 5
- production-eligible predictions: 0
- production recommendations: 0
- settlement attempted: 5
- settled: 5
- wins: 3
- losses: 2

## Priced Odds Follow-Up

The 2026-07-14 SportsDataIO `GameOddsByDate/2025-12-26` pilot confirmed HTTP 200 priced payload access and persisted trial-only odds rows. The approved cleanup deleted 936 alternate-like rows and retained 540 full-game `PregameOdds` rows.

The approved corrected one-call retry then inserted 180 null-line moneyline replacements, updated 360 spread/total rows and completed sync job `ed7ede3c-38c9-4f4f-b56b-446c43b8deb6`. The approved supersession cleanup deleted 180 legacy non-null-line moneyline rows after verifying 180 corrected replacements and no feature snapshot or prediction references.

Read-only cutoff comparison found 15 matching event/market snapshots and 15 valid cutoff-safe prices, including 5 corrected null-line moneyline prices. Five odds-enriched snapshot versions were created for the lineage pilot. Original snapshots were not mutated.

## Safety

- Provider calls: 0
- Prediction rows inserted: 5
- Prediction rows reused on rerun: 5
- Snapshot rows mutated: 0
- Settlement rows updated: 5
- Production recommendations created: 0
- ROI, CLV, calibration and model promotion remain blocked

## Cleanup Plan

No cleanup was executed.

If trial lineage data is later removed, use non-destructive review first and preserve referential integrity across:

- `prediction_history.feature_snapshot_id`
- `historical_feature_snapshots.id`
- `sport_events.id`
- `provider_entity_mappings`
- `sports_sync_jobs`

Candidate filters:

- `trial=true`
- `scrambled=true`
- `production_eligible=false`
- SportsDataIO provider/source metadata
- feature snapshot linkage
- prediction linkage
- sync job IDs in metadata where present
