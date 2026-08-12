# NBA-01A Historical Source Bootstrap

Status: `NBA_HISTORICAL_BOOTSTRAP_READY_PENDING_STAT_SOURCE_ACCESS`

NBA-01A continues from published NBA-01. It is an audit/cost/modeling phase only: no provider API calls, no historical import, no NBA production activation and no bulk replay.

## Production Alignment

| Item | Value |
| --- | --- |
| Starting commit | `20c970799e11a07a4b098045d22c5918fd2bd05c` |
| NBA-01 status | `NBA_DATA_FOUNDATION_PARTIAL_MORE_IMPORT_REQUIRED` |
| NBA production | inactive |
| SportsDataIO NBA | legacy/trial only |
| MLB | unchanged reference architecture |

## Provider Strategy

| Domain | Decision |
| --- | --- |
| Odds | The Odds API |
| Historical prices | The Odds API, budget-gated |
| Schedule/status/results/stats | NBA Stats public endpoint family, access-gated |
| Paid stat fallback | BALLDONTLIE or equivalent only with explicit paid-source approval |
| SportsDataIO | do not expand |

## The Odds API Historical Coverage

| Area | Finding |
| --- | --- |
| NBA sport key | `basketball_nba` |
| Current core markets | `h2h`, `spreads`, `totals` |
| Historical core start | mid-2020 / June 2020 class |
| Additional-market historical start | May 2023 class |
| Snapshot semantics | closest snapshot equal to or before requested timestamp |
| Historical cost formula | `10 x markets x regions x requested timestamps` |
| Core request cost | 30 credits for `h2h,spreads,totals` in `us` |
| Scores role | recent/current result support only, not deep historical authority |

## Budget Gate

Before any NBA historical odds request, the requester must choose a budget:

| Import Strategy | Approx Requests | Approx Credits | Boundary |
| --- | ---: | ---: | --- |
| 2024-25 one daily card snapshot | 170 | 5,100 | explicit budget approval |
| 2024-25 two daily snapshots | 340 | 10,200 | explicit budget approval |
| 2024-25 three daily snapshots | 510 | 15,300 | explicit budget approval |
| 2024-25 per-game near-close | 1,230 | 36,900 | explicit budget approval |

Recommended first step after stat import: one daily card snapshot for 2024-25, then evaluate exact-line price coverage before spending more.

## Stat Source Gate

NBA Stats public endpoints are the best primary candidate for non-odds history because they expose NBA-native game/team/player identity and game-stat/boxscore endpoint families. Bulk use still requires human approval because access behavior, rate limits and terms must be accepted for the project.

Required human action:

```text
Authorize NBA Stats public endpoint historical import for 2024-25 regular season, using polite bounded rate limits, browser-compatible headers, checkpoint/resume, and no redistribution beyond internal Pick Analyzer analysis.
```

## NBA-02 Dry-Run Scope

NBA-02 should not begin until stat-source authorization is granted and the first target season is imported.

| Item | Value |
| --- | --- |
| Model replay seasons | 2024-25 regular season first |
| Price-aware seasons | 2024-25 regular season after odds budget |
| Markets | Moneyline, Spread, Total |
| Expected games | approximately 1,230 |
| Expected predictions | approximately 3,690 |
| Feature policy | chronological pregame only |
| Settlement policy | exact line, full-game overtime included |
| First half | deferred |
| Props | deferred |

## Accounting

| Item | Count |
| --- | ---: |
| The Odds API calls | 0 |
| The Odds API credits | 0 |
| Stat provider calls | 0 |
| SportsDataIO calls | 0 |
| Database mutations | 0 |
| Current Era NBA prediction writes | 0 |

## Blockers

| Blocker | Severity | Affects |
| --- | --- | --- |
| `PROVIDER_ACCESS_AUTHORIZATION_REQUIRED` | P0 | model replay |
| `EXPLICIT_BUDGET_AUTHORIZATION_REQUIRED` | P1 | price-aware replay |
| `PERIOD_MARKET_VALIDATION_REQUIRED` | P2 | first-half/quarter markets |
| `PROP_BUDGET_AND_SETTLEMENT_REQUIRED` | P2 | player props |

Final classification: `NBA_HISTORICAL_BOOTSTRAP_READY_PENDING_STAT_SOURCE_ACCESS`.
