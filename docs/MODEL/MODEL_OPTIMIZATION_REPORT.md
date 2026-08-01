# Model Optimization Report V1

Status: RELEASE 05 EVIDENCE-GATED OPTIMIZATION

Starting commit: `300444109c19ec521dd9ce3f52f4c37d7f4f699c`

Release 05 evaluated the first evidence-based model optimization opportunity. No runtime model change was accepted because the available production evidence does not support a statistically meaningful bounded calibration or market adjustment.

## Optimization Decision

| Area | Decision | Reason |
| --- | --- | --- |
| Probability bucket adjustment | Rejected | Only the `<50` bucket has a meaningful sample; all requested higher buckets have 11 or fewer scored rows. |
| Confidence normalization | Rejected | High and very-high confidence samples have 3 and 2 scored rows. |
| Market-specific calibration | Rejected | Moneyline, spread and totals have useful directional evidence, but missing explicit edge/EV/home-away/favorite-underdog fields prevent safe calibration. |
| Sport-specific calibration | Rejected | Current settled production sample is MLB only. |
| Official Pick threshold change | Rejected | Official sample is 5 scored rows; promising but too small. |
| Learning weight change | Rejected | Global learning weights must not change without larger row-level evidence. |

This is a valid evidence-based optimization result: the safest model improvement is to preserve current behavior and require better segment evidence before any formula change.

## Bucket Analysis

### Probability Buckets

| Bucket | Rows | Scored | W-L-P | Accuracy | Avg Probability | Avg Confidence | Calibration Error | Brier | ROI |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| <50 | 464 | 458 | 226-232-6 | 49.34% | 37.12% | 41.81 | -12.22 | 0.2612 | Unavailable |
| 50-55 | 11 | 11 | 7-4-0 | 63.64% | 51.84% | 50.34 | -11.80 | 0.2428 | Unavailable |
| 55-60 | 4 | 4 | 1-3-0 | 25.00% | 57.10% | 51.08 | 32.10 | 0.3011 | Unavailable |
| 60-65 | 0 | 0 | 0-0-0 | N/A | N/A | N/A | N/A | N/A | Unavailable |
| 65-70 | 2 | 2 | 2-0-0 | 100.00% | 67.68% | 65.89 | -32.32 | 0.1046 | Unavailable |
| 70-75 | 2 | 2 | 1-1-0 | 50.00% | 73.54% | 73.90 | 23.54 | 0.3182 | Unavailable |
| 75+ | 2 | 2 | 2-0-0 | 100.00% | 78.58% | 82.58 | -21.42 | 0.0469 | Unavailable |

### Confidence Buckets

| Bucket | Rows | Scored | W-L-P | Accuracy | Avg Probability | Avg Confidence | Calibration Error | Brier | ROI |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Very Low | 170 | 169 | 70-99-1 | 41.42% | 31.18% | 37.85 | -10.24 | 0.2559 | Unavailable |
| Low | 305 | 300 | 162-138-5 | 54.00% | 41.04% | 44.22 | -12.96 | 0.2638 | Unavailable |
| Medium | 5 | 5 | 3-2-0 | 60.00% | 54.47% | 59.96 | -5.53 | 0.2489 | Unavailable |
| High | 3 | 3 | 2-1-0 | 66.67% | 72.21% | 71.23 | 5.54 | 0.2443 | Unavailable |
| Very High | 2 | 2 | 2-0-0 | 100.00% | 77.02% | 83.67 | -22.98 | 0.0551 | Unavailable |

### Markets

| Market | Rows | Scored | W-L-P | Accuracy | Avg Probability | Avg Confidence | Calibration Error | Brier | ROI |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Moneyline | 183 | 183 | 88-95-0 | 48.09% | 39.66% | 43.54 | -8.43 | 0.2507 | Unavailable |
| Spread / Run Line | 151 | 151 | 72-79-0 | 47.68% | 37.50% | 42.06 | -10.18 | 0.2517 | Unavailable |
| Totals | 151 | 145 | 79-66-6 | 54.48% | 36.69% | 41.61 | -17.79 | 0.2799 | Unavailable |
| First Half | 0 | 0 | 0-0-0 | N/A | N/A | N/A | N/A | N/A | Unavailable |
| First Five | 0 | 0 | 0-0-0 | N/A | N/A | N/A | N/A | N/A | Unavailable |

## Feature Contribution

Release 05 did not invent feature importance. The current row-level public export does not expose per-row feature values or snapshot details, so feature contribution is classified from actual repository outputs and availability.

| Feature | Evidence | Classification |
| --- | --- | --- |
| market_odds | Required by Feature Store and Current Board; explicit stored odds are needed for modeled value. | Insufficient evidence for contribution magnitude |
| event_context | Required across all supported sports and needed for cutoff safety. | Insufficient evidence for contribution magnitude |
| team_form | Required by most sport feature sets. | Insufficient evidence for contribution magnitude |
| starter_status_context | MLB optional feature with direct domain relevance. | Insufficient evidence for contribution magnitude |
| pitcher_context | MLB optional feature with direct domain relevance. | Insufficient evidence for contribution magnitude |
| weather_context | MLB optional totals feature. | Insufficient evidence for contribution magnitude |
| park_context | MLB optional totals feature. | Insufficient evidence for contribution magnitude |
| injury_context | Optional, often unavailable. | Insufficient evidence for contribution magnitude |
| lineup_context | Optional, often unavailable. | Insufficient evidence for contribution magnitude |

No feature is classified as strong positive, weak positive, neutral, weak negative or strong negative because the current export lacks enough per-row feature values to calculate correlation with prediction success.

## Market Optimization

Totals show the best raw accuracy at 54.48%, but their Brier Score is worse than moneyline and spread. This is not a clean optimization signal. It implies directional selection may be useful while probability magnitude is unstable. No totals-specific adjustment was applied.

Moneyline and spread are below 50% accuracy and should not receive confidence boosts.

## Official Picks Safety

Official Picks remain protected. Release 05 applied no calibration or confidence change, so it cannot accidentally increase bad Official Picks. The current Official Pick sample is 4-1 with Brier 0.1686, but sample size 5 is below the evidence threshold for any policy change.

## Before And After

Because no runtime model change was accepted, before and after metrics are intentionally identical.

| Metric | Before | After | Accepted |
| --- | ---: | ---: | --- |
| Accuracy | 49.90% | 49.90% | Yes, no regression |
| Brier | 0.2598 | 0.2598 | Yes, no regression |
| Calibration error | -11.84 | -11.84 | Yes, no regression |
| Average confidence | 42.48 | 42.48 | Yes, no regression |
| Official Picks added | 0 | 0 | Yes |
| Provider calls | 0 | 0 | Yes |
| Database mutations | 0 | 0 | Yes |

## Release 05 Result

Release 05 produced an evidence-based optimization gate, not a speculative model patch. The model remains unchanged until Release 06 can expose the missing row-level fields required for statistically meaningful calibration.
