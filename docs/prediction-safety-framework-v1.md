# Prediction Safety Framework V1

Prediction Safety Framework V1 adds reusable provider-independent validation primitives for prediction generation.

## Scope

- event start checks
- non-predictable event status checks
- stale odds checks
- future odds timestamp checks
- market compatibility checks
- selection validation
- line and odds validation
- feature completeness checks
- model version requirements
- duplicate prevention contracts
- leakage-risk checks
- typed skip reasons

## Files

- `src/services/prediction-safety.service.ts`
- `src/app/api/prediction-safety/route.ts`
- `src/components/dashboard/PredictionSafetyPanel.tsx`

## API

`GET /api/prediction-safety`

Returns deterministic local self-test results and framework readiness. It makes zero provider calls.

## NBA Compatibility

NBA Prediction Validation V1 remains unchanged. The generic framework sits beside it and can be adopted incrementally when sport-specific validators are touched.

This avoids breaking current NBA validation, persistence and duplicate-prevention behavior.

## Deterministic Validation

The status API validates sample cases for:

- valid prediction
- stale odds skip
- duplicate prediction skip
- missing model version skip

These are local deterministic checks, not fabricated production predictions.

## Future Work

- Gradually adopt shared checks in NBA validation where behavior matches exactly.
- Use the framework for future NFL, NHL, soccer, tennis and UFC validators.
- Add persisted safety metrics only if an operational events table is approved later.
