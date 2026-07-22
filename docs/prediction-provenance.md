# Prediction Provenance

Prediction provenance separates row origin from row outcome. A prediction can exist in `prediction_history` while still being ineligible for production metrics when it lacks canonical event and feature lineage.

## Production Evidence

A production-qualified prediction row must be intentionally eligible and traceable:

- `production_eligible=true`
- stable canonical event identity
- `model_version`
- immutable feature snapshot linkage
- odds snapshot or accepted market lineage when applicable
- idempotency key
- non-trial and non-scrambled flags

## Legacy Evidence

Legacy rows are recognized by a combination of evidence, not by a single nullable column:

- 32-character provider game ID
- The Odds API sport keys and sportsbook labels
- `moneyline` market from the old capture service
- missing canonical event lineage
- missing model, feature, odds, operating-day and idempotency lineage
- `production_eligible=false`

## Current Classifier

`src/services/legacy-prediction-provenance.service.ts` classifies rows as:

- `PRODUCTION`
- `LEGACY`
- `THEODDSAPI_TRIAL`
- `SPORTSDATAIO_TRIAL`
- `SYNTHETIC_TEST`
- `UNKNOWN`

Unknown rows remain visible in the provenance report and must not be silently promoted.

## Consumers

Settlement reconciliation imports the same legacy classifier so legacy rows are reported as `LEGACY_PROVENANCE_NON_PRODUCTION` instead of production repair backlog. Production-scoped performance and recommendation systems continue to require `production_eligible=true`.
