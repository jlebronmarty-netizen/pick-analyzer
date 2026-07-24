# Historical Replay IO Readiness & Controlled Pilot V1

Date: 2026-07-24

## Scope

This was a bounded Retrosheet replay pilot using the completed Historical Feature Store. It did not run full Historical Replay Phase 2B, did not replay all 2,430 games, did not recalibrate AI, did not modify production prediction history and did not modify current production predictions.

## Execution

- Pilot command: `npm.cmd run historical:replay:pilot -- --limit=12`
- Idempotency command: same command rerun once.
- Pilot games processed: 12
- Replay markets per game: Moneyline, Run Line/spread, Total
- Replay predictions: 36
- Replay settlements: 36
- Replay labels: 36
- Snapshot lookups: 1,044
- First run replay artifacts inserted: 36
- Second run replay artifacts inserted: 0
- Second run replay artifacts reused: 36
- Duplicate replay IDs: 0

## Isolation

Replay artifacts are stored only in `universal_projection_history` with projection family `retrosheet_replay_pilot_v1`. Replay checkpoints are stored under `historical_import_checkpoints` checkpoint key `retrosheet_replay_pilot_v1:bounded_sample`. Job evidence is stored in `sports_sync_jobs` under job type `retrosheet_historical_replay_pilot_v1`.

Production isolation checks passed:

- `prediction_history` count remained unchanged.
- Current production prediction count remained unchanged.
- `model_weight_history` count remained unchanged.
- Current Board, Official Picks, scheduler behavior, Historical Feature Store rows and production settlement logic were not mutated.

## Point-In-Time

Each replay row records:

- prediction timestamp
- historical snapshot timestamp
- cutoff timestamp
- game start proxy
- feature snapshot IDs
- settlement outcome
- replay-only calibration input

Snapshot and cutoff checks are stored in replay row metadata. Existing insufficient-prior-sample warnings remain warnings and do not cause future-data leakage.

## AI Operations

AI Operations now displays Replay Pilot status:

- games completed
- replay predictions
- replay settlements
- replay labels
- replay duration
- snapshot lookups
- idempotency status

## Certifications

- `REPLAY_IO_READINESS_PASS`
- `REPLAY_ISOLATION_PASS`
- `REPLAY_CHECKPOINT_PASS`
- `REPLAY_IDEMPOTENCY_PASS`
- `CONTROLLED_REPLAY_PASS`

## Stop Gate

Full Historical Replay Phase 2B remains approval-gated. No recalibration, market expansion or Learning Brain update is authorized by this pilot.
