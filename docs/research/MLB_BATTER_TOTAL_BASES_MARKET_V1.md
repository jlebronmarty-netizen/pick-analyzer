# MLB Batter Total Bases — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `batter_total_bases_under_2p5_edge_1p5_v1`

## Frozen rule

- Line: **2.5 total bases**
- Direction: **UNDER**
- Select only when projected total bases are **<= 1.0**
- Equivalent edge: at least **1.5 TB below** the 2.5 line.
- Strict prior-date batter history only.
- Same-day game 1 is not prior input for game 2.

## 2025 expanding rolling evidence

- 1,081 / 1,187 = **91.07%**
- worst month = **90.19%**
- minimum monthly n = 56
- unconditional UNDER 2.5 baseline = **80.41%**
- lift = **+10.66 percentage points**

Monthly:

- May: 52/56 = 92.86%
- Jun: 193/214 = 90.19%
- Jul: 260/280 = 92.86%
- Aug: 279/309 = 90.29%
- Sep: 297/328 = 90.55%

## Lineage caveat

Aggregate 2026 point/Brier diagnostics from the deployed Total Bases research service were already visible before this exact market-rule freeze. Any exact 2026 rule-accuracy result is therefore labeled `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE`.

The exact line, direction and 1.5-edge threshold were selected from strict 2025 rolling only and must not be changed after reading the 2026 rule result.

Historical prop pricing is not certified; no ROI/EV/CLV claim.

Official Picks unchanged. APOSTAR disabled. No production promotion. Historical Odds API credits: 0.

## 2026 frozen-rule result

- eligible strict-prior rows: 35,558
- selected: 2,336
- correct: 2,021
- accuracy: **86.52%**
- selected coverage: **6.57%**
- worst selected month: **83.33%**
- unconditional UNDER 2.5 baseline: **80.74%**
- lift vs baseline: **+5.78 percentage points**
- retuned after external result: **NO**

Monthly: Apr 429/512 = 83.79%; May 511/583 = 87.65%; Jun 387/454 = 85.24%; Jul 286/332 = 86.14%; Aug 378/419 = 90.21%; Sep-to-date 30/36 = 83.33%.

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical sportsbook pricing is not certified; ROI/EV/CLV remain unclaimed.
