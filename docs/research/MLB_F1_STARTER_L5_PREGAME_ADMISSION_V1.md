# F1 Starter L5 Pregame Admission V1

Status: **ADMITTED FOR HISTORICAL RESEARCH ONLY**

This certificate admits a new strict-prior starter feature surface reconstructed from `public.mlb_ml_xyear_pitcher_game_v1`.

## Identity

Target starter MLBAM IDs from `mlb_ml_xyear_features_v1` reproduce the actual starter rows exactly:

- 2025: **2,430/2,430 games**, zero mismatches.
- 2026 raw-xyear: **2,285/2,285 games**, zero mismatches.

No fuzzy matching is used.

## History contract

For every target starter:

- same season only;
- `starter=true`;
- source `game_date < target game_date`;
- last five starts ranked by prior date and gamePk;
- earlier game of a same-date doubleheader is **not** admitted.

Admitted L5 rates:

- K/BF
- BB/BF
- Hits/BF
- Whiffs/Swings
- Chase/Outside-zone pitches
- Hard-hit/Batted balls

The batting-side context adds only previously admitted strict-prior offense OPS proxy and offense K%.

## Coverage

| Season | Target starter-sides | Sides with exact L5 | F1 games with both starters exact L5 |
|---|---:|---:|---:|
| 2025 | 4,860 | 3,404 | **1,402** |
| 2026 | 4,570 | 3,144 | **1,261** |

All admitted L5 rows satisfy the strict-date rule.

Evidence label:
`ADMITTED_HISTORICAL_RECONSTRUCTED_STRICT_PRIOR_STARTER_L5_RESEARCH_ONLY`.

No provider calls, Odds API credits, Official Picks, APOSTAR, production promotion or tracker edits.
