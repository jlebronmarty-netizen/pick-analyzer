# Model Intelligence Report V1

Status: RELEASE 04 LOCAL AUDIT

Release 04 did not alter model formulas, Official Pick policy, provider contracts, scheduler behavior, database architecture or historical data. It documents what the current model evidence says and what Release 05 should improve.

## Executive Summary

The current production model is measurable and operationally disciplined, but not yet broadly trustworthy as a betting engine. The strongest evidence is that strict Official Pick gating selects a better subset than broad model-only output, but the Official Pick sample is only 5 scored rows. The broad model has 479 scored rows at 49.90% accuracy and a 0.2598 Brier Score, so Release 05 should improve calibration and segment evidence before changing thresholds.

## Why The Model Wins

1. It is cutoff-safe: performance excludes post-start and post-final predictions.
2. It separates model-only analysis from Official Picks.
3. It uses market alignment and stored odds rather than treating probability as value.
4. Totals show the best raw market accuracy in the current sample at 54.48%.
5. Official Picks are 4-1 in the current sample, suggesting the policy may select better rows.

## Why The Model Loses

1. Broad moneyline and spread/run-line accuracy is below 50%.
2. Totals have better raw accuracy but worse Brier Score, suggesting probability magnitude is not well calibrated.
3. Average confidence is low at 42.48, and most settled rows are below 50 confidence.
4. Missing starter, lineup, injury, weather, bullpen and player-stat inputs still reduce decision quality.
5. The current public performance contract does not yet expose all row-level fields needed for robust segment learning.

## Sport Trust

| Sport | Current Trust | Reason |
| --- | --- | --- |
| MLB | Moderate, model-quality work required | 485 eligible settled rows, 479 scored rows, 49.90% accuracy, Brier 0.2598. |
| NBA | Insufficient production settled sample | Feature contracts exist, but current production performance sample is empty. |
| BSN | Insufficient production settled sample | Partial feature readiness and no current production settled sample. |
| NFL | Insufficient production settled sample | Partial feature readiness. |
| NHL | Insufficient production settled sample | Goalie feature gap. |
| Soccer | Insufficient production settled sample | Draw-aware gap. |
| Tennis | Insufficient production settled sample | Player-form gap. |
| UFC | Insufficient production settled sample | Fighter-form gap. |

## Market Trust

| Market | Current Direction |
| --- | --- |
| Total | Improve first; best accuracy but needs calibration repair. |
| Moneyline | Needs calibration and favorite/underdog segmentation. |
| Spread / Run Line | Needs margin-quality and line-sensitivity analysis. |
| First Half | Do not promote; no settled production evidence in current scope. |
| First Five | Do not promote; unsupported for production recommendation evidence. |
| Props | Do not promote; insufficient player/prop ingestion, modeling, settlement and performance evidence. |

## Calibration Findings

The model is underconfident on the aggregate signed metric: calibration bias is -7.42 while absolute calibration error is 7.42. That does not mean every bucket is underconfident. It means Release 05 should build true bucketed calibration curves from row-level stored history before changing probability formulas.

Small high-probability samples look promising, but they are too small for automatic recalibration:

| Probability Range | Scored | Accuracy | Brier |
| --- | ---: | ---: | ---: |
| <40 | 304 | 47.04% | 0.2631 |
| 40-44 | 115 | 53.04% | 0.2593 |
| 45-49 | 39 | 56.41% | 0.2530 |
| 50-54 | 11 | 63.64% | 0.2428 |
| 55-59 | 4 | 25.00% | 0.3011 |
| >=65 | 6 | 83.33% | 0.1566 |

## Official Pick Audit

Official Picks require production eligibility, future event, supported market, current odds, pre-cutoff odds, feature snapshot, model and feature-set versions, acceptable/mature calibration, minimum model probability, confidence, edge, EV, data quality and data sufficiency. This behavior is working as designed: most current rows remain model-only because one or more gates fail.

Current measured Official Pick sample:

| Rows | Scored | W-L-P | Accuracy | Brier |
| ---: | ---: | --- | ---: | ---: |
| 5 | 5 | 4-1-0 | 80.00% | 0.1686 |

Do not relax thresholds yet. The sample is too small.

## What Release 05 Should Improve

1. Create a row-level model segment report from stored prediction history with no provider calls.
2. Add calibration curves by market, probability bucket, confidence bucket and source.
3. Add favorite/underdog and home/away segment metrics from normalized row fields.
4. Add edge-band and EV-band trend reporting.
5. Prioritize MLB totals calibration, then moneyline favorite/underdog segmentation, then run-line line sensitivity.
6. Keep Official Pick policy unchanged until enough official rows settle.

## Release 04 Verdict

Release 04 improves model intelligence by documenting measured performance, feature importance, missed-opportunity causes, calibration limits and next model-quality work. It does not change prediction behavior.

