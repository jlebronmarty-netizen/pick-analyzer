# MLB Pitcher Recorded Outs — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `pitcher_outs_under_18p5_p90_v1`

## Frozen rule

- Existing point model: `MLB_PITCHER_OUTS_RESEARCH_V1`
- alpha = 0.2
- beta = 0.7
- fit intercept = 7.2635858445929635
- fit slope = 0.547385023095297
- line = **18.5 recorded outs**
- direction = **UNDER**
- select only when empirical P(OVER 18.5) <= 10%, equivalent to UNDER confidence >=90%
- probability source = TRAIN residual distribution.

## 2025 development evidence

Across 2025 VALIDATION + fixed TEST:

- 123 / 126 = **97.62%**
- worst split = **95.52%**
- minimum split n = 59
- unconditional UNDER 18.5 baseline = **83.94%**
- lift = **+13.68 percentage points**

VALIDATION: 59/59 = 100.00%  
TEST: 64/67 = 95.52%

## Lineage caveat

The existing backtest report had already exposed aggregate 2026 point/Brier diagnostics before this exact market-rule freeze. Exact line/direction/90% confidence threshold were selected using 2025 only.

Any exact 2026 rule-accuracy result is labeled `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE`.

Historical prop prices are not certified; no ROI/EV/CLV claim. Official Picks unchanged. APOSTAR disabled.

## 2026 frozen-rule result

The 2026 holdout lineage was reproduced exactly from the canonical backtest service:

- SportsDataIO starter rows: 3,005
- matched SportsDataIO/Statcast: 2,464
- strikeout-reconciled: 2,464
- strict-prior feature rows / scored rows: 2,391

Point-model checksum also matches the canonical report (MAE 2.77139689108858).

Frozen market rule:

- selected: 226
- correct: 215
- accuracy: **95.13%**
- selected coverage: **9.45%**
- worst selected month: **89.23%**
- unconditional UNDER 18.5 baseline: **82.39%**
- lift vs baseline: **+12.74 percentage points**
- retuned after external result: **NO**

Monthly:

- Apr: 58/65 = 89.23%
- May: 65/66 = 98.48%
- Jun: 65/67 = 97.01%
- Jul-to-holdout-end: 27/28 = 96.43%

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical sportsbook pricing for the exact opportunities is not certified; ROI/EV/CLV remain unclaimed.
