# MLB Pitcher Walks — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `pitcher_bb_under_2p5_p85_v1`

## Rule

- Point model: `MLB_PITCHER_BB_V1` (unchanged)
- Walk line: **2.5 BB**
- Direction: **UNDER**
- Select only when calibrated UNDER probability is **>= 85%**
- Calibration bin width: 0.25 projected BB
- Minimum prior calibration-bin sample: 20
- Historical odds/prices are not certified; this is event-accuracy research, not ROI/EV evidence.

## 2025 rolling development evidence

- 111 / 122 correct = **90.98%**
- worst month = **82.35%**
- minimum monthly sample = 17
- baseline UNDER 2.5 = **75.83%**
- lift vs baseline = **+15.15 percentage points**

Monthly:

- May: 14/17 = 82.35%
- Jun: 29/32 = 90.63%
- Jul: 34/36 = 94.44%
- Aug: 17/18 = 94.44%
- Sep: 17/19 = 89.47%

## Validation lineage

The line, direction and probability threshold were selected using 2025 only.

The underlying point/probability model already had 2026 point and Brier diagnostics before this market-rule freeze. Therefore the forthcoming exact 2026 rule-accuracy result must be labeled `HISTORICAL_2026_SEEN_BEFORE_MARKET_RULE_FREEZE`, not a pristine untouched-season holdout.

No post-2026 retuning of this frozen rule is allowed.

## Boundaries

- Official Picks unchanged.
- APOSTAR disabled.
- No production promotion.
- No historical Odds API credit spend.
- No ROI/EV/CLV claim without certified real market prices.

## 2026 historical external rule result

Validation label: `HISTORICAL_2026_SEEN_BEFORE_MARKET_RULE_FREEZE`.

The underlying point/Brier model had already been inspected on 2026 before this market-rule freeze. The exact 2.5 line, UNDER direction, and 85% probability threshold were nevertheless selected from 2025 only and were not changed after the 2026 rule result was read.

Frozen rule result:

- eligible 2026 rows with a certified 2025 calibration bin: 3,468
- selected: 137
- correct: 125
- accuracy: **91.24%**
- selected coverage: **3.95%**
- worst month with selections: **86.67%**
- unconditional 2026 UNDER 2.5 baseline: **74.57%**
- lift vs baseline: **+16.67 percentage points**

Monthly:

- Apr: 14/15 = 93.33%
- May: 30/32 = 93.75%
- Jun: 26/29 = 89.66%
- Jul: 26/28 = 92.86%
- Aug: 26/30 = 86.67%
- Sep-to-date: 3/3 = 100.00%

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

This does **not** certify ROI, EV, CLV, or real betting-market value because historical sportsbook prices for the exact selected prop opportunities are not certified.
