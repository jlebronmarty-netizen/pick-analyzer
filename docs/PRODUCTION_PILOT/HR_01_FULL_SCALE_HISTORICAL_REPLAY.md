# HR-01 Full-Scale MLB Historical Replay

Status: `HR_01_COMPLETE_READY_FOR_CALIBRATION_REVIEW`

Starting commit: `4ec873187a4870bafb8dc4f655aa43802ca34bb3`.

Production commit observed: `4ec873187a4870bafb8dc4f655aa43802ca34bb3`.

Certification time: `2026-08-09T00:55:56Z`.

## Verdict

HR-01 is certified complete from durable replay evidence. The full historical replay dataset already exists in replay-only storage and a fresh dry-run idempotency pass confirmed that rerunning the full scope would insert no duplicate rows.

No runtime code changed. No provider calls were made. No Current Era prediction rows, production learning weights, Official Pick policy, scheduler cadence, SportsDataIO budget, The Odds API budget or production Performance scope changed.

## Engine Contract

| Contract | Value |
| --- | --- |
| Bounded P2.3 engine | `historical_progressive_replay_v1` |
| Bounded P2.3 feature version | `historical_prediction_snapshot_lineage_pilot_v1` |
| Bounded P2.3 policy | `p2_3_frozen_engine_replay_policy_v1` |
| Full HR-01 engine | `retrosheet_historical_replay_phase_2b_v1` |
| Full HR-01 family | `retrosheet_historical_replay_phase_2b_v1` |
| Full HR-01 source | `retrosheet_full_historical_replay` |
| Full HR-01 checkpoint | `retrosheet_historical_replay_phase_2b_v1:full_scope` |
| Scope | `REPLAY` only |
| Markets | moneyline, run line/spread, total |

The full replay uses stored Retrosheet-backed historical feature snapshots and final scores. It does not use the current production model engine and does not train or recalibrate production.

## Eligibility Inventory

| Item | Count |
| --- | ---: |
| Historical MLB events available | 2,430 |
| Historical feature snapshots | 70,470 |
| Events with valid pregame historical feature lineage | 2,430 |
| Events with valid final result | 2,430 |
| Events with sufficient moneyline features | 2,430 |
| Events with sufficient run-line features | 2,430 |
| Events with sufficient total features | 2,430 |
| Eligible historical events | 2,430 |
| Excluded events | 0 |

Exclusion reasons: `MISSING_FEATURE_SNAPSHOT=0`, `MISSING_RESULT=0`, `INSUFFICIENT_PREGAME_LINEAGE=0`, `LEAKAGE_RISK=0`, `OTHER=0`.

Feature-group gaps: team form `0`, starter information `0`, bullpen evidence `0`, park factor `0`, game-state context `0`, market evidence `0`.

## Replay Execution Evidence

| Item | Result |
| --- | ---: |
| Replay events before HR-01 certification | 2,430 |
| Replay events added during HR-01 certification | 0 |
| Replay events total | 2,430 |
| Expected replay predictions | 7,290 |
| Replay predictions generated | 7,290 |
| Replay predictions reused by dry-run | 7,290 |
| Replay predictions settled | 7,290 |
| Checkpoint count | 49 |
| Batch size | 50 |
| Snapshot lookups | 211,410 |
| Duplicate replay rows | 0 |
| Leakage failures | 0 |
| Provider calls | 0 |

The fresh idempotency pass ran with `dryRun=true` from `2026-08-09T00:54:07Z` to `2026-08-09T00:55:56Z`. It attempted 7,290 predictions, inserted 0, reused 7,290, wrote no checkpoints, wrote no jobs and made no provider calls.

## Overall Metrics

| Metric | Value |
| --- | ---: |
| Predictions | 7,290 |
| Wins | 3,344 |
| Losses | 3,916 |
| Pushes | 30 |
| Accuracy | 46.06% |
| Brier | 0.2508 |
| Calibration error | 1.74 |
| Calibration bias | +1.74 |
| Average confidence | 48.43 |
| ROI | Not certified; historical price/stake evidence is not complete enough for full-scope ROI |

## Market Metrics

| Market | Sample | Wins | Losses | Pushes | Accuracy | Brier | Calibration error | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Moneyline | 2,430 | 1,317 | 1,108 | 5 | 54.31% | 0.2545 | 4.25 | -4.25 |
| Run line | 2,430 | 864 | 1,566 | 0 | 35.56% | 0.2387 | 6.48 | +6.48 |
| Total | 2,430 | 1,163 | 1,242 | 25 | 48.36% | 0.2592 | 2.99 | +2.99 |

Moneyline materially outperformed run line on accuracy. Run line carried the best Brier but had poor hit rate and positive calibration bias. High-probability buckets were overconfident and require calibration review before any production model change.

## Probability Buckets

| Bucket | Sample | Wins | Losses | Pushes | Accuracy | Avg probability | Calibration diff |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| <40 | 1,561 | 618 | 936 | 7 | 39.77% | 36.42 | -6.47 |
| 40-45 | 1,240 | 496 | 742 | 2 | 40.06% | 42.66 | +2.60 |
| 45-50 | 1,503 | 706 | 788 | 9 | 47.26% | 47.45 | +0.19 |
| 50-55 | 1,329 | 642 | 677 | 10 | 48.67% | 52.28 | +3.60 |
| 55-60 | 865 | 449 | 415 | 1 | 51.97% | 57.34 | +5.37 |
| 60-65 | 397 | 226 | 171 | 0 | 56.93% | 62.08 | +5.15 |
| 65-70 | 196 | 103 | 93 | 0 | 52.55% | 67.02 | +14.47 |
| 70+ | 199 | 104 | 94 | 1 | 52.53% | 76.04 | +24.75 |

## Chronological Cohorts

| Cohort | Events | Predictions | Wins | Losses | Pushes | Accuracy | Brier | Calibration error | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 | 608 | 1,824 | 860 | 949 | 15 | 47.54% | 0.2696 | 0.03 | +0.03 |
| Q2 | 608 | 1,824 | 781 | 1,035 | 8 | 43.01% | 0.2451 | 5.03 | +5.03 |
| Q3 | 608 | 1,824 | 878 | 944 | 2 | 48.19% | 0.2472 | 0.48 | -0.48 |
| Q4 | 606 | 1,818 | 825 | 988 | 5 | 45.50% | 0.2413 | 2.37 | +2.37 |

Performance is regime-sensitive. Q2 underperformed materially while Q3 was strongest by accuracy. This supports calibration review, not automatic production tuning.

## Isolation

| Guard | Result |
| --- | --- |
| Current Era writes | 0 |
| Production learning writes | 0 |
| Production settlement writes | 0 |
| Provider calls | 0 |
| SportsDataIO calls | 0 |
| The Odds API calls | 0 |
| Replay duplicate ids | 0 |
| Replay idempotency | PASS |
| Performance default excludes replay | PASS |
| Replay displayed only as replay/historical scope | PASS |

Current Era and replay remain separate. Default Performance remains Current Era; replay evidence is exposed only through explicit replay status/performance contracts.

Current Era canonical prediction count observed during HR-01 analysis was 406 before and 406 after the dry-run certification. Production learning weight rows remained 41 before and after.

## Calibration Readiness

Classification: `READY_FOR_CALIBRATION_REVIEW`.

HR-01 does not authorize calibration. Recommended next phase: `HR-02 HISTORICAL CALIBRATION REVIEW`, focused on market-specific and probability-bucket calibration evidence.
