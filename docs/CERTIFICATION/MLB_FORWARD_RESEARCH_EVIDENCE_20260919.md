# MLB Forward Research Evidence — 2026-09-19

Status: `VALID FIXED-CLOCK SHADOW EVIDENCE`

## PA-12 Pitcher ER — Sep18 settlement

Model:

`MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2`

Settlement job:

`c84596d6-386f-4b96-8e21-82c6da8afcb8`

Target date: `2026-09-18`

Exact final outcome source:

`MLB_STATSAPI_GAMELOG_EARNED_RUNS`

Forecast diagnostics:

- scored rows: **23**
- MAE: **1.573805682351435**
- RMSE: **2.018516345976814**
- bias (prediction - actual): **-0.3449425144114985**
- correlation: **0.14538181174077733**
- average predicted ER: **2.350709659501545**
- average actual ER: **2.6956521739130435**
- no-play games: 0

This is one prospective shadow day. It does not authorize retuning, probability calibration, recommendations, ROI/CLV/EV claims or production promotion.

## PA-12 Pitcher ER — Sep19 freeze

Freeze job:

`7af91bb0-b7e8-41a0-8901-ddd559a5887e`

Frozen at:

`2026-09-19T14:45:53.723Z` = 10:45:53 Puerto Rico

Result:

- target rows: **26**
- eligible rows: **26**
- blocked rows: **0**
- status: `AWAITING_FINAL_OUTCOMES`

This is valid fixed-clock pregame evidence.

## Run Line V2 — Sep19 first valid fixed-clock freeze

Candidate:

`rl_v2_home_p15_alt_favorite_tsh_q92_v1`

Freeze job:

`01ca6574-c4bd-49a6-a5e8-79c6e3388c85`

Frozen at:

`2026-09-19T14:46:18.538Z` = 10:46:18 Puerto Rico

Result:

- slate games: **15**
- mapped events: **14**
- component-complete games: **15**
- market-eligible games: **6**
- selected games: **0**
- errors: **0**

This is the first valid fixed-clock prospective Run Line V2 observation after Sep17/Sep18 were correctly excluded for missing a valid freeze. Because no game crossed the frozen threshold, Sep19 is a legitimate **no-selection day**, not a failed day and not a scored candidate outcome.

## Gates remain closed

- PA-12 probability layer: **NO**
- PA-12 market recommendations: **NO**
- PA-12 production eligibility: **NO**
- PA-12 retuning from forward evidence: **NO**
- Run Line production eligibility: **NO**
- Official Picks changed: **NO**
- APOSTAR activated: **NO**

Next valid action is continued accumulation and exact settlement of future frozen shadow observations.
