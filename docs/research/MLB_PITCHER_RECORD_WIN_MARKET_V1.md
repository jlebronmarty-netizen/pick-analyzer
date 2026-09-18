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
