# MLB Batter Strikeouts Line Surface V1

Status: **RESEARCH ONLY**

Contract: `MLB_BATTER_STRIKEOUTS_LINE_SURFACE_V1/1.0.0`

## Exact replay contract

Outcome source:
`public.mlb_statcast_batter_game_logs`

Pregame lineage gate:
`public.pick2_mlb_batter_daily_features`

Required feature version:
`MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`

Required source rule:
`source_game_date < target_game_date`

Same-day Game 1 is never allowed to enter Game 2 history.

The recovered all-2025 refit reproduces exactly:
- n = **40,886**
- intercept = **0.243436273584974**
- slope = **0.713440597820141**

The expanding May-Sep rolling U1.5 control also reproduces exactly:
- May 36/36
- Jun 94/99
- Jul 104/112
- Aug 165/172
- Sep 165/173
- total **564/592 = 95.27%**

## Line-surface search

Exact lines:
- 0.5
- 1.5 control
- 2.5

Threshold grid:
- 0.25 to 2.50
- step 0.05

Development champion rule:
maximize selected n among candidates satisfying:
- accuracy >=75%
- n >=60
- selections in all 5 rolling months
- worst month >=65%
- lift >=5 pp over exact-line side baseline

## Results

### OVER 0.5

Frozen development rule:
`projection >= 1.10`

2025:
- 1,036 / 1,340 = **77.31%**
- baseline = **58.84%**
- lift = **+18.47 pp**
- coverage = **3.68%**
- worst month = **71.87%**
- minimum month n = **123**

2026 one-shot:
- 2,382 / 3,203 = **74.37%**
- baseline = **57.84%**
- lift = **+16.52 pp**
- coverage = **9.01%**
- worst month = **71.43%**

State:
`EXTERNAL_BELOW_75_NO_RETUNE`

The candidate is not rescued by tightening the threshold after observing 2026.

### UNDER 1.5 control

Existing certified rule:
`projection <= 0.50`

2026 replay:
- 1,000 / 1,074 = **93.11%**
- worst month = **91.30%**

This exactly matches the frozen external artifact.

### UNDER 2.5

The unconditional UNDER baseline is already approximately **96.08%** in development.
No selective rule passed the >=5 pp signal gate.

State:
`BASELINE_DOMINATED_NO_SIGNAL_GATE`

## Current relevance — 2026-09-22

DraftKings captured:
- K 0.5 for 18 batters
- K 1.5 for 18 batters
- K 2.5 for 5 batters

The new O0.5 formula therefore would have increased market availability, but it failed the 2026 >=75% target and remains closed.

## Boundaries

- research only
- no historical Odds API credits
- no provider calls for this research
- Official Picks untouched
- APOSTAR disabled
- no production promotion
- tracker unchanged
