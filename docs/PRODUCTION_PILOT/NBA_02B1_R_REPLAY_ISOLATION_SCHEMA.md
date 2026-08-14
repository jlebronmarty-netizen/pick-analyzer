# NBA-02B1-R Replay Isolation Schema Certification

Status: NBA_02B1_REPLAY_ISOLATION_MIGRATION_BLOCKED

NBA-02B1-R prepared the additive replay-origin migration and replay canary persistence path, but did not apply production DDL because this local environment does not have a safe migration execution channel.

## Migration

- File: `supabase/migrations/202608140001_nba_replay_isolation_prediction_origin_v1.sql`
- Applied: no
- Existing rows modified: 0
- RLS changed: no
- Replay origin: `HISTORICAL_REPLAY_SHADOW`
- Indexes: one replay-origin lookup index plus certification lookup/metadata indexes

## Writer

The NBA-02B1 canary runner now supports explicit `--persist` mode. Default execution remains no-write. Persisted replay rows are designed to use deterministic IDs and carry `production_eligible=false`, `recommended_pick=false`, `is_current=false`, `model_role=shadow`, `result=pending`, and explicit `prediction_origin=HISTORICAL_REPLAY_SHADOW`.

## Canary

- Games: 24
- Predictions planned: 96
- Predictions inserted: 0
- Predictions reused: 0
- Wrong origin count: 0
- Settlement preview: 52 wins, 44 losses, 0 pushes, 0 blocked

## Safety

- BallDontLie calls: 0
- The Odds API historical calls: 0
- SportsDataIO calls: 0
- Current Era NBA writes: 0
- Official Pick writes: 0
- Production learning writes: 0
- Production calibration writes: 0
- Replay settlement writes: 0
- MLB runtime changes: 0

## Blocker

Production `prediction_history.prediction_origin` is still not selectable. Apply the additive migration through an approved Supabase migration channel, then rerun NBA-02B1-R canary persistence/readback before NBA-02B2 bulk replay.
