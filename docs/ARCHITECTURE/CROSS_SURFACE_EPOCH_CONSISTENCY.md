# Cross-Surface Epoch Consistency

P2.4 defines the read-only surface consistency contract for the active Pick Analyzer V2 product.

## Canonical Scopes

| Scope | Meaning | Included In Current Era | Included In Replay |
| --- | --- | --- | --- |
| CURRENT_V2_PRODUCTION | Active production prediction epoch. | Yes | No |
| LEGACY_PRE_V2 | Historical rows created before the V2 epoch. | No | No |
| REPLAY | Isolated historical progressive replay rows. | No | Yes |

## Surface Contract

All major surfaces must disclose or derive the same operating-date and scope rules:

| Surface | Canonical Source | Scope |
| --- | --- | --- |
| Homepage | /api/dashboard/today and Current Board presentation data | Current operating day decision view |
| Dashboard | /api/dashboard/today | Current operating day |
| Current Board | /api/current-board | Current operating day current predictions |
| Most Likely | /api/market-opportunities/most-likely | Recommendation-filtered current view |
| Best Value | /api/market-opportunities/best-value | Value-filtered current view |
| AI Bet Finder | /api/ai-bet-finder | Current diagnostic or recommendation view |
| Betting Workbench | /api/current-board plus user ledger APIs | Current board plus user-owned ledger |
| Game Intelligence | /game-intelligence | Event detail diagnostics |
| Performance | /api/performance | Current V2 Production plus isolated Replay section |
| MLB Operations | Operations endpoints | Scheduler, lifecycle, settlement, freshness evidence |
| Mission Control | /api/mission-control and docs/MISSION_CONTROL | Program status only |
| Prediction Coverage | /api/operations/prediction-coverage | Supported-market coverage |
| E2E Integrity | /api/operations/e2e-integrity | Cross-surface consistency authority |
| Historical Replay | /api/operations/historical-replay | Replay-only metrics |

## Count Rules

Current Era canonical predictions must reconcile as:

canonicalPredictionRows = settledCanonicalRows + pendingCanonicalRows + blockedCanonicalRows

Replay predictions must reconcile as:

replayPredictionRows = replaySettledRows + replayPendingRows

Expected differences are allowed only when the surface scope differs. Recommendation views may show fewer rows than Current Board. Replay rows must never appear as current recommendations, Current Era trust rows, Official Picks, production learning or current settlement coverage.

## Safety

P2.4 is read-only. It does not change prediction formulas, confidence, EV, Kelly, Official Pick policy, recommendation thresholds, settlement, learning, provider budgets, scheduler cadence or replay rows.
