# P2.2D Current Era Settlement Execution And Daily Closure Certification

Status: `PASS`

## Mission

P2.2D executed exactly one protected production operating-day run for the canonical selected action `settle` and certified settlement -> learning evidence -> Current Era Performance closure.

## Protected Execution

- Production commit: `a9b58d88c154d204f8096060c29e1e3fe665a175`.
- Trigger: manual protected scheduler POST with `dryRun=false`.
- HTTP status: 200.
- Duration: 40990 ms.
- Status: `SUCCESS_CHANGED`.
- Selected action: `settle`.
- Invocation IDs: `12156a20-227a-4666-8946-081d48f21536`, `2bbde3a0-b172-4219-b5aa-c4dff9dc5b76`, `246e9091-b4bb-48e4-881f-3e5b49747e6c`.
- Selected dates settled by the canonical loop: 2026-08-01, 2026-08-02, 2026-08-03.
- Provider calls: 0.
- Remote mutations: 38.
- Settlement writes: 130.
- Prediction writes: 0.
- Result writes: 0.
- Learning writes: 0; learning evidence is derived read-only from settled `prediction_history`.

## Aug 3 Canonical Reconciliation

| Market | Expected | Settled | Wins | Losses | Pushes | Blocked | Pending |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Moneyline | 8 | 8 | 5 | 3 | 0 | 0 | 0 |
| Run Line | 8 | 8 | 5 | 3 | 0 | 0 | 0 |
| Total | 8 | 8 | 4 | 3 | 1 | 0 | 0 |

Equation: `24 = 24 settled + 0 blocked + 0 explicit pending`. Silent pending: 0.

Non-production rows excluded: 28. Reasons: `P2_1A_SELECTION_LEVEL_PREVIEW_SUPERSEDED` 26, `SUPERSEDED_BY_FINAL_PREGAME_REFRESH` 2.

## Learning Closure

- Settled canonical predictions: 24.
- Derived learning samples: 24.
- Learning missing: 0.
- Duplicate learning samples: 0.
- Preview-row learning: 0.
- Model-weight promotion: false.
- Champion change: false.
- Epoch assignment: `CURRENT_V2_PRODUCTION`.

## Performance Closure

- Total analyzed: 103.
- Canonical predictions: 69.
- Non-production analysis: 34.
- Recommendation eligible: 0.
- Actionable: 0.
- Official Pick eligible: 0.
- Settled: 24.
- Today pending: 45.
- Wins/losses/pushes: 14/9/1.
- Accuracy: 60.87%.
- Brier: 0.3116.
- Calibration: unavailable in current public presentation.
- Trust: 24.56.
- Settlement coverage: 34.78%.

## Cross-Surface Evidence

- `/api/performance`: HTTP 200, `apiStatus=SUCCESS`, Current Era 69 canonical / 24 settled / 45 pending.
- `/api/operations/settlement-guarantee?includeValidation=true`: HTTP 200, settled rows 97, ready rows 0, blocked rows 0, silent pending 0.
- `/api/operations/event-lifecycle?sportKey=baseball_mlb&operatingDate=2026-08-03&limit=200`: HTTP 200, 8 events, `ARCHIVED`, imported results, ready 0.
- `/api/operations/adaptive-refresh/status`: HTTP 200, next action moved to `sync_results` for older missing-result rows; settlement-ready rows 0.
- `/api/operations/prediction-coverage`: HTTP 200, current day coverage 45/45, provider calls 0.
- `/api/dashboard/today`, `/api/current-board?mode=current&limit=200`, `/performance`, `/mlb-operations` and `/mission-control`: HTTP 200.

## Classification

`P2_2D_CURRENT_ERA_SETTLEMENT_CLOSED`

P2.2 is now `PRODUCTION_CERTIFIED`. P2.3 is the next eligible phase but was not started. MC-08E remains paused.
