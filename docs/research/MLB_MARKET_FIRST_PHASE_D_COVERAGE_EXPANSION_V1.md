# MLB Market-First Phase D — Coverage Expansion

Status: **RESEARCH-ONLY / SHADOW-ONLY**

## Baseline

The frozen 2026-09-25 coverage board from PR #215 started at:
- 11,550 exact distinct market/player/book rows
- 1,007 exact-contract-compatible rows
- **8.72% row coverage**
- 99 exact market+line+side surfaces
- 9 covered surfaces
- **9.09% surface coverage**

Phase D only counts exact market + exact line + exact side. Coverage is contract compatibility, not a play count.

## New passing architecture: Total Bases U1.5

A materially different model was used; the prior failed `projection <=1.20` rule was not retuned.

New feature: strict-prior **PA/game**.

Frozen rule selected using 2025 only:
`Batter Total Bases UNDER 1.5 when prior_PA_per_game <= 3.50`

Champion policy was maximum selection count among development rules that already passed all gates.

2025:
- 7,406 / 9,813 = **75.47%**
- lift **+8.92 pp**
- worst month **74.27%**

Untouched 2026:
- 9,145 / 12,142 = **75.32%**
- lift **+7.25 pp**
- worst month **72.69%**

Sep25 exact candidates:
- Carlos Jorge U1.5 TB — Caesars -195
- Hao-Yu Lee U1.5 TB — BetMGM -185

PR #216 contains the independent contract.

## HRRBI forward-only surfaces

The historical 2026 replay remains blocked by source snapshot drift. No revised historical data is relabeled as the frozen external set.

### HRRBI U1.5
Frozen 2025 rule: projection <=0.90.

Sep25 forward freeze:
- 119 exact targets
- 119 evaluable
- 0 blocked
- 3 crossings:
  - Carlos Jorge — DraftKings -131 — projection 0.6375
  - Charles McAdoo — BetMGM -130 — projection 0.872222
  - Nick Fortes — BetMGM -190 — projection 0.855714

PR #217.

### HRRBI U0.5
Frozen 2025 rule: projection <=0.05.

Sep25 forward freeze:
- 50 exact targets
- 50 evaluable
- 0 blocked
- **0 crossings**

PR #218. Threshold remains unchanged.

## Architectures closed in development

### Singles U0.5 — low-volume role
Best attempt:
- prior PA/game <=2.60
- 745/1,059 = **70.35%**
- lift +13.05 pp
- worst month 68.11%

FAIL: below 75%. 2026 was not opened.

### Hits U0.5 — low-volume role
Best attempt:
- prior PA/game <=2.00
- 78/123 = **63.41%**
- lift +21.51 pp
- worst month 54.55%

FAIL: below 75% and unstable. 2026 was not opened.

Total Bases U0.5 has the same zero-hit outcome, so the same architecture was not duplicated under another market label.

### Walks O0.5 — batter/pitcher interaction
New architecture used strict-pregame batter recent BB rate plus opposing starter BB rate.

Best development attempt:
- batter recent BB rate >=0.16
- opposing starter BB rate >=0.12
- 46/92 = **50.00%**
- lift +23.53 pp
- worst month 41.67%

FAIL. No 2026 opening.

### Batter Strikeouts 0.5 YES — batter/pitcher interaction
This was treated as an exact YES contract, not as an alias for OVER.

Frozen before external:
- batter recent K rate >=0.33
- opposing starter K rate >=0.27

2025:
- 273/359 = **76.04%**
- lift +17.22 pp
- worst month 71.79%

Untouched 2026 through available feature coverage Sep03:
- 200/295 = **67.80%**
- lift +9.93 pp
- worst month 63.54%

State: **EXTERNAL_BELOW_75_NO_RETUNE**.

## Coverage impact

Adding only the three explicit research contracts opened in Phase D:
- TB U1.5 UNDER
- HRRBI U1.5 UNDER
- HRRBI U0.5 UNDER

adds 579 exact quote rows on the Sep25 board.

Readback:
- exact-contract rows: 1,007 -> **1,586**
- row coverage: **8.72% -> 13.73%** (+5.01 pp)
- covered surfaces: 9 -> **12**
- surface coverage: **9.09% -> 12.12%** (+3.03 pp)

The live readback denominator moved from 11,550 to 11,551 by one row while the work was running; the baseline percentage remains 8.72%.

This does **not** mean 1,586 picks. New Sep25 threshold crossings from these three surfaces total five player-games.

## Boundaries

- no Official Picks changes
- APOSTAR disabled
- no production promotion
- no historical Odds API spend
- no line extrapolation
- no side substitution
- no YES→OVER alias
- no threshold retuning after external evidence
- strict pregame history only
- same-date history excluded
- tracker unchanged
