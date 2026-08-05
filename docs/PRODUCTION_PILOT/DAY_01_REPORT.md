# Production Pilot Week Day 1 Report

Status: `DAY_1_PASS_WITH_MONITORING`

## Baseline

| Field | Value |
| --- | --- |
| Pilot date | 2026-08-05 |
| Canonical operating date | 2026-08-05 |
| America/Puerto_Rico time observed | Wed, Aug 5, 7:41 PM AST |
| Active production epoch | CURRENT_V2_PRODUCTION |
| Local/origin baseline | 27e9e06e287841c1f593e56555fef47482b3c00e |
| Production commit | 27e9e06e287841c1f593e56555fef47482b3c00e |
| Primary scheduler | Vercel Cron |
| Fallback scheduler | GitHub Actions |
| Production Pilot Week | ACTIVE Day 1 |
| MC-03 | NOT_STARTED |

## Product State

The product is safe for monitored daily use. It does not surface a bet as actionable.

| Metric | Evidence |
| --- | ---: |
| Games today | 15 |
| Remaining pregame/current board games | 2 |
| Current Board candidates | 6 |
| Official Picks | 0 |
| Recommendation eligible | 0 |
| Actionable | 0 |
| Fresh visible markets | 6 |
| Stale visible markets | 0 |
| Product SLA candidates waiting for refresh | 6 |
| Latest visible market snapshot | 2026-08-05T23:37:54.346Z |
| Latest provider/source market timestamp | 2026-08-05T19:37:43.000Z |

Primary card classification:

| Card | Classification | Reason |
| --- | --- | --- |
| Rent Play | UNAVAILABLE | No candidate satisfies Official Pick policy. |
| Moneyline Bet | BEST_AVAILABLE_RESEARCH | DET moneyline has positive model edge/EV but remains analyzed-only with production gate, calibration, low-confidence and model-probability blockers. |
| Smart Parlay | WATCH | No leg is recommendation eligible; current evidence is research-only. |
| Watchlist | WATCH | Six preview candidates remain visible as research, not recommendations. |
| Decision Summary | NO_STRONG_EDGE_TODAY | Homepage reports no official bet and games in progress. |

## Canonical Market Coverage

Current active Current Board coverage is complete for the two remaining pregame games:

| Market | Count |
| --- | ---: |
| Moneyline | 2 |
| Run Line / Spread | 2 |
| Total | 2 |

Expected canonical predictions for remaining Current Board games: 6.

Actual canonical predictions visible on Current Board: 6.

Coverage: 100%.

Current Era Performance reports 114 canonical prediction rows overall, 69 settled, 45 valid pending, and 49 non-production analysis rows excluded from canonical metrics.

## Scheduler And Freshness

| Domain | Status |
| --- | --- |
| Scheduler Execution | HEALTHY |
| Missed intervals | 0 |
| Market Freshness | HEALTHY |
| Provider Budget | HEALTHY |
| Product Readiness | HEALTHY |
| Operations Health | HEALTHY |

Latest evidence:

- Last Vercel primary success: 2026-08-05T23:38:02.317Z.
- Provider calls today: 12.
- Provider calls last hour: 6.
- Hard remaining calls: 988.
- Estimated remaining calls after reserve: 838.
- Latest market acquisition inserted 24 snapshots from 15 provider rows for 4 eligible pregame events; 11 events were excluded because they had started.

## Betting Decision Review

No candidate is an Official Pick, recommendation eligible, or actionable.

| Event | Market | Selection | Confidence | Edge | EV | Policy | Classification |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| DET @ SEA | Total | Under | 35.64 | -25.42 | -48.75 | ANALYZED_ONLY | Research only |
| SD @ ARI | Total | Under | 38.89 | -19.98 | -37.97 | ANALYZED_ONLY | Research only |
| SD @ ARI | Spread | SD | 39.64 | -11.45 | -25.20 | ANALYZED_ONLY | Research only |
| SD @ ARI | Moneyline | SD | 42.20 | -19.32 | -33.33 | ANALYZED_ONLY | Research only |
| DET @ SEA | Spread | DET | 49.62 | -11.35 | -17.88 | ANALYZED_ONLY | Research only |
| DET @ SEA | Moneyline | DET | 47.77 | 5.12 | 11.73 | ANALYZED_ONLY | Research only |

Common blockers include production gate, quarantined row, stale odds/source-time SLA, insufficient calibration, low confidence, low model probability, and non-positive edge/EV where applicable.

## Performance Baseline

| Metric | Value |
| --- | ---: |
| Current Era canonical predictions | 114 |
| Settled canonical rows | 69 |
| Valid pending | 45 |
| Blocked | 0 |
| Silent pending | 0 |
| Wins | 30 |
| Losses | 37 |
| Pushes | 2 |
| Accuracy | 44.78% |
| Brier | 0.2461 |
| Calibration error | 3.68 |
| Trust | 43.58, Limited |
| Pipeline / settlement coverage | 60.53% |
| Recommendation eligible | 0 |
| Official Pick eligible | 0 |

Trust and Pipeline Readiness remain separate concepts. Replay remains isolated: 30 replay predictions, 30 replay settled, 14 wins, 16 losses, 0 pushes, and zero production writes.

## Prior-Day Closure

Prior day is closed in Performance:

| Metric | Value |
| --- | ---: |
| Prior-day canonical predictions | 45 |
| Results imported | Proven by settlement |
| Settled | 45 |
| Wins | 16 |
| Losses | 28 |
| Pushes | 1 |
| Explicit pending | 0 |
| Silent pending | 0 |
| Settlement coverage | 100% |

## Cross-Surface Consistency

Observed differences are scope-based:

- Dashboard current operating day includes 15 games and reports games in progress.
- Current Board scopes to the two remaining pregame games and returns 6 candidates.
- Performance Today reports 45 valid pending canonical predictions and 0 settled because the current operating day is not closed.
- Performance Yesterday reports 45 settled canonical predictions.
- Settlement Guarantee passes with no silent pending rows.
- Mission Control is updated to Production Pilot Week ACTIVE Day 1.

## Issue Log

| ID | Severity | Surface | Observation | Status |
| --- | --- | --- | --- | --- |
| PP-D1-001 | MEDIUM | Dashboard vs Current Board | Dashboard says recommendations are locked while Current Board still shows two remaining pregame games. This is an explicit current-operating-day vs remaining-board scope difference. | MONITORING |
| PP-D1-002 | MEDIUM | Freshness semantics | Current Board dataFreshness is fresh by visible snapshot ingestion, while Product SLA marks candidates WAIT_FOR_REFRESH from provider/source timestamp age. This correctly blocks actionability but may confuse users. | MONITORING |
| PP-D1-003 | LOW | Mission Control API metadata | Before Day 1 status update, Production Pilot Week reused queue metadata from MC-02 in the API response. Documentation/status now identifies the pilot explicitly. | REPAIRED |

## Scorecard

| Area | Score |
| --- | ---: |
| Operational Readiness | 95 |
| Product Readiness | 88 |
| Data Freshness | 82 |
| Prediction Coverage | 100 |
| Settlement Closure | 100 |
| Performance Coherence | 92 |
| UX Coherence | 82 |
| Overall Day 1 Score | 91 |

## Verdict

`DAY_1_PASS_WITH_MONITORING`

No Critical or unsafe High issue was found. The system is safe for monitored daily use because no stale, unsupported, or policy-blocked evidence is shown as actionable.

Day 2 was not started. MC-03 was not started.
