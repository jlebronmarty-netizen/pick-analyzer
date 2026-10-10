# MLB Pitcher Earned Runs Research V1

Status: `RESEARCH_ONLY`

## Purpose

Evaluate a leakage-safe pitcher earned-runs model before any shadow or production consideration.

## Target lineage

- Official target source: Retrosheet `historical_raw_records` rows where `record_type=data`, `parsed_fields[0]=data`, `parsed_fields[1]=er`.
- Join identity: `retrosheet:mlb:game:<game_reference>` + Retrosheet pitcher source ID.
- `historical_baseball_pitcher_appearances.runs` is explicitly not treated as earned runs.
- Starters with `target_outs <= 0` are excluded; missing ER is never imputed as zero.
- The 2025 audit found 20,868 unique pitcher-game ER labels with zero duplicate keys.

## Pregame boundary

- Reuses `mlb_pitcher_prop_backtest_2025_v1_enriched` and feature version `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`.
- Requires pitcher, opponent, and matchup `as_of_date < game_date`.
- Rolling ER features use only games with `prior_game_date < target_game_date`.
- Same-date starts are not allowed into prior history, including doubleheaders.
- Minimum prior starts: 3.
- Frozen temporal splits are reused: TRAIN through 2025-07-31, VALIDATION 2025-08-01 through 2025-08-31, TEST from 2025-09-01.

## V1 R2 model

The initial ER candidate grid tested L5 versus all-history ER and workload-adjusted ER. Validation selected `alpha=0` and `beta=1`, meaning the extra L5/workload blend did not add value; the useful base signal was calibrated all-history ER.

A second-stage pregame feature screen was then performed without using TEST. `pitcher_k_rate` was the strongest incremental feature on VALIDATION, ahead of prior K all-history, whiff rate, and prior hits allowed.

The frozen R2 model is therefore:

1. fit `actual_er ~ prior_er_all` on TRAIN;
2. calculate TRAIN residuals from that base fit;
3. fit those residuals against pregame `pitcher_k_rate` on TRAIN;
4. score VALIDATION and TEST with those frozen TRAIN coefficients.

TEST is never used for feature or parameter selection.

## Read-only audit snapshot

For the minimum-three-start universe, the frozen temporal sample was:

- TRAIN: 2,194 rows
- VALIDATION: 729 rows
- TEST: 645 rows

Direct read-only reproduction before code update produced:

| Split | Base MAE | Base RMSE | Base Corr | R2 MAE | R2 RMSE | R2 Corr |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TRAIN | 1.568 | 1.947 | 0.092 | 1.553 | 1.941 | 0.123 |
| VALIDATION | 1.700 | 2.103 | 0.184 | 1.681 | 2.089 | 0.209 |
| TEST | 1.550 | 1.904 | 0.112 | 1.533 | 1.894 | 0.145 |

The improvement is real but modest. This is not sufficient evidence for production activation or an ROI claim.

## Research reporting

- Baselines: TRAIN mean, prior ER all-history, prior ER L5, and calibrated ER-all base.
- Fixed research lines: 1.5, 2.5, 3.5, 4.5 ER.
- Over probabilities use the empirical TRAIN residual distribution only.
- Directional line accuracy is descriptive only because historical sportsbook prices are not part of this backtest.

## Activation boundary

This module makes zero sportsbook/provider calls, consumes zero odds-provider credits, writes zero Official Picks, performs no production DML/DDL, claims no ROI without historical prices, and cannot activate betting. Any future shadow promotion requires a separate authorized gate after additional out-of-sample review.
