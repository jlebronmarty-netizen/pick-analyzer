# NBA-02B1 Replay Canary Certification

Status: NBA_02B1_MODEL_ONLY_ODDS_NULLABILITY_MIGRATION_READY

NBA-02B1 executed a deterministic, chronological, non-provider historical replay canary using stored NBA evidence only.

## Canary

- Games: 24
- Predictions planned: 96
- Predictions persisted: 0
- Price-aware predictions: 24
- Model-only predictions: 72
- Settlement preview checked: 96
- Model-only null-odds rows: 72
- Price-aware null-odds rows: 0

## Persistence Gate

Schema selectable: true
Persistence requested: false
Persistence performed: false
Replay origin readback count: 0
Wrong origin count: 0

No-write R4 certification: canary rows require a conditional odds-nullability migration because legitimate model-only replay rows carry odds/implied_probability/edge/ev as null.

## Odds Nullability Contract

- Current Era requires odds: true
- Official Pick requires odds: true
- Price-aware replay requires odds: true
- Model-only replay may lack odds: true
- Migration file: supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql
- 96-row dry run would insert: 96
- 96-row dry run would fail: 0

## Safety

- Provider calls: 0
- Current Era writes: 0
- Official Pick writes: 0
- Production learning writes: 0
- Production calibration writes: 0
- Replay prediction writes: 0
- Replay prediction inserts: 0
- MLB runtime changes: 0

## Next

Apply `supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql` through the approved Supabase migration channel, then rerun NBA-02B1-R3 canary persistence/readback before NBA-02B2 bulk replay.
