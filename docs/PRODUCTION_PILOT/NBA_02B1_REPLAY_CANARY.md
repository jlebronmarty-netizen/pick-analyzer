# NBA-02B1 Replay Canary Certification

Status: NBA_02B1_REPLAY_CANARY_PERSISTED_ISOLATED

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
Persistence requested: true
Persistence performed: true
Replay origin readback count: 96
Wrong origin count: 0

Canary replay rows persisted with explicit replay origin and readback validation.

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

NBA-02B2 bulk model replay is eligible for explicit authorization; do not start it automatically.
