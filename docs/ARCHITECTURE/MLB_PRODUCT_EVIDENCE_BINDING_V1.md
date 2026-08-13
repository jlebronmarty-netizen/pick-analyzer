# MLB Product Evidence Binding V1

Status: `MLB_MODEL_PROBABILITY_EVIDENCE_BINDING_REPAIR_READY_FOR_DEPLOYMENT`

## Purpose

Current Board product candidates must expose the same model probability, price, implied probability, edge and EV bundle that was used to build the candidate. The product layer may also expose canonical/complement review evidence, but it must not mix that evidence into the source-selection fields.

## Root Cause

Production Current Board rows contained valid stored MLB model probabilities in `rawProbability` and valid same-selection value math in `marketAlignment`, but the top-level product DTO omitted `modelProbability` and `winProbability`. The homepage adapter reads those top-level aliases first, so the rendered cards could show odds, implied probability, confidence, edge or EV while rendering model probability as `N/A`.

This was a DTO/evidence-binding defect, not a prediction-generation defect.

## Binding Contract

- `modelProbability`, `winProbability` and `probability` are aliases for the stored same-selection `prediction_history.model_probability` already exposed as `rawProbability`.
- `edgePercentagePoints` and `expectedValuePercent` are aliases for the same-selection `marketAlignment` value math.
- `analysisSnapshotTimestamp` is the prediction row `generated_at` timestamp for product evidence traceability.
- `canonicalOutcome`, `canonicalPrice`, `canonicalMarketAlignment` and `canonicalEv` remain available for canonical/complement review evidence.
- Homepage review cards may use canonical EV fallback only when explicitly reading canonical review evidence; source-selection probability must not be dropped.

## Safety

No prediction formula, model probability, confidence, EV formula, ranking, Official Pick policy, provider authority, settlement, learning, HR-03 calibration status, NBA historical foundation or Vercel configuration changed.

Certification reads use 0 provider calls and 0 database mutations.
