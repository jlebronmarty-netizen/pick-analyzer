# MLB Pitcher ER Line Surface V1

Status: **RESEARCH-ONLY**

Contract: `MLB_PITCHER_ER_LINE_SURFACE_V1/1.0.0`

## Goal

Expand common Pitcher Earned Runs lines without changing the certified
`pitcher_er_over_1p5_p70_v1` contract.

The source is the frozen 2025 exact-ER runtime:
`public.mlb_pitcher_er_frozen_2025_runtime_v1`.

Runs Allowed is never substituted for Earned Runs.

## Protocol

This is a separate transparent line-surface architecture using the already-frozen R2 prediction.

- VALIDATION chooses thresholds.
- TEST is read only after the threshold is frozen by VALIDATION.
- Threshold grid: 0.50 through 5.00 in 0.10 increments.
- For OVER: select when frozen prediction >= threshold.
- For UNDER: select when frozen prediction <= threshold.
- Development gate: n >= 30, accuracy >= 75%, lift >= 5 pp.
- TEST confirmation requires the same gate.
- Champion policy: maximize VALIDATION n among gate passers; then lift, accuracy, lower threshold.

No 2026 outcomes were used.

## Results

| Line | Side | Threshold | VALIDATION | TEST | State |
|---|---|---:|---:|---:|---|
| 1.5 | OVER | 2.60 | 139/185 = 75.14% | 109/164 = 66.46% | TEST FAIL; do not replace existing O1.5 |
| 2.5 | — | — | no cross-split 75% candidate | no cross-split 75% candidate | FAIL |
| 3.5 | UNDER | 2.20 | 98/123 = **79.67%** | 92/115 = **80.00%** | **RESEARCH CANDIDATE** |

For U3.5:
- VALIDATION baseline = 65.57%, lift = +14.11 pp.
- TEST baseline = 74.73%, lift = +5.27 pp.
- TEST n = 115.

The U3.5 result is promising but is not yet a certified betting rule. It requires untouched forward validation and exact sportsbook line/identity/pregame quote crossing.

## ER 2.5 closeout for this architecture

The strongest minimum-split candidate was U2.5 at prediction <=2.10:
- VALIDATION: 48/74 = 64.86%.
- TEST: 55/75 = 73.33%.

It therefore fails the >=75% cross-split requirement and is frozen as a failure for this architecture. No threshold rescue is authorized from future outcomes.

## Boundaries

- research/shadow only
- no 2026 outcome use
- no Runs Allowed substitution
- no change to O1.5
- no Official Picks
- APOSTAR disabled
- no historical Odds API spend
- no production promotion
