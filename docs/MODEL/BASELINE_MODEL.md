# Baseline Model

Status: RELEASE 10 FROZEN BASELINE

Release 10 freezes the current production model baseline for future offline experiments. The baseline is derived from existing Release 04, Release 05, Release 08 and Release 09 evidence. It does not create or modify prediction rows.

## Baseline Identity

| Field | Value |
| --- | --- |
| Baseline ID | `baseline-release-10-2026-08-01` |
| Source commit | `15c9ad76302a26fd92540e3fc099688bdc429567` |
| Production behavior | Current champion model behavior |
| Prediction formulas changed | No |
| Probability calibration changed | No |
| Official Pick policy changed | No |
| Learning weights changed | No |
| Provider calls during baseline creation | 0 |
| Database mutations during baseline creation | 0 |

## Global Metrics

| Metric | Frozen Value |
| --- | ---: |
| Rows | 485 |
| Scored rows | 479 |
| Wins | 239 |
| Losses | 240 |
| Pushes | 6 |
| Accuracy | 49.90% |
| Brier | 0.2598 |
| Calibration error | -11.84 |
| Average confidence | 42.48 |
| ROI | Unavailable |

## Market Metrics

| Market | Rows | Scored | W-L-P | Accuracy | Average Probability | Average Confidence | Calibration Error | Brier |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Moneyline | 183 | 183 | 88-95-0 | 48.09% | 39.66% | 43.54 | -8.43 | 0.2507 |
| Spread / Run Line | 151 | 151 | 72-79-0 | 47.68% | 37.50% | 42.06 | -10.18 | 0.2517 |
| Totals | 151 | 145 | 79-66-6 | 54.48% | 36.69% | 41.61 | -17.79 | 0.2799 |
| First Half | 0 | 0 | 0-0-0 | N/A | N/A | N/A | N/A | N/A |
| First Five | 0 | 0 | 0-0-0 | N/A | N/A | N/A | N/A | N/A |

## Segment Metrics

| Segment | Rows | Scored | Accuracy | Brier | Experiment Use |
| --- | ---: | ---: | ---: | ---: | --- |
| Probability below 50% | 464 | 458 | 49.34% | 0.2612 | Baseline comparison only |
| Probability 50-55% | 11 | 11 | 63.64% | 0.2428 | Insufficient sample for production change |
| Very Low confidence | 170 | 169 | 41.42% | 0.2559 | Baseline comparison only |
| Low confidence | 305 | 300 | 54.00% | 0.2638 | Baseline comparison only |
| Medium+ confidence | 10 | 10 | Not production-safe | Not production-safe | Insufficient sample |

## Official Pick Metrics

| Metric | Value |
| --- | ---: |
| Scored Official Picks | 5 |
| W-L-P | 4-1-0 |
| Accuracy | 80.00% |
| Brier | 0.1686 |
| Policy implication | Promising but too small for threshold changes |

## Baseline Lock

Future experiments must compare against this baseline and must reject candidates when:

- overall accuracy decreases;
- overall Brier worsens;
- calibration worsens;
- Official Pick performance degrades;
- high-confidence buckets regress;
- small samples dominate the claimed improvement.
