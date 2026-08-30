# MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR_BLOCKED

Generated: 2026-08-29

## Verdict

`MLB_DATA_01D_R1_FEATURE_PERSISTENCE_KEY_REPAIR_BLOCKED`

R1 completed the read-only partial-state audit, proved the legacy uniqueness
failure mode and repaired the future persistence resume logic. It did not create
the constraint-dropping migration file because that destructive schema artifact
requires direct authorization before it can be added to the repository.

## Partial State

- Production commit: `875b46d34553bc3618067fec202a2f780a39b2d8`
- Provider calls: 0
- `pick2_feature_snapshots`: 67,433
- Daily feature tables: 0
- Native games: 2,430
- Native players: 1,469
- Result/market/model/prediction tables: 0

## Snapshot Audit

- Feature version: `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`
- Snapshot rows: 67,433
- Duplicate deterministic identities: 0
- As-of violations: 0
- Same-day leakage violations: 0
- Target-game coverage: 2,249
- State: PASS

## Legacy Key Defect

The observed blocker is:

```text
pick2_mlb_team_daily_features_team_id_feature_date_feature__key
```

The legacy key `team_id + feature_date + feature_version` cannot represent
same-team same-date target games. Snapshot-derived collision proof:

| Family | Rows | Legacy collisions | Affected games | Affected teams |
| --- | ---: | ---: | ---: | ---: |
| team | 4,498 | 42 | 42 | 19 |
| bullpen | 4,498 | 42 | 42 | 19 |
| offense | 4,498 | 42 | 42 | 19 |

All colliding rows are distinguishable by native `target_game_pk`.

## Native Key Contract

- Team: `target_game_pk + team_id + feature_version`
- Starter: `target_game_pk + mlbam_pitcher_id + feature_version`
- Bullpen: `target_game_pk + team_id + feature_version`
- Batter: `target_game_pk + mlbam_batter_id + feature_version`
- Offense: `target_game_pk + team_id + feature_version`
- Matchup: `target_game_pk + feature_version`
- First inning: `target_game_pk + feature_version`
- Snapshot: `deterministic_identity`

## Resume Contract

- Existing snapshots: `REUSE_NO_OP`
- Daily feature tables: `INSERT_ELIGIBLE`
- Snapshot duplication: NO
- Daily table truncation/reset: NO
- Feature-definition changes: NO
- As-of contract changes: NO

## Blocker

Direct authorization is required to add a forward migration that drops/replaces
the incompatible legacy UNIQUE constraints. No migration was created, no schema
was applied and no daily feature persistence was resumed in R1.
