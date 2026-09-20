# MLB Additional 75%+ Props — Daily Runtime Parity

Status: **RESEARCH-ONLY / SHADOW-ONLY**

Date: 2026-09-19

This closeout operationalizes the remaining already-frozen 75%+ prop formulas that can reproduce their historical runtime contract without retuning.

## Certified now

| Market | Frozen rule | Frozen evidence | Runtime state |
| --- | --- | ---: | --- |
| Pitcher Walks | UNDER 2.5 when calibrated UNDER probability >=85% | 125/137 = **91.24%** | PARITY CERTIFIED |
| Batter Hits | UNDER 1.5 when projection <=0.75 | 8,496/9,833 = **86.40%** | PARITY CERTIFIED |
| Batter Total Bases | UNDER 2.5 when projection <=1.0 | 2,021/2,336 = **86.52%** | PARITY CERTIFIED |
| Batter Home Runs | UNDER 0.5 when projection <=0.10 | 12,448/13,507 = **92.16%** | PARITY CERTIFIED |
| Batter Strikeouts | UNDER 1.5 when projection <=0.50 | 1,000/1,074 = **93.11%** | PARITY CERTIFIED |
| Batter Walks | UNDER 0.5 when projection <=0.20 | 2,590/3,106 = **83.39%** | PARITY CERTIFIED |

All five batter runtimes reproduce the exact frozen all-2025 fit surface at **n=40,886** and the exact 2026 eligible universe at **n=35,558**. Their daily evaluator now requires the canonical target-game batter feature row with:

- feature version `MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1`;
- `as_of_date < target_game_date`;
- source-window rule `source_game_date < target_game_date`;
- minimum 10 strict-prior games;
- no same-date Game 1 -> Game 2 leakage;
- exact MLBAM identity for market verification;
- no fuzzy player matching.

Pitcher Walks additionally validates the frozen shadow model artifact digest and the exact TRAIN-only 2.5-walk calibration bins before any daily evaluation is allowed.

## Pitcher Outs remains fail-closed

Frozen candidate: `pitcher_outs_under_18p5_p90_v1`.

Frozen historical evidence remains **215/226 = 95.13%**. The original 2026 holdout used quarantined SportsDataIO starter outcomes cross-matched to Statcast and strict pregame features; that feed ends on **2026-07-19**.

An exact-MLBAM reconstruction using `mlb_ml_xyear_pitcher_game_v1` over the same historical window produced **254 selected / 243 correct**, not the frozen **226 / 215** universe. The rule still performs above 75%, but that is not exact runtime parity.

Therefore Pitcher Outs is now explicitly:

`RUNTIME_PARITY_NOT_CERTIFIED`

with blocker:

`PITCHER_OUTS_INPUT_LINEAGE_NOT_EXACTLY_RECONCILED`

No threshold, line, direction, coefficient or residual distribution was changed to force parity.

## Daily market crossing

A play is market-verified only when the pregame snapshot has the exact MLBAM identity plus the required line, sportsbook, price and provider timestamp. Otherwise a model qualifier remains `MODEL_QUALIFIES_MARKET_NOT_VERIFIED` or `NO_EVALUABLE` as appropriate.

Official Picks remain unchanged. APOSTAR remains disabled. No historical Odds API credits were consumed. Accuracy does not certify ROI, EV or CLV.
