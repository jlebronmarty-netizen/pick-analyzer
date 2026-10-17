# MLB Batter Walks U0.5 Target Feature Dry-Run V1

Status: RESEARCH-ONLY / READ-ONLY

## Why this exists

Batter Walks U0.5 is one of the more practical current markets:
- frozen historical accuracy: 83.39%;
- exact U0.5 UNDER market is offered by multiple books;
- 2026-09-24 best captured prices ranged approximately from -131 to -504;
- average best price across 17 quoted players was about -290.

The runtime blocker is not line availability. The exact runtime requires a same-target-game row in:
`public.pick2_mlb_batter_daily_features`

with:
- feature version `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`;
- strict prior as-of date;
- source rule `source_game_date < target_game_date`.

At audit time, none of the 17 quoted PIT-STL players had that target-day feature row.

## Mathematical crossing observed

Ronny Simon:
- U0.5 Walks
- projection 0.184
- threshold <=0.20
- DraftKings -309

This remains blocked and is not a runtime-verified candidate until the target feature exists.

## Dry-run

The SQL identifies every exact quoted batter and classifies:
- `REUSE_NO_OP`
- `MISSING_TARGET_FEATURE`
- `BLOCK_NON_STRICT_ASOF`
- `BLOCK_SOURCE_WINDOW`

No writes occur.

## Boundaries

- no DML
- no feature fabrication
- no threshold/model change
- no Official Picks
- APOSTAR disabled
- no provider calls
- no historical Odds API spend
