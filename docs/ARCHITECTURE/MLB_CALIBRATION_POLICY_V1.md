# MLB Calibration Policy V1

Status: `MLB_CALIBRATION_EVIDENCE_QUANTIFIED_NO_REPAIR_REQUIRED`

Observation date: 2026-08-13

Starting commit: `dca83ad9074aaca6b17f32d0ab5e54b8aa3a70e3`

## Runtime Owners

| Concern | Runtime source | Contract |
| --- | --- | --- |
| Production row gate | `src/services/production-data-gate.service.ts` | `production_eligible=true`, not trial, not scrambled, no critical mapping/timestamp blocker |
| Official recommendation gate | `src/services/recommendation-eligibility-policy.service.ts` | Requires `calibrationStatus` of `acceptable` or `mature` plus probability, confidence, edge, EV, freshness and production gate |
| Aggregate calibration read | `src/services/model-calibration.service.ts` | Reads settled production rows, then buckets only rows with `recommended_pick=true` |
| Shadow calibration research | `src/services/mlb-calibration-shadow-v1.service.ts` | Uses historical replay evidence in shadow only; does not change production probability |
| Current board quarantine | `src/services/current-board.service.ts` | Rows with `production_eligible !== true` or `feature_snapshot.prospective_preview === true` are displayed as quarantined/review-only |

## Official Recommendation Thresholds

`RECOMMENDATION_THRESHOLDS_V1` is authoritative:

- Minimum model probability: `52`.
- Minimum confidence for Official eligibility: `65`.
- Minimum Official edge: `5`.
- Minimum Official EV: `5`.
- Maximum odds age: `120` minutes.
- Minimum calibration sample: `250`.
- Maximum calibration error: `8`.
- Supported markets: moneyline, spread/run line, total.

The row-level official gate does not compute calibration maturity from the aggregate on each candidate. It consumes each row's `calibrationStatus` value and blocks unless that value is `acceptable` or `mature`.

## Aggregate Calibration Cohort

`getModelCalibration()` includes only rows that satisfy:

1. `prediction_history.production_eligible = true`.
2. `trial !== true`.
3. `scrambled !== true`.
4. result/status is `win`, `loss`, or `push`.

For probability buckets, the aggregate then narrows to `recommended_pick = true`.

This means current quarantined preview rows, shadow rows, historical replay rows, and replay calibration research rows do not count toward production Official Pick calibration unless a separate, explicitly authorized promotion policy changes that contract.

## Current Evidence

Read-only production evidence from 2026-08-13:

| Cohort | Rows | Settled | Calibration-eligible | Recommended settled |
| --- | ---: | ---: | ---: | ---: |
| Current Era MLB rows since 2026-08-01 | 795 | 781 | 0 | 0 |
| Current Era moneyline | 244 | 240 | 0 | 0 |
| Current Era run line/spread | 257 | 252 | 0 | 0 |
| Current Era total | 294 | 289 | 0 | 0 |
| Certified historical replay | 7,290 | 7,290 | 0 production / 7,290 shadow research | 0 |

Current Era diagnostic quality across all settled rows, before production calibration eligibility:

- Wins/losses/pushes: 371 / 398 / 12.
- Accuracy: 48.24%.
- Brier: 0.2559.
- Calibration error: 10.92 percentage points.

These diagnostics prove evidence exists, but not that production Official calibration is mature, because all current rows remain non-production/quarantined.

## Historical Replay Separation

Historical replay is certified as 2,430 events and 7,290 settled replay-only predictions. HR-03 uses it for shadow calibration research only. It is excluded from:

- Current Era Performance denominators.
- Production Official Pick track record.
- `getModelCalibration()` production calibration buckets.

Reason: replay has different historical feature, market and validation scope. It can inform future shadow calibration review, but it must not clear Current Era production gates without an explicit promotion phase.

## Quarantine And Production Gate

`CALIBRATION_INSUFFICIENT` does not automatically cause `QUARANTINED_ROW`.

The relationship is parallel:

- Quarantine is controlled by `production_eligible !== true` and preview metadata.
- Production gate is controlled by `evaluateProductionDataGate()`.
- Official Pick eligibility also requires calibration status, confidence, edge, EV, freshness, supported market and valid feature/model lineage.

If calibration became `acceptable` today, quarantine would not automatically clear because `production_eligible` remains false. If quarantine cleared but confidence stayed around 40-50%, the `LOW_CONFIDENCE` gate would still block Official Picks.

## Calibration Status Interpretation

Current production Official calibration status is `insufficient` by evidence:

- Eligible production recommended settled rows: `0`.
- Required sample reference: `250`.
- Remaining to sample threshold: `250`.
- Brier and accuracy are diagnostic for the current policy, not direct Official Pick blockers.
- Calibration error is computed by bucket diagnostics; row-level Official Pick eligibility blocks on `calibrationStatus` being neither `acceptable` nor `mature`.

Estimated additional games to a 250-row sample, assuming three production-eligible predictions per fully eligible MLB game:

- Optimistic: about 84 games.
- Typical: about 100-125 games after pushes, unsupported or quarantined rows.
- Conservative: about 150 games if production eligibility remains selective.

This is an evidence accumulation estimate, not a scheduled promise.

## Autonomy

Calibration evidence advances through:

prediction -> canonical result -> settlement -> production row eligibility -> aggregate calibration read -> MC-08B/Recommendation policy consumption.

No manual daily calibration job is required for settled rows to become readable by the aggregate. However, production Official calibration cannot mature while all Current Era rows remain quarantined.

## Safety

This policy audit changes no calibration threshold, confidence threshold, edge threshold, EV threshold, probability formula, model weight, Official Pick policy, settlement formula, learning weight, provider authority or Current Era denominator.
