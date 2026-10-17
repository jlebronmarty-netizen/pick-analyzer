# MLB Pitcher Earned Runs Line Surface V1

Status: **RESEARCH ONLY**

Contract: `MLB_PITCHER_ER_LINE_SURFACE_V1/1.0.0`

## Frozen runtime source

`public.mlb_pitcher_er_frozen_2025_runtime_v1`

Model:
`MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2`

Temporal split:
- TRAIN: 2,194 rows
- VALIDATION: 729 rows
- TEST: 645 rows

TRAIN is used only to fit the point model and empirical residual distribution.

For an exact line `L`:

```
P(OVER L) = P_train_residual(residual > L - predicted_ER)
P(UNDER L) = 1 - P(OVER L)
```

## Search protocol

Lines:
- 0.5
- 1.5 control
- 2.5
- 3.5
- 4.5
- 5.5

Threshold grid:
- 0.55 to 0.90
- step 0.025

Threshold selection occurs on VALIDATION only.

Validation gate:
- accuracy >=75%
- selected n >=60
- lift >=5 percentage points over exact-line side baseline

Champion policy:
maximize selected n among gate passers; tiebreak by lift, accuracy, then lower threshold.

TEST is never used for threshold selection.

## Results

| Line | Side | Probability threshold | Validation | Validation lift | TEST | TEST lift | State |
|---|---|---:|---:|---:|---:|---:|---|
| 0.5 | OVER | 0.875 | 99/106 = **93.40%** | +6.15 pp | 64/77 = **83.12%** | **+1.57 pp** | TEST_75_PLUS_BASELINE_DOMINATED_LIFT_FAIL |
| 1.5 | OVER | 0.700 | 47/59 = **79.66%** | existing certified control | 26/32 = **81.25%** | +18.30 pp vs TEST baseline | EXISTING_CONTROL |
| 2.5 | OVER | 0.550 | 9/11 = **81.82%** | +33.26 pp | not opened | — | VALIDATION_SAMPLE_FAIL |
| 2.5 | UNDER | 0.550 | 316/580 = **54.48%** | +3.04 pp | not opened | — | VALIDATION_ACCURACY_FAIL |
| 3.5 | UNDER | 0.775 | 55/69 = **79.71%** | +14.14 pp | 58/72 = **80.56%** | **+5.83 pp** | CROSS_SPLIT_STABLE_75_PLUS |
| 4.5 | UNDER | 0.875 | 59/69 = **85.51%** | +6.49 pp | 62/71 = **87.32%** | **+1.59 pp** | TEST_75_PLUS_BASELINE_DOMINATED_LIFT_FAIL |
| 5.5 | UNDER | 0.900 | 609/685 = **88.91%** | **+0.70 pp** | not opened | — | VALIDATION_75_PLUS_BASELINE_DOMINATED_LIFT_FAIL |
| 4.5 | OVER | — | 0 selected at every frozen threshold | — | not opened | — | VALIDATION_SAMPLE_FAIL |
| 5.5 | OVER | — | 0 selected at every frozen threshold | — | not opened | — | VALIDATION_SAMPLE_FAIL |

## Interpretation

The only new line that preserves both >75% accuracy and >=5 pp lift from VALIDATION into TEST is:

**Pitcher Earned Runs UNDER 3.5 when empirical UNDER probability >=77.5%.**

OVER 0.5 remains above 75% in TEST but becomes baseline-dominated there, so it is preserved without promotion.

The 2.5 line did not produce a candidate that met the minimum-sample and signal gates.

UNDER 4.5 clears the VALIDATION gate but loses incremental signal in TEST: 62/71 = 87.32% against an 85.74% TEST baseline, only +1.59 pp. It is preserved as baseline-dominated and is not promoted.

UNDER 5.5 is even more baseline-dominated on VALIDATION: 609/685 = 88.91% against an 88.20% baseline, only +0.70 pp. TEST is not opened for threshold selection or rescue.

OVER 4.5 and OVER 5.5 select zero rows throughout the frozen probability threshold grid, so neither direction can establish a candidate.

## Current sportsbook relevance — 2026-09-22

| Exact line | Books observed | Games | Pitchers |
|---|---|---:|---:|
| 0.5 | none | 0 | 0 |
| 1.5 | BetMGM, DraftKings | 1 | 2 |
| 2.5 | BetMGM | 1 | 1 |
| 3.5 | none | 0 | 0 |
| 4.5 | BetOnline | 1 | 2 |
| 5.5 | BetOnline | 1 | 1 |

Current availability was not used for threshold selection.

## Boundaries

- no provider calls for this research
- zero historical Odds API credits
- no Official Picks writes
- APOSTAR disabled
- no production promotion
- tracker unchanged
- existing O1.5 control unchanged
