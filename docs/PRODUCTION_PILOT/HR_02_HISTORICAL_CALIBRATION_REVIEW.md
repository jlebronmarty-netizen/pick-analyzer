# HR-02 Historical Calibration Review

Status: `CALIBRATION_IMPLEMENTATION_RECOMMENDED`

Starting commit: `f68b52c54de598148b566926f9ebffc9967d92ad`.

Mode: read-only analysis. No production calibration changes were made.

## Verdict

HR-02 recommends a separate implementation phase for market-specific beta calibration, with raw probabilities preserved and calibrated probabilities stored separately.

The historical replay dataset is broadly usable for calibration design. Overall replay calibration is close on average, but important segments are not reliable enough for direct production use without calibration:

- High-probability buckets become materially overconfident beginning around 60-65% overall.
- Run line is materially overconfident and has weak hit rate.
- Moneyline is mildly underconfident overall, with a strong middle band but unstable extremes.
- Totals are close overall but asymmetric because the full replay generated Over-only total selections.
- Chronological behavior is regime-sensitive, especially Q2.

## Replay Dataset Verification

| Item | Result |
| --- | ---: |
| Replay events | 2,430 |
| Replay predictions | 7,290 |
| Settled replay predictions | 7,290 |
| Moneyline sample | 2,430 |
| Run line sample | 2,430 |
| Total sample | 2,430 |
| Leakage failures | 0 |
| Duplicate rows | 0 |
| Provider calls | 0 |

Replay remains isolated from Current Era. No replay rows were changed.

## Raw Reliability Summary

| Scope | Sample | Accuracy | Brier | Calibration error | Bias | Classification |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| All markets | 7,290 | 46.06% | 0.2508 | 1.74 | +1.74 | `WELL_CALIBRATED` overall, segmented defects |
| Moneyline | 2,430 | 54.31% | 0.2545 | 4.25 | -4.25 | `MILD_UNDERCONFIDENCE` |
| Run line | 2,430 | 35.56% | 0.2387 | 6.48 | +6.48 | `MATERIAL_OVERCONFIDENCE` |
| Total | 2,430 | 48.36% | 0.2592 | 2.99 | +2.99 | `WELL_CALIBRATED` aggregate |

## High-Probability Overconfidence

Minimum strong-conclusion sample threshold: 100 scored rows.

| Scope | Bucket | Sample | Avg probability | Observed win rate | Gap |
| --- | --- | ---: | ---: | ---: | ---: |
| All markets | 60-65 | 397 | 62.08% | 56.93% | +5.15 |
| All markets | 65-70 | 196 | 67.02% | 52.55% | +14.47 |
| Moneyline | 60-65 | 168 | 62.19% | 61.90% | +0.28 |
| Total | 60-65 | 178 | 62.03% | 55.06% | +6.98 |

Overconfidence is clearest from 60-65% overall and becomes material at 65-70%. The 70%+ buckets are directionally alarming but below the strong sample threshold after market splitting.

## Low-Probability Behavior

Low-probability underdogs are often underestimated in aggregate. The 0-30% bucket averaged 23.55% but won 44.57% of scored rows. Moneyline low buckets are especially underconfident, while run line low buckets are closer but still uneven.

This argues against a single global compression-only calibrator. The tails need market-specific treatment.

## Market Deep Dives

### Run Line

Run line sample is entirely `-1.5` in the full replay family:

| Segment | Sample | Accuracy | Avg probability | Observed win rate | Bias |
| --- | ---: | ---: | ---: | ---: | ---: |
| -1.5 | 2,430 | 35.56% | 42.04% | 35.56% | +6.48 |
| +1.5 | 0 | N/A | N/A | N/A | N/A |

Run line weakness appears driven by market/selection design and class balance: the replay generated only home `-1.5` style selections. HR-02 found no duplicate-row or leakage defect, but Run Line should not be treated as equally trusted until a future phase validates side balance, +1.5 coverage and complement identity.

