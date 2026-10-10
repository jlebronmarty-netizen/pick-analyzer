# MLB Pitcher Walks Line Surface V1

Status: **RESEARCH ONLY**

Contract: `MLB_PITCHER_WALKS_LINE_SURFACE_V1/1.0.0`

## Objective

Expand exact-line coverage for Pitcher Walks using the already-certified point model and canonical
`actual_bb` outcomes. No historical odds were purchased or required.

## Frozen point model

```
expected_walks =
  1.02751690958322
+ 0.395408983049705 * expected_bf_x_pitcher_bb_rate
```

Source:
`public.mlb_pitcher_bb_backtest_rows_v1_mv`

Only `modeling_eligible=true` rows are used.

## Development protocol

Threshold selection:
- 2025 TRAIN + VALIDATION only
- April through August, 5 calendar months
- threshold grid 0.25 to 5.00 in 0.25 steps

Holdout:
- 2025 TEST (September)

OOS:
- 2026 `OOS_2026`

Development signal gate:
- accuracy >=75%
- n >=60
- >=5 months
- worst selected month >=65%
- lift >=5 pp over unconditional exact-line baseline

Champion policy:
maximize selected n among signal-gate passers; tiebreak lift, accuracy, then lower threshold.

## Frozen candidates

| Line | Side | Threshold | Dev n | Dev Acc. | Dev Lift | TEST Acc. | OOS 2026 Acc. | OOS worst month | State |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 0.5 | OVER | 1.75 | 1,389 | **86.90%** | +5.21 pp | **90.91%** | **87.33%** | **84.70%** | CROSS_YEAR_STABLE_75_PLUS_OOS_LIFT_BELOW_5PP |
| 2.5 | UNDER | 1.50 | 689 | **83.31%** | +8.27 pp | **84.44%** | **86.60%** | **81.54%** | CROSS_YEAR_STABLE_75_PLUS |
| 3.5 | UNDER | 1.25 | 130 | **99.23%** | +8.15 pp | **100.00%** (19/19) | **96.35%** | **90.00%** | CROSS_YEAR_STABLE_75_PLUS_LOW_COVERAGE |

Failed development sides:
- UNDER 0.5
- OVER 1.5
- UNDER 1.5
- OVER 2.5
- OVER 3.5

## Exact details

### OVER 0.5 @ expected walks >=1.75

Development:
- 1,207 / 1,389 = **86.90%**
- baseline = **81.69%**
- lift = **+5.21 pp**
- coverage = **41.43%**
- worst month = **84.84%**
- Wilson 95% lower bound = **85.02%**

2025 TEST:
- 230 / 253 = **90.91%**
- lift = **+9.73 pp**
- Wilson lower = **86.73%**

2026 OOS:
- 1,254 / 1,436 = **87.33%**
- baseline = **82.84%**
- lift = **+4.49 pp**
- coverage = **41.21%**
- worst month = **84.70%**
- Wilson lower = **85.51%**

The 2026 lift is slightly below the 5 pp development signal threshold, so the candidate is preserved
but explicitly labeled rather than silently promoted.

### UNDER 2.5 @ expected walks <=1.50

Development:
- 574 / 689 = **83.31%**
- baseline = **75.04%**
- lift = **+8.27 pp**
- coverage = **20.55%**
- worst month = **80.12%**

2025 TEST:
- 114 / 135 = **84.44%**

2026 OOS:
- 517 / 597 = **86.60%**
- baseline = **74.49%**
- lift = **+12.11 pp**
- coverage = **17.13%**
- worst month = **81.54%**

### UNDER 3.5 @ expected walks <=1.25

Development:
- 129 / 130 = **99.23%**
- baseline = **91.08%**
- lift = **+8.15 pp**
- coverage = **3.88%**

2025 TEST:
- 19 / 19 = **100%**
- small holdout sample

2026 OOS:
- 132 / 137 = **96.35%**
- baseline = **90.67%**
- lift = **+5.68 pp**
- coverage = **3.93%**
- worst month = **90.00%**

## Current line relevance — 2026-09-22

Among the currently tracked books used in the approved-prop workflow:

| Exact line | Books observed | Games | Pitchers |
|---|---|---:|---:|
| 0.5 | DraftKings | 1 | 1 |
| 1.5 | DraftKings | 1 | 1 |
| 2.5 | none | 0 | 0 |
| 3.5 | none | 0 | 0 |

The current availability audit was not used to choose thresholds.

## Interpretation

The highest operational relevance is **OVER 0.5**, because:
- it is stable above 75% in development, TEST and 2026 OOS;
- it has high coverage;
- the exact 0.5 line appeared today;
- DraftKings was offering that exact market.

UNDER 2.5 is the strongest cross-year signal by lift among the higher-coverage UNDER candidates,
but the line was not present in today's capture.

UNDER 3.5 is extremely accurate but low coverage and has a naturally high UNDER baseline.

## Boundaries

- research-only
- no historical Odds API credits
- no provider calls for this experiment
- no Official Picks writes
- APOSTAR disabled
- no production promotion
- tracker unchanged
