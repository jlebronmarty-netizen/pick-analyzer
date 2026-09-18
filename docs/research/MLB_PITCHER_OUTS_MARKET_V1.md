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
