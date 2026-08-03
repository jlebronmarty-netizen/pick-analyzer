# P1.3 Production Evaluation Policy Separation

Status: implemented for prospective prediction writes.

## Decision

Production evaluation now means valid pregame model output that can be measured after the event. It is separate from:

- recommendation eligibility;
- actionability;
- Official Pick eligibility.

Low confidence, low edge, low EV, probationary calibration and stale price evidence can block a recommendation, but they do not automatically remove a valid pregame prediction from production evaluation.

## Scope

This policy is prospective from the certified P1.3 boundary. The 2026-08-02 rows remain historical evidence under their original `PREGAME_VALID_QUARANTINED_PREVIEW` and `LEGACY_PRE_V2` classifications. They were not promoted, rewritten, settled or used to fabricate production results.

## Contract

Future MLB prospective prediction snapshots include `feature_snapshot.productionEvaluationPolicy` with:

- `prediction_valid`;
- `production_evaluable`;
- `recommendation_eligible`;
- `actionable`;
- `official_pick_eligible`;
- `production_evaluation_reasons`;
- `production_evaluation_warnings`;
- `recommendation_gate_reasons`;
- `production_scope`.

The existing `production_eligible` boolean remains available for legacy consumers and recommendation surfaces. It is not reused as the only production-evaluation policy.

## Evaluation Blockers

Production evaluation is blocked by data-integrity or scope issues only:

- missing event or participants;
- unsupported market or missing selection;
- invalid probability;
- missing model, feature-set or feature-snapshot identity;
- trial, scrambled, replay, backtest, shadow, historical or legacy scope;
- duplicate identity;
- unresolved critical mappings;
- generated-after-cutoff leakage;
- odds-after-cutoff leakage;
- feature snapshot generated after prediction;
- critical leakage/corruption warning.

## Recommendation-Only Blockers

The following remain recommendation gates only:

- low confidence;
- low model probability;
- non-positive or low edge;
- non-positive or low EV;
- probationary or insufficient calibration;
- stale price evidence.

Stale price evidence is preserved as a warning. It may prevent actionability or current-value claims, but it does not erase the model output when the prediction itself remains pregame-valid.

## Safety

- Prediction formulas unchanged.
- Probability, confidence, edge and EV calculations unchanged.
- Official Pick thresholds unchanged.
- Recommendation thresholds unchanged.
- Settlement rules unchanged.
- Learning weights unchanged.
- Scheduler cadence unchanged.
- Provider contracts unchanged.
- Historical 2026-08-02 rows unchanged.

## Next Phase

P2.0 may introduce a formal epoch boundary and performance-scope adoption for prospective `production_evaluable` rows. P1.3 only creates and persists the separated policy contract.
