# NBA-02B1-R4 Model-Only Odds Nullability

Status: NBA_02B1_MODEL_ONLY_ODDS_NULLABILITY_MIGRATION_READY

NBA-02B1-R4 audited the post-migration canary blocker where legitimate model-only replay rows could not persist because `prediction_history.odds` is physically `NOT NULL`.

## Contract

- Current Era rows require odds.
- Official Pick rows require odds.
- Price-aware replay rows require odds.
- Model-only `HISTORICAL_REPLAY_SHADOW` rows may have `odds = null` only when certification metadata explicitly marks them as non-current, non-product, non-official, non-learning, non-calibration, shadow replay rows with no certified price.
- No fake odds, `0`, default `-110`, copied prices or dropped model-only rows are allowed.

## Migration

- File: `supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql`
- Applied: no
- Existing rows modified: 0 expected
- RLS changed: no
- Data backfill: none
- Destructive table/column operations: none

The migration drops the physical `NOT NULL` from `prediction_history.odds`, then adds `prediction_history_replay_model_only_odds_check` so all non-qualified rows still require odds.

## Canary Dry Run

- Games: 24
- Predictions: 96
- Price-aware predictions: 24
- Model-only predictions: 72
- Model-only null-odds rows: 72
- Price-aware null-odds rows: 0
- Would insert after migration: 96
- Would fail after migration: 0
- Settlement preview: 52 wins, 44 losses, 0 pushes, 0 blocked

## Safety

- Provider calls: 0
- Production DB mutations: 0
- NBA Current Era writes: 0
- Official Pick writes: 0
- Production learning writes: 0
- Production calibration writes: 0
- Replay settlement writes: 0
- MLB runtime changes: 0

## Next

Apply the odds-nullability migration through an approved Supabase migration channel, then rerun NBA-02B1-R3 canary persistence/readback. Do not begin NBA-02B2 until the persisted 96-row canary passes readback and idempotency.
