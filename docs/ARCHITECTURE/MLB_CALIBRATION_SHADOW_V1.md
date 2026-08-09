# MLB Calibration Shadow V1

HR-03 adds a versioned, read-only calibration shadow layer for MLB probabilities.

The layer preserves the production probability and derives a separate diagnostic value:

| Field | Meaning |
| --- | --- |
| `rawProbability` | Existing immutable production or replay probability. |
| `calibratedProbability` | Shadow-only calibrated probability when the market is inside training support. |
| `delta` | Calibrated minus raw probability, in percentage points. |
| `calibrationVersion` | `mlb_market_calibration_shadow_v1`. |
| `calibrationMethod` | Selected offline candidate for the market. |
| `calibrationMarket` | Moneyline, run line or total. |
| `trainedThrough` | Last replay timestamp in the training slice. |
| `trainingSample` | Time-ordered replay rows used for fitting. |
| `validationSample` | Later replay rows used for out-of-sample scoring. |
| `validationMetrics` | Brier, calibration error, calibration bias, log loss and accuracy. |
| `shadowOnly` | Always true in HR-03. |

## Runtime Surface

The operational diagnostic endpoint is:

`/api/operations/calibration-shadow`

The existing model shadow endpoint now returns the same HR-03 contract:

`/api/model/shadow-calibration`

Both routes are read-only. They do not call providers, write predictions, alter Current Board, change recommendations, settle rows or update learning.

## Candidate Methods

The service evaluates:

- no calibration
- Platt/logistic scaling
- isotonic regression
- beta calibration
- simple shrinkage
- market-specific shrinkage

All candidates are fit on replay rows only and evaluated on later chronological validation rows.

## Training Support

HR-03 intentionally does not extrapolate outside observed replay support.

| Market | Training Support | Guardrail |
| --- | --- | --- |
| Moneyline | 2,425 scored replay rows | Supported as a market family, but no-calibration won the primary validation slice. |
| Run line | 2,430 scored replay rows, `home -1.5` only | `+1.5`, complement-derived and unsupported side regimes remain `CALIBRATION_UNSUPPORTED`. |
| Total | 2,405 scored replay rows, Over-only | Under remains `CALIBRATION_UNSUPPORTED`. |

## Promotion Status

HR-03 does not promote calibration to production.

Promotion remains blocked because rolling chronological folds were not stable, training support does not cover the full production market universe and Current Era diagnostics are still directional.

