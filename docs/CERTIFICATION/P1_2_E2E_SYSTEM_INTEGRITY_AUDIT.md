# P1.2 E2E System Integrity Certification

## Verdict

`CONDITIONAL_PASS_POLICY_DECISION_REQUIRED`

P1.2 added a protected read-only integrity diagnostic and documented the current E2E prediction pipeline. Prediction Epoch V2 was not activated, historical replay was not started and historical prediction rows were not modified.

## Safety Confirmation

- Prediction formulas changed: `NO`
- Confidence calculations changed: `NO`
- Edge/EV/Kelly changed: `NO`
- Official Pick policy changed: `NO`
- Settlement rules changed: `NO`
- Learning weights changed: `NO`
- Provider budgets changed: `NO`
- Scheduler cadence changed: `NO`
- Historical rows rewritten: `NO`
- Prediction Epoch V2 activated: `NO`
- Historical replay started: `NO`

No historical rows were rewritten. Historical replay was not started.

## Protected Diagnostic

Route:

`/api/operations/e2e-integrity`

Protection:

`CRON_SECRET` bearer header or `secret` query parameter, matching existing protected operational route conventions.

The route is bounded, read-only, reports zero provider calls and zero mutations, and isolates subsystem failures in the response.

## P1.1 Preservation

The `2026-08-02` classification remains:

- Generated rows: `45`
- Valid pregame rows: `45`
- Production eligible rows: `0`
- Production settled rows: `0`
- Exact exclusion: `PREGAME_VALID_QUARANTINED_PREVIEW`

Do not retroactively promote those rows.

## Production Eligibility Policy Finding

`POLICY_CONFLICT_REQUIRES_HUMAN_APPROVAL`

Evidence:

- `production-data-gate.service.ts` requires `production_eligible=true` for production evaluation consumers.
- P1.1 proved valid pregame rows may remain `production_eligible=false` when quality/recommendation/quarantine blockers are present.
- Changing this would alter Performance history and model evaluation semantics.

Policy choices that need explicit approval:

1. `PRODUCTION_EVALUATION_SHOULD_INCLUDE_ALL_VALID_PREGAME_PREDICTIONS`
2. `PRODUCTION_EVALUATION_REQUIRES_RECOMMENDATION_GATES`

## Classification

Final classification:

`P1_2_CONDITIONAL_PASS_POLICY_DECISION_REQUIRED`

MC-08E remains paused.
