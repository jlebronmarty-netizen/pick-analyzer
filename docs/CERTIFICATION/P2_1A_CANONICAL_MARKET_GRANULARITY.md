# P2.1A Canonical Market Prediction Granularity

Status: LOCAL VALIDATION PASS PENDING PRODUCTION CERTIFICATION

P2.1A corrects the Current V2 MLB supported-market prediction contract from selection-level production evaluation to canonical event-market production evaluation.

## Canonical Contract

- Provider selection evidence may include both sides for supported markets.
- Canonical model prediction identity is one prediction per event, market and active epoch.
- For an 8-game MLB slate, the expected canonical model predictions are:
  - 8 moneyline.
  - 8 spread/run line.
  - 8 total.
  - 24 total canonical predictions.
- Provider-backed selection evidence may remain 48 rows for the same slate:
  - 16 moneyline sides.
  - 16 spread/run line sides.
  - 16 total sides.

## Repository Correction

The SportsDataIO MLB prospective writer now chooses one canonical odds row per event and normalized market for production prediction persistence. The selected outcome and opposing side are preserved inside `feature_snapshot.canonicalMarketPrediction` as contextual provider evidence.

Existing Current V2 selection-level preview rows are not deleted. When superseded by a P2.1A canonical event-market row, they are classified as `P2_1_SELECTION_LEVEL_PREVIEW`, marked `canonicalEvaluationEligible=false`, excluded from Performance and settlement-learning eligibility, and linked to the canonical row when the relationship is available.

## Guardrails

- Prediction formulas unchanged.
- Recommendation gates unchanged.
- Official Pick policy unchanged.
- Kelly unchanged.
- Settlement rules unchanged.
- Learning weights unchanged.
- Scheduler cadence unchanged.
- Provider contracts unchanged.
- No retrospective predictions after cutoff.
- Paused MC-08E work remains isolated in the main checkout.

## Certification Requirements

P2.1A is not production-certified until production evidence proves:

- `/api/operations/prediction-coverage` reports 24 expected canonical predictions for the 8-game slate.
- Provider-side evidence remains distinguishable from canonical model predictions.
- Performance counts only canonical event-market predictions.
- Settlement and learning ignore superseded selection-level preview rows.
- P2.2 remains paused until P2.1A is certified.

## Local Validation

- P2.1A validator: PASS.
- P2.1 supported-market validator: PASS.
- P2.0 epoch validator: PASS.
- P1.4 pipeline validator: PASS.
- P1.3 production-evaluation validator: PASS.
- Protected canonical MLB settlement validator: PASS.
- Performance validator: PASS.
- Unsupported-market policy validator: PASS.
- Mission Control validator: PASS.
- Documentation validation: PASS.
- Changed-file ESLint: PASS.
- Targeted secret scan: PASS.
- `git diff --check`: PASS.
- `npm.cmd run build`: PASS.
