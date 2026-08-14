# NBA-02B3 Price-Aware Historical Evaluation

Status: `NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_PASS_READY_FOR_FINAL_DIAGNOSTICS`

NBA-02B3 evaluated the stored NBA historical replay rows against certified
pregame The Odds API price evidence. This is a historical shadow/research
evaluation only: NBA Current Era remains inactive, no Official Picks were
created, production learning and production calibration were not written, and
no provider calls were made.

## Universe

| Metric | Count |
| --- | ---: |
| Historical events | 3710 |
| MODEL_REPLAY predictions | 14840 |
| Price-aware events | 1112 |
| Price-aware predictions | 3336 |
| Moneyline price-aware | 1112 |
| Spread price-aware | 1112 |
| Total price-aware | 1112 |
| First Half price-aware | 0 |

The prior 1,196 full-core estimate reconciles to 1112
certified price-aware events. The 84
event difference is fully explained by certified exact-selection/line binding
filters; unexplained events are 0.

## Price-Aware Performance

| Metric | Value |
| --- | ---: |
| Sample | 3336 |
| Wins | 1797 |
| Losses | 1505 |
| Pushes | 34 |
| Accuracy | 54.42% |
| Brier | 0.2615 |
| Calibration error | 9.88 |
| Net units | -219.1935 |
| ROI | -6.57% |

## Safety

- Price selection policy: `DETERMINISTIC_PRIORITY_FanDuel_DraftKings_BetMGM_Caesars_THEN_LATEST_PREGAME`
- Snapshot policy: `LATEST_CERTIFIED_PREGAME_SNAPSHOT_WITH_DETERMINISTIC_BOOK_PRIORITY`
- Closing-line classification: `NEAREST_CERTIFIED_PREGAME_SNAPSHOT`
- Post-start prices used: 0
- Market inversion failures: 0
- Current Era prediction delta: 0
- Official Pick delta: 0
- Provider calls: 0

## Next

`NBA-02C_HISTORICAL_MODEL_DIAGNOSTICS_AND_CURRENT_ERA_READINESS`
