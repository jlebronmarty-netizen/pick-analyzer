# MLB-DATA-02R-R2K Starter Live Target Schema Guard Repair

Certification: `MLB_DATA_02R_R2K_STARTER_LIVE_TARGET_SCHEMA_GUARD_REPAIR_CERTIFIED`

- Existing physical table reused: `pick2_mlb_pitcher_daily_features`
- Incorrect target removed from live adapter: `pick2_mlb_starter_daily_features`
- No new starter table created.
- No data migration.
- No feature semantic change.
- No provider calls.
- No production DML/DDL.

R2K repairs the live adapter/schema guard target only. The certified starter-feature semantics remain rooted in target game, MLBAM pitcher identity, pregame as-of fields and the existing Pick2 pitcher daily feature table.
