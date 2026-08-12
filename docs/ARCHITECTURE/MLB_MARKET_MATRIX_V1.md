# MLB Market Matrix V1

Status: `MLB_MARKET_MATRIX_CERTIFIED`

This matrix separates production-supported MLB markets from future market families. A market is production-supported only when real odds, exact market identity, prediction generation, settlement, learning compatibility, calibration/readiness evidence and product safety are all present.

MLB-FINAL-01 adds the historical replay boundary: existing replay is `MODEL_REPLAY`, not `PRICE_AWARE_REPLAY`. Expanded markets require real historical sportsbook line and price evidence before price-aware replay or calibration can be claimed.

## Current Production Markets

| Market | Production | Historical Replay | HR-03 Calibration | Product Notes |
| --- | --- | --- | --- | --- |
| Moneyline | `YES` | 2,430 replay rows | Supported, selected method `NO_CALIBRATION` | Current Board production market |
| Moneyline opposite side | `NO` as separate historical replay row | 0 direct opposite-side replay rows | Not certified as independent replay side | Requires direct side contract or certified complement policy |
| Run Line / Spread | `YES` for current exact-line rows | 2,430 replay rows, frozen `-1.5` support | Supported only for replay-trained `-1.5`; `+1.5` unsupported by HR-03 | Exact line identity required |
| Game Total Over | `YES` when current exact line exists | 2,430 replay rows, Over-only | Supported for Over replay regime | Exact line identity required |
| Game Total Under | `YES` as raw production prediction when generated | 0 Under replay rows | Unsupported by HR-03 because replay was Over-only | No inherited calibrated probability |

## Future Market Families

| Market Family | Current Classification | Main Blocker | Production Action |
| --- | --- | --- | --- |
| Team totals | `CONTRACT_READY` | No stored real team-total odds coverage | Future shadow-only epic |
| Alternate run lines | `FUTURE_MARKET` | Line ladder history, model distribution layer and settlement calibration | Do not activate |
| Alternate totals | `FUTURE_MARKET` | Line ladder history, model distribution layer and settlement calibration | Do not activate |
| First Five | `ARCHITECTURE_FOUNDATION_ONLY` | No stored real First Five odds; explicit starter-change/no-action policy still required | Do not activate |
| NRFI/YRFI | `FUTURE_MARKET` | No certified first-inning odds, model, settlement labels or calibration | Do not activate |
| Pitcher props | `DATA_READY_MARKET_BLOCKED` | 0 current prop odds, 0 opening lines, 0 closing lines, no active prop prediction contract | Do not activate |
| Batter props | `DATA_READY_MARKET_BLOCKED` | 0 current prop odds, 0 opening lines, 0 closing lines, no active prop prediction contract | Do not activate |

## Exact-Line Rule

Prediction identity is:

`event + market + selection + line`

Examples:

- `Over 8.0` is not `Over 8.5`.
- `ARI +1.5` is not `ARI -1.5`.
- A price for a moved line must not be bound to an old-line probability.

ODDS-03C-R2 implemented the line-versioned re-prediction writer, and ODDS-03C-R2A repaired UUID-safe persistence. That writer is compatible with future line movement, but it does not authorize a new market family by itself.

## Historical Market Expansion Decision

No additional historical market was activated in MLB-FINAL-01. Historical evidence supports calibration review for existing full-game core markets only. Expansion markets require their own odds history, settlement labels, replay, calibration and shadow validation.
