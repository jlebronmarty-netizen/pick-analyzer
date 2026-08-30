# MLB_DATA_01D_R1A_FEATURE_NATIVE_UNIQUENESS_MIGRATION_CERTIFIED

Generated: 2026-08-30

## Verdict

`MLB_DATA_01D_R1A_FEATURE_NATIVE_UNIQUENESS_MIGRATION_CERTIFIED`

R1A prepares one non-applied forward migration for Pick 2 MLB daily feature native
uniqueness repair. The migration is repository-only in this phase and was not
applied to production.

## Migration

`supabase/migrations/202608290002_pick2_mlb_feature_native_uniqueness_v1.sql`

The migration drops only the R1-certified incompatible legacy team and bullpen
daily-feature uniqueness constraints, then recreates the already-certified
native game-rooted unique indexes.

## Partial State Preserved

- `pick2_feature_snapshots`: 67,433
- Daily feature tables: 0
- Raw rows: 712,528
- Native games: 2,430
- Native players: 1,469
- Models: 0
- Champion: NONE
- Predictions: 0

## Constraint Repair

| Domain | Old key | Native key | Action |
| --- | --- | --- | --- |
| Team | `team_id + feature_date + feature_version` | `target_game_pk + team_id + feature_version` | Replace legacy constraint |
| Bullpen | `team_id + feature_date + feature_version` | `target_game_pk + team_id + feature_version` | Replace legacy constraint |
| Starter | `player_id + feature_date + feature_version` | `target_game_pk + mlbam_pitcher_id + feature_version` | Preserve legacy constraint; native index already exists |
| Batter | `player_id + feature_date + feature_version` | `target_game_pk + mlbam_batter_id + feature_version` | Preserve legacy constraint; native index already exists |
| Matchup | `event_id + feature_date + feature_version` | `target_game_pk + feature_version` | Preserve legacy constraint; native index already exists |
| First inning | `event_id + feature_date + feature_version` | `target_game_pk + feature_version` | Preserve legacy constraint; native index already exists |

## Safety

- Migration applied: NO
- Feature DML resumed: NO
- Provider calls: 0
- Production DDL mutations: 0
- Production DML mutations: 0
- Snapshot writes/deletes/rewrites: 0
- Raw/native identity mutations: 0
- Model/prediction work: NO
- 2026 import: NO
- Automation/cron changes: NO
