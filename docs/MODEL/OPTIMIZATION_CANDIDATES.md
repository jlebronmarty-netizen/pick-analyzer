# Optimization Candidates

Status: RELEASE 08 STATISTICAL MODEL EVOLUTION FRAMEWORK

Release 08 generates model-evolution candidates from existing segment and intelligence evidence. It does not change production predictions, probabilities, Official Picks, learning weights, scheduler behavior or provider contracts.

## Statistical Thresholds

| Gate | Threshold |
| --- | --- |
| Minimum sample size | 100 scored rows for market/sport candidates; 50 scored rows for bucket candidates; 250 scored rows for global candidates |
| Minimum confidence level | 95% confidence proxy using Wilson interval sanity check |
| Maximum expected regression | 0.00 percentage points accepted for overall accuracy, Brier or calibration |
| Minimum expected Brier improvement | 0.005 absolute Brier improvement |
| Minimum expected calibration improvement | 2.00 percentage points absolute calibration improvement |
| Small-sample dominance | Reject when more than 35% of claimed gain comes from segments below threshold |
| Official Pick safety | Reject if Official Pick sample is below 100 scored rows or any simulated degradation appears |

## Candidate Results

| Candidate | Affected Market/Segment | Evidence | Sample Size | Expected Gain | Statistical Confidence | Risk | Decision |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| Probability bucket calibration | Probability buckets above 50% | Higher buckets have promising but tiny samples: 50-55 has 11 scored rows; higher buckets have 4 or fewer. | 21 scored rows above 50% | Not measurable safely | Low | High | REJECTED |
| Confidence calibration | Medium, High, Very High confidence | Medium has 5 scored rows, High has 3, Very High has 2. | 10 scored rows above Low | Not measurable safely | Low | High | REJECTED |
| Market-specific calibration | Moneyline, spread, totals | Moneyline 183 scored, spread 151 scored, totals 145 scored; totals accuracy is higher but Brier is worse. | 479 scored rows combined | Directional only | Medium | Medium | NEEDS MORE DATA |
| Sport-specific calibration | MLB production scope | Current settled production sample is MLB-only; no cross-sport production comparison exists. | 479 scored rows | Not separable by sport | Low | Medium | NEEDS MORE DATA |
| Feature weighting candidate | Weather, park, starter, feature snapshot coverage | Release 07 exposes feature coverage, but weather/park/starter coverage remains partial and sparse. | Partial coverage only | Not measurable safely | Low | High | REJECTED |
| Confidence normalization | Aggregate confidence reliability | Aggregate model is underconfident, but bucket-level evidence is unstable. | 479 scored rows | Possible calibration improvement, no safe bounded rule yet | Medium | Medium | NEEDS MORE DATA |

## Offline Simulation

No candidate reached approval, so Release 08 ran the only safe offline simulation outcome: preserve the current champion model.

| Metric | Current Model | Candidate Model | Regression |
| --- | ---: | ---: | --- |
| Accuracy | 49.90% | 49.90% | No |
| Brier | 0.2598 | 0.2598 | No |
| Calibration error | -11.84 | -11.84 | No |
| Confidence | 42.48 | 42.48 | No |
| Official Picks added | 0 | 0 | No |
| Learning weights changed | 0 | 0 | No |

## Regression Detection

Every non-approved candidate was rejected or held because at least one regression guard could not be proven safe:

- Overall Brier must not worsen.
- Accuracy must not decrease.
- Calibration must not worsen.
- Official Picks must not degrade.
- High-confidence buckets must not regress.
- Small samples must not dominate the claimed improvement.

## Ranking

| Rank | Candidate | Priority | Reason |
| ---: | --- | --- | --- |
| 1 | Market-specific calibration | High after more data | Markets have enough broad sample to study, but totals have worse Brier despite higher accuracy. |
| 2 | Confidence normalization | Medium | Aggregate underconfidence exists, but bucket samples are too small. |
| 3 | Sport-specific calibration | Medium | Safe only after another sport has production settled evidence. |
| 4 | Probability bucket calibration | Low now | High-probability buckets are too sparse. |
| 5 | Feature weighting candidate | Low now | Feature coverage is partial and cannot support contribution claims. |

## Recommendation

No candidate is approved for production. Release 08 approves the framework and rejects speculative optimization.
