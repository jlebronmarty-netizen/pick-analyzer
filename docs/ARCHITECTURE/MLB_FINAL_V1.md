# MLB Final V1

Status: `MLB_FINAL_CERTIFIED_WITH_FORWARD_MARKETS`

Certification commit: `71380918b2b9e5db7e538be2b2077e7f4a5df540`

MLB is certified as the reference sport for the current product era. The certification is historical-first, replay-isolated and production-safe: it completes the existing full-game historical replay scope, records the exact market boundaries and keeps unsupported markets fail-closed.

## Certified Current Era

| Domain | Authority | Status |
| --- | --- | --- |
| Product odds | The Odds API | `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` |
| Schedule, status, starters and results | MLB Stats API | `MLB_OFFICIAL_PRIMARY` |
| SportsDataIO MLB | Retained rollback only | Routine calls expected `0` |
| Settlement | Stored canonical `game_results` | `PASS` |
| Calibration | HR-03 shadow layer | `SHADOW_ONLY` |

Production evidence on the canonical Vercel deployment reported commit `71380918b2b9e5db7e538be2b2077e7f4a5df540`, overall operations `HEALTHY` and `providerCallsMade=0` from the certification read.

## Historical Replay Scope

| Replay Scope | Events | Predictions | Settled | Production Impact |
| --- | ---: | ---: | ---: | --- |
| Full-game Moneyline | 2,430 | 2,430 | 2,430 | Replay-only |
| Full-game Run Line `home -1.5` | 2,430 | 2,430 | 2,430 | Replay-only |
| Full-game Total Over | 2,430 | 2,430 | 2,430 | Replay-only |
| Total | 2,430 | 7,290 | 7,290 | No Current Era writes |

The replay uses stored Retrosheet/historical feature evidence only. It made 0 provider calls, 0 production prediction writes, 0 production settlement writes, 0 production learning writes and 0 Current Board changes.

## Market Boundary

`MODEL_REPLAY` means the existing model can be evaluated with stored pregame features and settled replay outcomes.

`PRICE_AWARE_REPLAY` additionally requires real historical sportsbook line and price evidence for the exact event, market, selection and line. MLB-FINAL-01 does not fabricate prices or infer missing lines.

| Market | Model Replay | Price-Aware Replay | Certification |
| --- | --- | --- | --- |
| Moneyline home side | `CERTIFIED` | `NOT_CERTIFIED` | Existing historical replay complete |
| Moneyline opposite side | `BLOCKED` | `NOT_CERTIFIED` | Requires direct side contract or certified complement policy |
| Run Line `home -1.5` | `CERTIFIED` | `NOT_CERTIFIED` | Existing historical replay complete |
| Run Line `+1.5` / away spread | `BLOCKED` | `NOT_CERTIFIED` | HR-03 current-era unsupported outside replay support |
| Total Over | `CERTIFIED` | `NOT_CERTIFIED` | Existing historical replay complete |
| Total Under | `BLOCKED` | `NOT_CERTIFIED` | HR-03 unsupported by Over-only replay |
| Team Totals | `FOUNDATION_ONLY` | `NOT_CERTIFIED` | Needs real team-total lines/prices and model support |
| First Five | `FOUNDATION_ONLY` | `NOT_CERTIFIED` | Needs inning-specific features, odds, settlement and starter-change policy |
| NRFI/YRFI | `FORWARD_ONLY` | `NOT_CERTIFIED` | Needs first-inning odds, model, settlement labels and calibration |
| Player Props | `FOUNDATION_ONLY` | `NOT_CERTIFIED` | Player data exists; current/opening/closing prop odds are not certified |

## Forward Data Foundation

Future market expansion must collect exact historical and forward evidence before activation:

- event identity;
- market identity;
- selection identity;
- exact line;
- book or consensus source;
- source market timestamp;
- capture timestamp;
- feature snapshot lineage;
- settlement label;
- replay isolation flag;
- recommendation exposure flag.

No unsupported market can appear as an available recommendation until ingestion, prediction, settlement, replay, calibration, product semantics and provider budgeting are all certified.

## Calibration Readiness

HR-03 remains shadow-only. It does not change production probabilities, Official Picks, Rent Play, Moneyline, Smart Parlay, Performance defaults, settlement, learning or model weights.

## Next Phase

`MLB-FINAL-02_COMPLETE_HISTORICAL_MARKET_DATA_COLLECTION_OR_NBA_01_PREP`

The recommended path is to either collect real historical market prices for the blocked MLB market families or begin NBA preparation using MLB as the reference onboarding template. No NBA implementation is started by this certification.
