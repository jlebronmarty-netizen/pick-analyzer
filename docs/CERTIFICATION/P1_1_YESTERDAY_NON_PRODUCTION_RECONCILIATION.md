# P1.1 Yesterday Non-Production Prediction Reconciliation

Date audited: 2026-08-02  
Timezone: America/Puerto_Rico  
Scope: MLB operating day prediction rows shown by Performance as 45 generated, 0 production eligible, 0 production settled and 45 non-production.

## Verdict

MIXED_CAUSES

The historical Performance classification is correct: Yesterday must remain 0 production-settled rows because all 45 generated rows are quarantined prospective-preview rows with `production_eligible=false`.

The forward product gap is also real: all 15 MLB events had pregame model rows before cutoff, but none had a production-eligible prediction row. That is a missed production opportunity, not a settlement failure and not a timezone/date-bucket failure.

## Row Reconciliation

| Measure | Count |
| --- | ---: |
| Events | 15 |
| Generated rows | 45 |
| Production eligible rows | 0 |
| Production settled rows | 0 |
| Non-production rows | 45 |
| Valid pregame timestamp rows | 45 |
| Post-start rows | 0 |
| Post-final rows | 0 |
| Invalid-cutoff rows | 0 |
| Events without valid production prediction | 15 |

Exact exclusive non-production reason:

| Reason | Rows |
| --- | ---: |
| PREGAME_VALID_QUARANTINED_PREVIEW | 45 |

Blockers observed in `skip_reason`:

| Blocker | Rows |
| --- | ---: |
| PRODUCTION_GATE_BLOCKED | 45 |
| QUARANTINED_ROW | 45 |
| STALE_ODDS | 45 |
| CALIBRATION_INSUFFICIENT | 45 |
| LOW_CONFIDENCE | 45 |
| LOW_MODEL_PROBABILITY | 45 |
| LOW_EDGE | 44 |
| NON_POSITIVE_EDGE | 42 |
| NON_POSITIVE_EV | 42 |
| LOW_EV | 43 |

## Findings

- All 45 rows were generated at `2026-08-02T16:26:12.065Z`, before event start and before their certified cutoff.
- All 45 rows have `feature_snapshot.prospective_preview=true`, `production_eligible=false`, `recommended_pick=false`, `validation_status=skipped` and model version `baseball_mlb_prospective_preview_v1`.
- The rows are not post-start, post-final, invalid-cutoff, legacy, replay, shadow or date-misassigned rows.
- Production Performance correctly excludes them because the production gate never promoted them into production-evaluable samples.
- Settlement did not fabricate outcomes and must not settle non-production rows into production metrics.
- The missing production sample is a forward readiness gap: valid pregame model output existed, but it remained quarantined.

## Decision

Preserve historical rows exactly as stored. Do not relabel the 45 rows, do not settle them as production, do not rewrite timestamps and do not create retrospective predictions.

Forward work should explicitly decide when a future row may become production eligible. Until that policy is certified, similar rows must remain quarantined and Performance must expose the exact non-production reason counts.

## Validation

Primary validator:

```powershell
node scripts/p1-1-yesterday-non-production-reconcile-validate.mjs
```

Expected validator result: PASS with 45 rows, 15 events, 0 production-eligible rows and 45 `PREGAME_VALID_QUARANTINED_PREVIEW` rows.
