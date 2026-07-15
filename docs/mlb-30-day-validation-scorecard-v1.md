# MLB 30-Day Validation Scorecard V1

Status: scoring contract only. No automatic continuation, production promotion or wagering recommendation is authorized.

Labels:

- QUARANTINED REAL-DATA VALIDATION
- NOT A WAGERING RECOMMENDATION
- NOT PRODUCTION PERFORMANCE

## Inputs

Evaluate only quarantined MLB rows produced by the approved prospective workflow:

- total predictions
- settled sample
- market split: moneyline, run line, total
- odds coverage
- closing-comparison coverage
- provider reliability
- data incidents
- operating time
- subscription cost

## Metrics

- Settled sample size.
- Hit rate with market splits.
- Brier score and Brier trend versus a simple baseline.
- Calibration by probability bucket.
- Technical units and ROI with uncertainty.
- Max drawdown.
- Push/void/pending rates.
- Prediction-time odds coverage.
- Final captured pregame comparison coverage.
- Cost per game.
- Cost per settled prediction.

## Decision Categories

- `insufficient_evidence`: sample or coverage is too small.
- `continue_collecting`: operational health is acceptable but evidence is not decisive.
- `continue_mlb_only`: MLB looks operationally useful while other sports remain deferred.
- `reduce_provider_scope`: provider cost or operational load is high relative to value.
- `replace_free_compatible_feeds`: paid data is not materially improving validation.
- `pause_subscription`: cost, reliability or coverage is not justified.
- `proceed_toward_controlled_production_review`: only after adequate sample, calibration, coverage, reliability and explicit approval.

## Guardrails

Do not recommend continuation solely from a positive small sample. Do not promote any row to production automatically. Do not call technical final-captured pregame comparison an industry true close unless provider semantics prove it.

## Minimum Review Packet

- 30-day settled sample and by-market counts.
- Brier score versus baseline.
- Calibration table.
- Technical units/ROI with uncertainty statement.
- Max drawdown.
- Provider call count and cost-per-output.
- Missing data summary: pitchers, lineups, injuries, weather, bullpen.
- Production-gate audit showing public outputs exclude quarantined rows.

