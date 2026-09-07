# MLB Pitcher Earned Runs Research V1

Status: `RESEARCH_ONLY`

## Purpose

Evaluate a leakage-safe pitcher earned-runs baseline before any shadow or production consideration.

## Target lineage

- Official target source: Retrosheet `historical_raw_records` rows where `record_type=data`, `parsed_fields[0]=data`, `parsed_fields[1]=er`.
- Join identity: `retrosheet:mlb:game:<game_reference>` + Retrosheet pitcher source ID.
- `historical_baseball_pitcher_appearances.runs` is explicitly not treated as earned runs.
- Starters with `target_outs <= 0` are excluded; missing ER is never imputed as zero.

## Pregame boundary

- Reuses `mlb_pitcher_prop_backtest_2025_v1_enriched` and feature version `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`.
- Requires pitcher, opponent, and matchup `as_of_date < game_date`.
- Rolling ER features use only games with `prior_game_date < target_game_date`.
- Minimum prior starts: 3.
- Frozen temporal splits are reused: TRAIN through 2025-07-31, VALIDATION 2025-08-01 through 2025-08-31, TEST from 2025-09-01.

## V1 model

The candidate blends:

1. prior earned runs L5 versus prior earned runs all-history; and
2. the smoothed ER estimate versus a workload-adjusted ER estimate based on the prior pitch-count profile.

Hyperparameters are selected on VALIDATION after fitting on TRAIN. TEST is never used for model selection.

Baselines:

- prior ER all-history;
- prior ER L5;
- workload-adjusted prior ER.

Fixed research lines: 1.5, 2.5, 3.5, 4.5 ER. Over probabilities use the empirical TRAIN residual distribution only.

## Activation boundary

This module makes zero sportsbook/provider calls, writes zero Official Picks, performs no production DML/DDL, claims no ROI without historical prices, and cannot activate betting. Any future shadow promotion requires a separate authorized gate after out-of-sample review.
