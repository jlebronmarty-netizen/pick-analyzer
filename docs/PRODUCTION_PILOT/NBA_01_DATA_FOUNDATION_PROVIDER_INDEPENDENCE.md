# NBA-01 Data Foundation Provider Independence

Status: `NBA_DATA_FOUNDATION_PARTIAL_MORE_IMPORT_REQUIRED`

Starting commit: `bf89777ad5f97f8e7fb40ac1835b29424182ca20`

## Verdict

NBA has a substantial reusable foundation, but it is not ready for full historical replay. NBA-01 preserves the working subsystems and documents the provider-independent target architecture while blocking production activation and bulk import until official/free source access is certified.

## Reuse Result

| Subsystem | Status | Action |
| --- | --- | --- |
| Data Sync V1 | partial, reusable | reuse with certification |
| Prediction Engine V1 | preview/trial capable | reuse with certification |
| Settlement V1 | deterministic for full-game and first-half when scores exist | reuse with certification |
| Model Health V2 | watch/degraded signals exist | reuse |
| Backtesting / Calibration | trial-only sample exists | reuse, do not promote |
| Feature Store | schema and preview validation exist | reuse, extend after import |
| Current Board / Performance / Scheduler | not production activated | plan only |

## Provider Result

The Odds API is the NBA odds target. Official/free NBA source candidates are the target for schedule/status/results/stats/boxscores, but bulk import requires access and terms review.

SportsDataIO NBA is classified as legacy/trial evidence and is not required for normal NBA runtime.

## Historical Readiness

NBA currently has a 14-event sample, 13 completed-game sample, 27 trial predictions, 27 settled trial rows and 47 trial feature snapshots. That is enough to preserve the architecture, not enough to run full historical replay.

## Safety Accounting

| Item | Count |
| --- | ---: |
| The Odds API calls | 0 |
| The Odds API credits | 0 |
| Official/free provider calls | 0 |
| SportsDataIO calls | 0 |
| Database mutations | 0 |
| Current Era prediction writes | 0 |
| Historical predictions generated | 0 |

## Classification

`NBA_DATA_FOUNDATION_PARTIAL_MORE_IMPORT_REQUIRED`

Next phase after access/import authorization:

`NBA-02_COMPLETE_HISTORICAL_FEATURE_RECONSTRUCTION_AND_REPLAY`
