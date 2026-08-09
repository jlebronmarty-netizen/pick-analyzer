# HR-03 Calibration Shadow Validation

Status: `CALIBRATION_SHADOW_PASS_MORE_CURRENT_ERA_EVIDENCE_REQUIRED`

Starting commit: `1721f2e9504b8b3a73896ae91d41d1de0325354c`.

Mode: shadow-only runtime implementation and certification.

## Verdict

HR-03 implemented a versioned MLB calibration shadow layer and exposed it through read-only diagnostic endpoints. It preserves raw production probabilities and calculates separate calibrated probabilities only when the market is inside replay training support.

Production promotion is not recommended yet. Run line and total show useful calibration improvements on the primary validation slice, but global and moneyline no-calibration remain strongest by Brier, rolling beta folds are unstable, and Current Era support is incomplete.

## Replay Reproduction

| Item | Result |
| --- | ---: |
| Replay rows | 7,290 |
| Scored replay rows | 7,260 |
| Push rows | 30 |
| Replay events | 2,430 |
| Moneyline scored rows | 2,425 |
| Run line scored rows | 2,430 |
| Total scored rows | 2,405 |

The replay denominator remains consistent with HR-01/HR-02. No replay rows were modified.

## Dataset Limitation Audit

| Market | Finding | Classification |
| --- | --- | --- |
| Run line | Historical replay rows are `home -1.5` only. | `EXPECTED_FROZEN_REPLAY_SCOPE` |
| Total | Historical replay rows are Over-only. | `EXPECTED_FROZEN_REPLAY_SCOPE` |
| Moneyline | Market-family support exists. | `SUPPORTED_MARKET_FAMILY` |

HR-03 does not expand historical market coverage.

## Primary Chronological Validation

Training: 5,445 scored rows from `2025-03-18T00:00:00+00:00` through `2025-08-15T00:00:00+00:00`.

Validation: 1,815 scored rows from `2025-08-15T00:00:00+00:00` through `2025-09-28T00:00:00+00:00`.

| Scope | Selected method | Raw Brier | Shadow Brier | Brier improvement | Raw calibration | Shadow calibration | Calibration improvement |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Global | `NO_CALIBRATION` | 0.2414 | 0.2414 | 0.0000 | 2.32 | 2.32 | 0.00 |
| Moneyline | `NO_CALIBRATION` | 0.2458 | 0.2458 | 0.0000 | 3.81 | 3.81 | 0.00 |
| Run line | `ISOTONIC` | 0.2283 | 0.2250 | 0.0033 | 6.63 | 0.07 | 6.56 |
| Total | `ISOTONIC` | 0.2501 | 0.2494 | 0.0007 | 4.16 | 0.25 | 3.91 |

Beta calibration was implemented and evaluated, but it was not the selected method for the primary validation slice.

## Rolling Fold Results

Global beta calibration was tested across rolling chronological folds.

| Fold | Brier improvement | Calibration improvement |
| --- | ---: | ---: |
| Fold 1 | -0.0032 | -2.27 |
| Fold 2 | -0.0030 | -1.31 |
| Fold 3 | -0.0032 | 1.54 |

The fold behavior is not stable enough for production promotion.

## Current Era Shadow Application

| Item | Result |
| --- | ---: |
| Current Era rows read | 483 |
| Supported shadow outputs | 270 |
| Unsupported outputs | 213 |
| Unsupported Total Under rows | 126 |
| Unsupported Run Line outside `-1.5` | 87 |

Current Era settled diagnostic:

| Scope | Sample | Raw Brier | Shadow Brier | Raw calibration | Shadow calibration |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current Era raw | 392 | 0.2582 | N/A | 10.87 | N/A |
| Supported shadow subset | 216 | N/A | 0.2392 | N/A | 4.27 |

The Current Era comparison is directional only because unsupported market regimes are excluded from the shadow subset.

## Recommendation Impact Simulation

Simulation only. No ranking, Official Pick, Rent Play, Smart Parlay, Current Board, Performance, settlement or learning logic changed.

| Metric | Count |
| --- | ---: |
| Priced rows | 483 |
| Raw edge/EV eligible | 16 |
| Shadow edge/EV eligible | 10 |
| Would remain eligible | 10 |
| Would lose eligibility | 6 |
| Would newly become eligible | 0 |

## Case Study

No current supported candidate near 75% raw probability was available. The selected stored-price case study is a current Total Over example:

| Field | Value |
| --- | --- |
| Prediction | `54ee89fb-7a78-534c-bcdf-435a6a6827bf` |
| Event | `baseball_mlb:mlb:sportsdataio:event:79036` |
| Market | Total Over 8 |
| Odds | -121 |
| Raw probability | 50.66% |
| Shadow calibrated probability | 47.65% |
| Delta | -3.01 |
| Implied probability | 54.75% |
| Raw edge | -4.09 |
| Shadow edge | -7.10 |
| Raw EV | -0.0747 |
| Shadow EV | -0.1296 |

## Safety

- Production probability changed: no.
- Official Picks changed: no.
- Rent Play changed: no.
- Moneyline Bet changed: no.
- Smart Parlay changed: no.
- Rankings changed: no.
- Settlement changed: no.
- Learning changed: no.
- Performance denominator changed: no.
- Provider calls: 0.
- SportsDataIO calls: 0.
- The Odds API calls: 0.
- ODDS-02A remaining request: 1.

## Decision

Final classification: `CALIBRATION_SHADOW_PASS_MORE_CURRENT_ERA_EVIDENCE_REQUIRED`.

Recommended next phase: continue shadow observation or run a specific HR-04 design only after guardrails and Current Era evidence improve.

