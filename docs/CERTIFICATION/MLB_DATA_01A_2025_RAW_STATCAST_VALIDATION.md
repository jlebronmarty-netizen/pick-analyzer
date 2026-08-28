# MLB-DATA-01A 2025 Raw Statcast Validation

Certification verdict: `MLB_DATA_01A_2025_RAW_STATCAST_VALIDATION_CERTIFIED`

Generated artifact: `docs/CERTIFICATION/mlb-data-01a-2025-raw-statcast-validation.json`

## Scope

MLB-DATA-01A validates the complete original 2025 Baseball Savant Statcast source package and prepares the dry-run raw import contract. It does not import pitch rows, build derived features, train models, generate predictions, evaluate market value, activate automation or add cron.

## Source Package

- Source directory: `data/statcast/2025/raw`
- Canonical CSV files: 30
- Pitch rows: 712,528
- Unique `game_pk`: 2,430
- Source columns: 119
- MLB teams represented: 30
- Date range: 2025-03-18 through 2025-09-28
- Game type: regular season only
- Duplicate pitch identities: 0
- Null pitch identities: 0

The source identity is `game_pk + at_bat_number + pitch_number`.

## Validation

All 30 files share the same 119-column source schema. Every source column is accounted for as explicit raw storage where supported or preserved in `raw_payload`. The raw row transform preserves all 119 source fields, produces a deterministic `raw_payload_digest`, and derives deterministic dry-run row identity as:

`statcast:mlb:2025:{game_pk}:{at_bat_number}:{pitch_number}`

The full dry-run transformation produced 712,528 candidate rows, 712,528 unique insert candidate identities and 0 transformation errors.

## Coverage

Label reconstruction is certified for 2,430 / 2,430 games for full-game, first-five and first-inning NRFI/YRFI label families. These are historical label outputs only. Same-game score, win expectancy, run expectancy and future-state fields remain prohibited for target-game pregame features.

Advanced field coverage is measured in the JSON artifact. Normal batted-ball and bat-tracking missingness is preserved as source nullability, not treated as corruption. Deprecated/empty fields are preserved in `raw_payload`.

## Mapping

The validation performs read-only dry-run mapping only. Canonical event and player IDs remain nullable for raw import when production mappings are absent. Team abbreviation mapping is deterministic and includes Statcast alias normalization such as `AZ -> ARI` and `CWS -> CHW`.

No canonical mappings were written.

## Production Safety

- `pick2_raw_mlb_statcast_pitches`: 0 rows before import
- Pick 2 feature/model/prediction/evaluation/market-value tables: clean RESET-05 baseline
- Provider calls: 0
- Production DML mutations: 0
- Production schema mutations: 0
- Statcast inserts: 0
- Feature/model/prediction/market-value writes: 0
- Automation activated: NO
- Cron changes: 0

## Import Readiness

The importer contract is certified as streaming, chunked, restartable, checkpointed, idempotent and auditable with a proposed 1,000-row batch size. Future import behavior is:

- `0` identity matches: `INSERT`
- `1` match with same digest: `REUSE_NO_OP`
- `1` match with different digest: `BLOCK_CONFLICT_OR_QUARANTINE`
- `>1` matches: `DATA_INTEGRITY_DEFECT`

`MLB_DATA_01B_2025_RAW_IMPORT_READY = YES`, but `RAW_IMPORT_ALLOWED_NOW = NO`.

## Next

Proceed only with separately authorized `MLB-DATA-01B_2025_RAW_STATCAST_IMPORT`. Do not import raw rows until that phase is explicitly authorized.
