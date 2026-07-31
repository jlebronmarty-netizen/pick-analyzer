# Release 04 Model Intelligence Certification

Status: LOCAL PASS / PRODUCTION DEPLOYMENT PENDING

Starting commit: `d9a3e08a9167272595024eef286fdb21a8ece82f`

## Scope

Release 04 is a model-quality audit release. It creates documentation and validation around current model performance, feature importance, calibration, Official Pick behavior and missed-opportunity evidence.

## Non-Changes

| Area | Status |
| --- | --- |
| Runtime behavior | Unchanged |
| Prediction formulas | Unchanged |
| Official Pick policy | Unchanged |
| Kelly logic | Unchanged |
| Smart ranking | Unchanged |
| Learning weights | Unchanged |
| Provider contracts | Unchanged |
| Scheduler behavior | Unchanged |
| Database schema | Unchanged |
| Historical replay | Not started |

## Local Validation

| Check | Result |
| --- | --- |
| Release 01 validator | PASS with 4 known circular-import warnings |
| Release 02 validator | PASS |
| Release 02A validator | PASS |
| Release 03 validator | PASS |
| Release 04 validator | PASS |
| Changed-file ESLint | PASS |
| Build | PASS |
| JSON validation | PASS |
| Markdown validation | PASS |
| Targeted secret scan | PASS |
| `git diff --check` | PASS |

## Performance Evidence

| Metric | Value |
| --- | ---: |
| Eligible settled rows | 485 |
| Scored rows | 479 |
| Wins | 239 |
| Losses | 240 |
| Pushes | 6 |
| Accuracy | 49.90% |
| Brier Score | 0.2598 |
| Calibration error | 7.42 |
| Average confidence | 42.48 |
| Settlement coverage | 100% |

## Certification Notes

Release 04 is eligible for production deployment after local validation passes. Production verification must remain read-only and limited to `/api/system/version`, `/api/dashboard/today`, `/api/current-board` and `/api/performance`.
