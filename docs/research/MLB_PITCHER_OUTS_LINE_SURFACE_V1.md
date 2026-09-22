# MLB Pitcher Outs Line Surface V1

Status: **RESEARCH ONLY**

Contract: `MLB_PITCHER_OUTS_LINE_SURFACE_V1/1.0.0`

## Frozen base architecture

Base candidate remains unchanged:

`pitcher_outs_under_18p5_blend_15p75_v2`

Projection:

```
projection =
  0.50 * prior season-to-date outs/start
+ 0.50 * L5 outs/start
```

Minimum prior starts: 5.

The existing V2 U18.5 threshold remains **15.75** and is not retuned or replaced.

## Parity control

2025 control reproduces exactly:

- eligible: **3,404**
- selected: **1,398**
- wins: **1,245**
- accuracy: **89.06%**
- baseline U18.5: **80.96%**

## Line-surface protocol

Development season: **2025**.

Lines:
- 14.5
- 15.5
- 16.5
- 17.5
- 18.5

Threshold grid:
- 12.00 through 20.00
- step 0.25

Development gates:
- accuracy >=75%
- n >=60
- selections across >=5 calendar months
- worst selected month >=65%
- lift >=5 percentage points vs unconditional exact-line baseline

Champion policy:
maximize selected n among signal-gate passers; tiebreak lift, accuracy, then lower threshold.

## Results

| Line | Side | Threshold | 2025 n | 2025 Acc. | Baseline | Lift | Worst month | 2026 diag n | 2026 diag Acc. | 2026 worst | State |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 14.5 | OVER | 15.75 | 2,010 | **77.11%** | 71.45% | +5.67 pp | 72.37% | 1,811 | **78.96%** | **75.86%** | CROSS_YEAR_DIAGNOSTIC_STABLE_75_PLUS |
| 17.5 | UNDER | 14.75 | 671 | **75.56%** | 61.84% | +13.72 pp | 70.54% | 788 | **78.05%** | **56.00%** | POOLED_75_PLUS_2026_STABILITY_FAIL |
| 18.5 | UNDER | 16.75 | 2,234 | **86.44%** | 80.96% | +5.47 pp | 83.82% | 2,119 | **86.03%** | 80.49% | DIAGNOSTIC_LIFT_BELOW_5PP_DO_NOT_REPLACE_V2 |

Existing V2 U18.5 <=15.75 remains the authoritative V2 control.

Failed development sides:
- U14.5
- O15.5
- U15.5
- O16.5
- U16.5
- O17.5
- O18.5

## 2026 evidence label

2026 is **diagnostic only**.

Pitcher Outs 2026 outcomes were previously inspected under older candidate families, so this
cannot be represented as pristine external validation. No thresholds were changed after reading
the 2026 diagnostic.

## Current exact-line relevance — 2026-09-22

Captured today:
- 14.5: DraftKings
- 15.5: BetMGM, DraftKings, FanDuel

The new stable O14.5 rule had one exact-line crossing today:

- **Nick Martinez O14.5 recorded outs**
- DraftKings: **-189**
- projection: **17.204**
- frozen line-surface threshold: **projection >=15.75**
- result at evaluation time: **QUALIFIES RESEARCH-ONLY**
- final settlement: **WIN**
- observed workload: **6.0 IP = 18 recorded outs**
- final game: **Yankees 2, Rays 0**
- outcome evidence: Yahoo Sports play-by-play records Ty Johnson relieving Nick Martinez to begin the bottom of the 7th.

Settlement state:

`SETTLED_RESEARCH_CROSSING_WIN_NOT_FORWARD_CERTIFICATION`

This settlement is observational only. It does not retune the threshold, does not upgrade the
candidate to certified, and does not by itself open or satisfy a formal untouched forward-validation
gate.

This is not an Official Pick and does not activate APOSTAR.

## Interpretation

O14.5 is the only new line-surface candidate that:
- passes all 2025 development gates,
- remains >75% with monthly stability in the 2026 diagnostic,
- retains >5 pp lift,
- and matched an exact sportsbook line captured today.

U17.5 loses monthly stability in the 2026 diagnostic.

The broader U18.5 threshold remains diagnostic only and must not replace the frozen V2
U18.5 <=15.75 candidate.

## Boundaries

- research-only
- zero historical Odds API credits
- no provider calls for this experiment
- no Official Picks writes
- APOSTAR disabled
- no production promotion
- tracker unchanged
