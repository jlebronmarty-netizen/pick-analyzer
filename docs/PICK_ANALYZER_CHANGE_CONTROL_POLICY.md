# Pick Analyzer Change Control Policy

V1 is now scope-controlled. New work defaults to Post-V1 unless it is required to satisfy the V1 Definition of Done or repair a certified regression.

## Allowed V1 Changes

- P0 or P1 fixes needed to protect already-certified platform behavior.
- Documentation, JSON artifact or status updates that clarify the V1 contract.
- Validation repairs that do not change business logic.
- Release-candidate fixes required by the Definition of Done.

## Changes Requiring Separate Approval

- Provider calls, imports or credit-consuming data acquisition.
- Production data mutations.
- Prediction, confidence, probability, EV, Kelly, Trust or Official Pick policy changes.
- Scheduler behavior changes.
- Settlement or learning rule changes.
- Model training, model-weight mutation, challenger promotion or epoch activation.
- New sport or market production enablement.
- SQL migrations.
- Manual production deployment.

## Entry Requirements For Any New Phase

Every new phase must define:

- Objective.
- Scope boundary.
- Files expected to change.
- Data mutation policy.
- Provider-call policy.
- Acceptance criteria.
- Validator or evidence artifact.
- Rollback or no-regression statement.

## Exit Requirements

A phase exits only after validation passes and the status documents name exactly what changed, what did not change and what remains blocked.

## Certification Markers

- `CHANGE_CONTROL_POLICY_PASS`
- `NO_CODE_CHANGE_PASS`
- `NO_PROVIDER_CALL_PASS`
- `NO_PRODUCTION_MUTATION_PASS`
