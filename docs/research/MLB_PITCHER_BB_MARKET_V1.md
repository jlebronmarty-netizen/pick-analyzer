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
