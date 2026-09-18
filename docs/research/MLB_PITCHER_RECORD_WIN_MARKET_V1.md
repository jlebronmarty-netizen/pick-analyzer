# MLB Pitcher to Record a Win — Unified Market Rule V1

Status: RESEARCH-ONLY / SHADOW-ONLY

Frozen candidate: `pitcher_record_win_no_prior_rate_0p10_v1`

## Frozen rule

- Odds API market: `pitcher_record_a_win`
- selection = **NO**
- select only when prior starter win rate <= **10%**
- require at least **5 prior starts**
- prior starts must be strictly before the target date
- same-day earlier start is excluded from prior history

## 2025 development evidence

- 147 / 185 = **79.46%**
- worst month = **75.00%**
- baseline NO = **68.74%**
- lift = **+10.72 percentage points**

Monthly:
- May: 30/40 = 75.00%
- Jun: 26/34 = 76.47%
- Jul: 24/29 = 82.76%
- Aug: 45/53 = 84.91%
- Sep: 22/29 = 75.86%

State before external: `TARGET_MET_75_PLUS_EXTERNAL_PENDING`.

Historical prop pricing is not certified; no ROI/EV/CLV claim. Official Picks unchanged. APOSTAR disabled.

## 2026 one-shot external result

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

- 2026 source: already-stored SportsDataIO game-level starter stats
- source window: 2026-03-26 through 2026-07-19
- null provider player identities excluded fail-closed
- eligible rows after minimum-prior-start gate: 1,754
- selected: 118
- correct: 83
- accuracy: **70.34%**
- selected coverage: **6.73%**
- worst selected month: **64.44%**
- unconditional NO baseline: **67.45%**
- lift vs baseline: **+2.89 percentage points**
- retuned after external result: **NO**

Monthly:
- Apr: 12/17 = 70.59%
- May: 29/45 = 64.44%
- Jun: 31/41 = 75.61%
- Jul-to-source-end: 11/15 = 73.33%

State: `REVISIT_AFTER_FIRST_PASS`.

The 2025 rule exceeded 75%, but the frozen 2026 one-shot did not. Do not change the 10% threshold using 2026. Revisit later with materially better pregame features.
