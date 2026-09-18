# MLB Batter Hits — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_hits_under_1p5_edge_0p75_v1`

## Frozen rule

- Market line: **1.5 hits**
- Direction: **UNDER**
- Select only when projected hits are **<= 0.75**
- Equivalent edge: projection is at least **0.75 hits below** the 1.5 line.
- Point projection is fit chronologically from strict-prior-date batter history.
- Same-day game 1 is never used as prior input for game 2 of a doubleheader.

## 2025 expanding rolling evidence

- 6,123 / 7,011 correct = **87.33%**
- worst month = **85.19%**
- minimum monthly sample = 1,095
- unconditional UNDER 1.5 baseline = **79.55%**
- lift vs baseline = **+7.78 percentage points**

Monthly:

- May: 967/1,095 = 88.31%
- Jun: 1,102/1,279 = 86.16%
- Jul: 1,153/1,304 = 88.42%
- Aug: 1,289/1,513 = 85.19%
- Sep: 1,612/1,820 = 88.57%

## Lineage caveat

The existing deployed `MLB_BATTER_HITS_RESEARCH_V1` report had already exposed aggregate 2026 point/Brier diagnostics before this exact market-rule freeze.

Therefore any later exact 2026 event-accuracy result is labeled `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE`, not a pristine untouched-season holdout.

The exact line, direction, and 0.75 edge threshold were selected using strict 2025 rolling evidence only and must not be changed after reading the exact 2026 rule result.

## Boundaries

- Historical prop prices not certified.
- Accuracy does not imply ROI/EV/CLV.
- Official Picks unchanged.
- APOSTAR disabled.
- No production promotion.
- Historical Odds API credits consumed: 0.

## 2026 frozen-rule result

- eligible strict-prior rows: 35,558
- selected: 9,833
- correct: 8,496
- accuracy: **86.40%**
- selected coverage: **27.65%**
- worst selected month: **83.73%**
- unconditional UNDER 1.5 baseline: **80.23%**
- lift vs baseline: **+6.18 percentage points**
- retuned after external result: **NO**

Monthly:

- Apr: 1,256/1,500 = 83.73%
- May: 1,858/2,127 = 87.35%
- Jun: 1,750/2,035 = 86.00%
- Jul: 1,627/1,871 = 86.96%
- Aug: 1,835/2,106 = 87.13%
- Sep-to-date: 170/194 = 87.63%

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical sportsbook prices for these exact batter-hit prop opportunities are not certified; ROI/EV/CLV remain unclaimed.
