# Historical Calibration Review V1

HR-02 is a read-only analytical review of replay probability reliability. It does not alter production probabilities, learning weights, model engines, Official Pick policy or Current Era rows.

## Dataset

- Replay family: `retrosheet_historical_replay_phase_2b_v1`.
- Replay sample: 7,290 replay predictions from 2,430 MLB historical games.
- Markets: moneyline, run line and total.
- Settled replay rows: 7,290.
- Leakage failures: 0.
- Duplicate replay rows: 0.

## Methodology

1. Read replay-only rows from `universal_projection_history`.
2. Preserve raw replay probabilities.
3. Compute reliability buckets by all markets and by market.
4. Split rows in chronological order: first 75% train, final 25% validation.
5. Compare offline calibrators only:
   - no calibration baseline
   - Platt/logistic scaling
   - isotonic regression
   - beta calibration
   - shrinkage toward 50%
6. Evaluate out of sample on the final chronological validation slice.
7. Recommend architecture only; do not implement calibration.

## Recommended Calibration Architecture

Future implementation should store raw and calibrated probabilities separately.

Suggested contract:

| Field | Purpose |
| --- | --- |
| `calibrationVersion` | Explicit version, for example `historical_replay_beta_market_v1`. |
| `market` | Calibration scope: `moneyline`, `run_line`, `total` or `global`. |
| `rawProbability` | Original model probability, immutable. |
| `calibratedProbability` | New calibrated probability, never overwrites raw probability. |
| `method` | `BETA_CALIBRATION`, `PLATT_LOGISTIC_SCALING`, `ISOTONIC_REGRESSION` or other approved method. |
| `trainedThrough` | Last event date included in training. |
| `sampleSize` | Training sample size. |
| `validationMetrics` | Out-of-sample Brier, calibration error, log loss and accuracy. |

## Policy Guardrails

- Historical calibration must not rewrite old predictions.
- Current Era predictions must retain original raw probabilities.
- New predictions may receive calibrated probabilities only after a separate approved implementation phase.
- Official Pick and recommendation thresholds must not change during calibration review.
- Run line should not receive equal trust until its market identity and selection-side behavior are reviewed in an implementation phase.

