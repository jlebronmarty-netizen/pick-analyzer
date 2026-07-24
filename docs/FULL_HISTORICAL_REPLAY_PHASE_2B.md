# Full Historical Replay Phase 2B

Date: 2026-07-24
Starting commit: `e4f2265f558cb3800e43850521abe65db14f0475`

## Scope

Full Historical Replay Phase 2B executed the completed Retrosheet Historical Feature Store over the supported 2025 MLB historical scope. It reused stored point-in-time `historical_feature_snapshots`, generated replay-only rows in `universal_projection_history`, settled replay outcomes from stored final scores and created replay-only learning labels in projection metadata.

No provider data was fetched. No sportsbook prices were fabricated. Historical EV was not calculated because the replay path does not have complete historical sportsbook odds for these games.

## Implementation

- Service: `src/services/historical-replay-pilot.service.ts`
- CLI: `npm.cmd run historical:replay:full -- --batch-size=50`
- Projection family: `retrosheet_historical_replay_phase_2b_v1`
- Model version: `retrosheet_historical_replay_phase_2b_v1`
- Checkpoint: `historical_import_checkpoints.checkpoint_key=retrosheet_historical_replay_phase_2b_v1:full_scope`
- AI Operations: `/ai-operations` and `/api/ai-operations/lifecycle`

The first attempted full run stopped before replay row insertion because `checkpoint_level='replay'` violated the existing `historical_import_checkpoints` constraint. The runner was corrected to reuse the existing allowed `validation` checkpoint level, matching the controlled pilot pattern. No destructive migration was introduced.

## Full Run

- Job: `9103554b-0c20-4b21-8c20-235c55f2e011`
- Games total: 2,430
- Games completed: 2,430
- Replay predictions: 7,290
- Replay settlements: 7,290
- Replay labels: 7,290
- Markets: moneyline, spread/run line, total
- Batches: 49
- Batch size: 50
- Snapshot lookups: 211,410
- Inserted replay artifacts: 7,290
- Reused replay artifacts: 0
- Duplicate deterministic IDs: 0
- Leakage failures: 0
- Provider calls: 0
- Production `prediction_history` count: unchanged at 1,020
- Current production predictions: unchanged at 0
- `model_weight_history` count: unchanged at 41

## Idempotency Rerun

- Job: `a6e03b64-99b0-40ad-a840-ca5c38bb2067`
- Games total: 2,430
- Games completed: 2,430
- Replay predictions: 7,290
- Replay settlements: 7,290
- Replay labels: 7,290
- Inserted replay artifacts: 0
- Reused replay artifacts: 7,290
- Database replay-row writes: 0
- Duplicate deterministic IDs: 0
- Leakage failures: 0
- Provider calls: 0
- Production `prediction_history` count: unchanged at 1,020
- Current production predictions: unchanged at 0
- `model_weight_history` count: unchanged at 41

## Safety

- Replay artifacts are stored only in `universal_projection_history`.
- Production prediction history was not mutated.
- Current Board was not mutated.
- Official Pick policy was not mutated.
- Learning Brain weights were not mutated.
- Scheduler behavior was not mutated.
- Historical Feature Store rows were not mutated.
- No AI retraining or recalibration was executed.

## Certifications

- `FULL_HISTORICAL_REPLAY_PASS`
- `REPLAY_POINT_IN_TIME_PASS`
- `REPLAY_PRODUCTION_ISOLATION_PASS`
- `REPLAY_SETTLEMENT_PASS`
- `REPLAY_LABEL_PASS`
- `REPLAY_IDEMPOTENCY_PASS`
- `REPLAY_RESUME_PASS`