### Moneyline

Moneyline is the strongest raw hit-rate market at 54.31%. Middle probability bands are reliable: 50-55% observed 53.11%, 55-60% observed 59.18%, and 60-65% observed 61.90%. Low-probability moneyline rows are underconfident, and extreme high buckets are too small for strong conclusions.

### Total

The full replay generated Over-only total selections:

| Segment | Sample | Accuracy | Avg probability | Observed win rate | Bias |
| --- | ---: | ---: | ---: | ---: | ---: |
| Over | 2,430 | 48.36% | 51.34% | 48.36% | +2.99 |
| Under | 0 | N/A | N/A | N/A | N/A |

Total calibration is acceptable overall but should not be generalized to Under selections until Under replay evidence exists.

## Chronological Stability

| Cohort | Events | Sample | Accuracy | Brier | Calibration error | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 | 608 | 1,824 | 47.54% | 0.2696 | 0.03 | +0.03 |
| Q2 | 608 | 1,824 | 43.01% | 0.2451 | 5.03 | +5.03 |
| Q3 | 608 | 1,824 | 48.19% | 0.2472 | 0.48 | -0.48 |
| Q4 | 606 | 1,818 | 45.50% | 0.2413 | 2.37 | +2.37 |

Calibration drift is regime-sensitive rather than smooth. Q2 shows the largest deterioration by calibration and accuracy.

## Calibration Methods

Chronological split: first 75% training, final 25% validation.

| Scope | Best method | Brier before | Brier after | Calibration before | Calibration after |
| --- | --- | ---: | ---: | ---: | ---: |
| Global | No calibration | 0.2413 | 0.2413 | 2.39 | 2.39 |
| Moneyline | Beta calibration | 0.2458 | 0.2454 | 3.81 | 1.01 |
| Run line | Beta calibration | 0.2279 | 0.2239 | 6.73 | 1.23 |
| Total | Beta calibration | 0.2502 | 0.2481 | 4.32 | 1.05 |

Global calibrators improved calibration error but worsened Brier out of sample. Market-specific beta calibration produced small but consistent Brier and calibration improvements for all three markets.

## Confidence Findings

| Confidence bucket | Sample | Accuracy | Avg probability | Observed win rate | Bias |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low | 1,561 | 39.77% | 33.30% | 39.77% | -6.47 |
| Medium | 4,072 | 45.52% | 47.56% | 45.52% | +2.04 |
| High | 1,657 | 53.29% | 62.00% | 53.29% | +8.71 |

Confidence adds signal, but high-confidence rows are overconfident. Future recommendation gates should consider calibrated probability and confidence together, but HR-02 does not change any gate.

## Current Era Comparison

Current Era was analyzed separately and not merged with replay.

| Scope | Sample | Settled | Accuracy | Brier | Calibration error | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current Era | 447 | 399 | 47.96% | 0.2582 | 10.87 | -10.87 |
| Replay | 7,290 | 7,290 | 46.06% | 0.2508 | 1.74 | +1.74 |

Current Era sample is smaller and currently underconfident by stored-row analysis, while replay is mildly overconfident overall. This mismatch supports a cautious, versioned calibration implementation rather than direct replay-to-production replacement.

## Recommendation Impact

Historical full-scope EV simulation is limited because full replay price/stake evidence is not complete enough for reliable ROI. Qualitatively, the very large apparent edges in extreme probability buckets are likely inflated by overconfidence, especially run line and total high buckets.

## Decision

Calibration decision: `CALIBRATION_IMPLEMENTATION_RECOMMENDED`.

Recommended scope: market-specific beta calibration first, with special Run Line guardrails.

Recommended next phase: `HR-03 CALIBRATION IMPLEMENTATION DESIGN AND SHADOW VALIDATION`.

HR-02 does not authorize production calibration by itself.

