# MLB Batter Hits Line Surface V1

Status: **RESEARCH ONLY**

Exact replay contract:
- outcome source: `public.mlb_statcast_batter_game_logs`
- pregame lineage gate: `public.pick2_mlb_batter_daily_features`
- feature version: `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`
- source rule: `source_game_date < target_game_date`
- same-date Game 1 never enters Game 2 prior history

Exact all-2025 refit:
- n = **40,886**
- intercept = **0.362037519693316**
- slope = **0.562031288216736**

Certified U1.5 <=0.75 control reproduces exactly:
- 2025 rolling: **6,123/7,011 = 87.33%**
- 2026: **8,496/9,833 = 86.40%**

## Surface search

Lines: 0.5, 1.5, 2.5, 3.5  
Threshold grid: 0.25–3.00 by 0.05.

Only one development rule passed the full signal gate with more coverage than the existing control:

**U1.5 when projection <=0.80**
- 2025: 9,827/11,439 = **85.91%**
- lift: **+6.36 pp**
- coverage: **31.40%**
- worst month: **84.80%**

2026 one-shot:
- 12,227/14,413 = **84.83%**
- coverage: **40.53%**
- worst month: **81.75%**
- lift: **+4.61 pp**

Because 2026 lift falls below the predeclared 5 pp signal floor, this broader rule is preserved as:
`EXTERNAL_75_PLUS_LIFT_BELOW_5PP_NO_REPLACE`

The existing U1.5 <=0.75 rule remains unchanged.

Other lines:
- 0.5: no 75%+ signal
- 2.5: baseline-dominated, unconditional UNDER ~95.52%
- 3.5: baseline-dominated, unconditional UNDER ~99.40%

Current 2026-09-22 availability:
- 0.5: BetMGM, DraftKings, FanDuel
- 1.5: BetMGM, DraftKings, FanDuel
- 2.5: BetMGM, DraftKings
- 3.5: BetMGM, DraftKings

Boundaries unchanged: research-only, zero historical credits, Official Picks untouched, APOSTAR disabled, no production promotion, tracker unchanged.
