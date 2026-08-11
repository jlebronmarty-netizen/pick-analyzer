# MLB Final Closeout

Status: `MLB_FINAL_CLOSEOUT_PASS_WITH_FUTURE_MARKETS`

Starting commit: `4fb06cb795a9fad00cd60b4e3f5b134c69701444`

Production commit observed: `4fb06cb795a9fad00cd60b4e3f5b134c69701444`

Observation time: `2026-08-11T17:18Z`

## Verdict

MLB core production operation is certified for the current pilot scope:

- The Odds API is product odds authority.
- MLB Stats API is the primary MLB non-odds source for schedule/status/results/starter identity.
- SportsDataIO MLB routine dependency is removed and retained only for rollback.
- Current Era, settlement, Performance and HR-03 shadow calibration remain separated.
- Unsupported markets remain blocked from actionability.

The closeout is not a claim that historical market expansion or player props are production-ready. Those are classified as future work.

## Production Evidence

| Surface | Evidence |
| --- | --- |
| `/api/system/version` | HTTP 200, commit `4fb06cb795a9fad00cd60b4e3f5b134c69701444`, `providerCallsMade=0` |
| `/api/operations/odds-primary-authority` | `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT`, product authority `THE_ODDS_API`, `providerCallsMade=0` |
| `/api/operations/mlb-official-replacement` | `activeMode=MLB_OFFICIAL_PRIMARY`, SportsDataIO not disabled/cancelled, `providerCallsMade=0` |
| `/api/operations/health` | Overall `HEALTHY`; scheduler, market freshness, provider budget, settlement closure and product readiness all `HEALTHY` |
| `/api/current-board?mode=current&limit=200` | 15 games, 39 candidates, markets `Moneyline`, `Run Line`, `Total` |
| `/api/performance` | Current V2 canonical rows 354, settled 291, pending 63, accuracy 49.13%, Brier 0.2575, settlement coverage 82.2% |
| `/api/operations/settlement-guarantee?includeValidation=true` | `PASS`, ready rows 0, blocked rows 0, silent pending rows 0 |
| `/api/model/shadow-calibration` | HR-03 shadow-only calibration, production probabilities unchanged |
| `/api/mlb/player-props/readiness` | 18 props audited, 0 current odds-ready, 0 production-ready |

## Current Board

| Metric | Value |
| --- | ---: |
| Operating date | 2026-08-11 |
| Games | 15 |
| Candidates | 39 |
| Moneyline candidates | 15 |
| Run Line candidates | 15 |
| Total candidates | 9 |
| Official Picks | 0 |
| Modeled value candidates | 2 |
| Fresh candidates | 38 |
| Stale candidates | 1 |
| Actionable candidates | 0 |
| Review-only candidates | 38 |

## Historical Replay And Calibration

| Item | Status |
| --- | --- |
| Historical replay events | 2,430 |
| Historical feature snapshots | 70,470 |
| Historical replay predictions | 7,290 |
| Replay settlement | 7,290 settled |
| Replay leakage failures | 0 |
| HR-03 calibration | Shadow-only |
| Calibration promotion | Not authorized |

HR-03 remains blocked from production promotion because Current Era support does not match replay training support: Total Under and Run Line `+1.5` are unsupported by the replay-trained calibration registry.

## Market Expansion

| Market | Closeout Classification |
| --- | --- |
| Moneyline | `PRODUCTION_SUPPORTED` |
| Run Line current exact line | `PRODUCTION_SUPPORTED_RAW` |
| Run Line `-1.5` calibration | `SHADOW_SUPPORTED` |
| Run Line `+1.5` calibration | `FUTURE_MARKET_UNSUPPORTED_BY_REPLAY` |
| Total Over calibration | `SHADOW_SUPPORTED` |
| Total Under calibration | `FUTURE_MARKET_UNSUPPORTED_BY_REPLAY` |
| Team Totals | `CONTRACT_READY_FUTURE_EPIC` |
| First Five | `ARCHITECTURE_FOUNDATION_ONLY` |
| NRFI/YRFI | `FUTURE_MARKET_BLOCKED` |
| Player Props | `DATA_READY_MARKET_BLOCKED` |

No new market is activated by this closeout.

## Player Props

Player props have stored player identity and historical outcome foundation, but no current prop odds and no opening/closing prop-line evidence.

Production status: `PLAYER_PROPS_FOUNDATION_ONLY`.

## Autonomy

Natural scheduler and operations evidence show the current MLB operating system is healthy for pilot monitoring. SportsDataIO routine MLB calls are expected to remain zero in Stage 3 plus MLB Official Primary mode.

## Remaining Gaps

- `operationsProductionReady=false` remains in the health certification object while `closedBetaOperationsReady=true`.
- Current Era settlement coverage is 82.2%, with 63 pending canonical rows that require natural event finality/result closure.
- HR-03 calibration remains shadow-only.
- Future markets need their own odds, settlement, replay and calibration evidence.
- Player props need provider/budget authorization and current line evidence before any pilot.

## Decision

Final classification: `MLB_FINAL_CLOSEOUT_PASS_WITH_FUTURE_MARKETS`.

Next master phase: `MULTI_SPORT_HANDOFF_PREPARATION`, starting with the sport onboarding template and an NBA readiness review. MC-03 is not started by this closeout.
