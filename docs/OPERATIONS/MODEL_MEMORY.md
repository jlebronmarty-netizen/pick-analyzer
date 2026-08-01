# Model Memory

Status: RELEASE 11 READ-ONLY MODEL MEMORY REPORT

Model Memory summarizes how the system is accumulating evidence toward future model improvements. It is a report, not a training system. Release 11 does not change learning weights, production probabilities, Official Picks or prediction formulas.

## Baseline Memory

Source baseline: `docs/MODEL/BASELINE_MODEL.md`

| Metric | Release 10 Frozen Value |
| --- | ---: |
| Rows | 485 |
| Scored rows | 479 |
| Wins | 239 |
| Losses | 240 |
| Pushes | 6 |
| Accuracy | 49.90% |
| Brier | 0.2598 |
| Average confidence | 42.48 |
| Official Pick scored rows | 5 |

## Segment Growth

| Segment | Current Evidence | Threshold Need | Remaining Samples |
| --- | ---: | ---: | ---: |
| Global baseline | 479 scored rows | 250 scored rows | 0 |
| Market-specific calibration | 479 scored rows combined | 100 scored rows per candidate market plus clean directional signal | 0 broad rows; more stable market evidence needed |
| Moneyline | 183 scored rows | 100 | 0 |
| Spread / Run Line | 151 scored rows | 100 | 0 |
| Totals | 145 scored rows | 100 | 0; Brier conflict remains |
| Probability 50%+ bucket | 21 scored rows | 50 | 29 |
| Medium+ confidence bucket | 10 scored rows | 50 | 40 |
| Official Picks | 5 scored rows | 100 | 95 |
| Feature weighting | 0 reliable contribution rows | Measurable feature coverage and outcome contribution | Blocked by incomplete contribution evidence |

## Bucket Growth

| Bucket | Evidence | Status |
| --- | --- | --- |
| Probability below 50% | 458 scored rows | Mature enough for baseline comparison only |
| Probability 50-55% | 11 scored rows | Needs 39 more rows before safe bucket-level experiment |
| Probability above 55% | Fewer than 10 scored rows in current evidence | Needs more data |
| Very Low confidence | 169 scored rows | Baseline comparison only |
| Low confidence | 300 scored rows | Baseline comparison only |
| Medium+ confidence | 10 scored rows | Needs 40 more rows before safe confidence experiment |

## Markets Approaching Thresholds

| Market | Current State | Next Requirement |
| --- | --- | --- |
| Moneyline | Sample threshold reached, but accuracy is below 50% | Do not boost; monitor for Brier/calibration improvement only |
| Spread / Run Line | Sample threshold reached, but accuracy is below 50% | Do not boost; monitor stability |
| Totals | Accuracy is strongest at 54.48%, but Brier is worst at 0.2799 | Needs a safe calibration rule before any production change |
| First Half | No production settled recommendation sample | Remains unavailable |
| First Five | No production settled recommendation sample | Remains unavailable |

## Optimization Candidate Eligibility

| Candidate | Current Status | Samples Remaining | Blocker |
| --- | --- | ---: | --- |
| Market-specific calibration | Insufficient data | 0 broad rows, but more stable market signal required | Totals accuracy and Brier conflict |
| Confidence normalization | Insufficient data | 40 medium+ confidence rows | High-confidence bucket instability |
| Probability bucket calibration | Failed current evidence | 29 above-50% probability rows | Below bucket sample threshold |
| Feature weighting candidate | Failed current evidence | Not countable yet | Feature contribution cannot be estimated safely |

## Model Memory Rule

Every new settled sample can increase memory. No sample can change production behavior until it passes the Release 10 experiment workflow and a future human-approved production release.
