# MLB Pitcher K Line Surface V1

Status: **RESEARCH ONLY**

Contract: `MLB_PITCHER_K_LINE_SURFACE_V1/1.0.0`

## Objective

Expand exact-line coverage for Pitcher Strikeouts without changing the certified
`pitcher_k_under_6p5_proj_4p5_v1` contract.

Each exact line + direction is treated as an independent market rule. Accuracy is never
extrapolated between lines.

## Frozen projection

```
projection =
  0.60 * (prior_K_per_BF * L5_BF_per_start)
+ 0.40 * L5_K_per_start
```

Eligibility requires at least 5 strictly-prior starts within the same season.

The certified U6.5 control reproduces exactly on 2025:

- selected: **1,367**
- wins: **1,189**
- accuracy: **86.9788%**
- baseline U6.5: **75.2350%**

This control was used to reject an earlier SQL implementation that accidentally performed
integer division. No result from that invalid query is retained.

## Development search

Development season: **2025 only**.

Exact lines:
- 3.5
- 4.5
- 5.5
- 6.5 control
- 7.5
- 8.5

Threshold grid:
- minimum 1.50
- maximum 10.00
- step 0.25

For UNDER, select when `projection <= threshold`.
For OVER, select when `projection >= threshold`.

Base gates:
- accuracy >= 75%
- n >= 60
- >= 5 selected calendar months
- worst selected month >= 65%

Signal gate:
- base gates plus lift >= **5 percentage points** over unconditional exact-line baseline.

Champion policy was frozen before the corrected grid was read:
maximize selected n among signal-gate passers; tiebreak by lift, accuracy, then lower threshold.

## Results

| Line | Side | Threshold | 2025 n | 2025 Acc. | 2025 Baseline | Lift | Worst month | 2026 n | 2026 Acc. | 2026 Worst | State |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 3.5 | OVER | 4.25 | 2,332 | **75.94%** | 70.39% | +5.56 pp | 71.43% | 2,290 | **76.03%** | 74.85% | CROSS_YEAR_STABLE_75_PLUS |
| 4.5 | OVER | 6.25 | 582 | **76.12%** | 54.76% | +21.36 pp | 65.38% | 555 | **78.20%** | **64.00%** | POOLED_75_PLUS_2026_STABILITY_FAIL |
| 5.5 | OVER | 7.75 | 89 | **82.02%** | 38.43% | +43.60 pp | 71.43% | 88 | **82.95%** | **20.00%** | POOLED_75_PLUS_2026_STABILITY_FAIL |
| 5.5 | UNDER | 4.50 | 1,367 | **75.93%** | 61.57% | +14.36 pp | 69.60% | 1,176 | **77.21%** | **60.53%** | POOLED_75_PLUS_2026_STABILITY_FAIL |
| 6.5 | UNDER | 4.50 | 1,367 | **86.98%** | 75.24% | +11.74 pp | 81.06% | 1,176 | **89.03%** | 76.32% | EXISTING CERTIFIED CONTROL |
| 7.5 | UNDER | 5.50 | 2,284 | **90.19%** | 84.58% | +5.62 pp | 87.73% | 2,167 | **90.59%** | 85.33% | CROSS_YEAR_STABLE_75_PLUS_BASELINE_HIGH |
| 8.5 | UNDER | 4.75 | 1,619 | **96.54%** | 91.45% | +5.09 pp | 92.41% | 1,424 | **96.56%** | 89.58% | CROSS_YEAR_STABLE_75_PLUS_BASELINE_HIGH |

OVER 6.5/7.5/8.5 and UNDER 3.5/4.5 did not pass the development gates.

### Wilson lower bounds

| Rule | 2025 lower 95% | 2026 lower 95% |
|---|---:|---:|
| O3.5 @ projection >=4.25 | 74.17% | 74.23% |
| O4.5 @ projection >=6.25 | 72.49% | 74.58% |
| O5.5 @ projection >=7.75 | 72.77% | 73.76% |
| U5.5 @ projection <=4.50 | 73.60% | 74.73% |
| U6.5 certified control | 85.09% | 87.12% |
| U7.5 @ projection <=5.50 | 88.90% | 89.28% |
| U8.5 @ projection <=4.75 | 95.54% | 95.48% |

Wilson lower bound was reported, not used as a promotion gate.

## Current line relevance audit — 2026-09-22

Strictly pregame captures from the existing approved-prop capture path:

| Exact line | Books observed | Games | Pitchers |
|---|---|---:|---:|
| 3.5 | BetMGM, DraftKings, FanDuel | 1 | 1 |
| 4.5 | DraftKings, FanDuel | 1 | 1 |
| 5.5 | BetMGM | 1 | 1 |
| 6.5 | none | 0 | 0 |
| 7.5 | none | 0 | 0 |
| 8.5 | none | 0 | 0 |

The availability audit is descriptive only and did not participate in threshold selection.

## Interpretation

The most operationally relevant new result is **OVER 3.5** because it:
- clears 75% in both 2025 and 2026,
- remains above the monthly stability floor in both seasons,
- has large selected samples,
- adds >5 pp over its exact-line baseline,
- and the line appeared today at all three captured books.

U7.5 and U8.5 are statistically stable but have high unconditional UNDER baselines and were
not observed in today's captured books. They are therefore retained as line-surface candidates,
not as evidence of betting value.

O4.5, O5.5, and U5.5 remain pooled 75%+ candidates but fail the 2026 monthly stability floor.
They are frozen without retuning.

## Evidence label

The 2026 threshold evaluation is a one-shot line-rule evaluation after 2025-only threshold
selection. The underlying pitcher-K projection/runtime had prior 2026 certification work, so
this is **not** labeled a pristine untouched model external.

## Boundaries

- zero historical Odds API credits
- no provider call made for this research
- no Official Picks writes
- APOSTAR remains disabled
- no production promotion
- no tracker modification
- no change to the certified U6.5 formula
