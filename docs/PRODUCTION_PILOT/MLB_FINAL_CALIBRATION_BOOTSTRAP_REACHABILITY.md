# MLB Final Calibration Bootstrap Reachability Audit

Status: `MLB_CALIBRATION_BOOTSTRAP_HUMAN_CERTIFICATION_REQUIRED`

Observation time: 2026-08-14 production audit.

Production commit observed: `034073d7bd7aace9543b448d58be4a95675238c2`

## Question

What causes the first Current Era MLB prediction to transition from quarantined / non-production evidence into production calibration eligibility?

## Finding

There is no automatic transition in the currently deployed runtime.

The production system has two distinct concepts:

| Concept | Runtime owner | Current evidence |
| --- | --- | --- |
| Performance production-evaluable rows | `feature_snapshot.productionEvaluationPolicy.production_evaluable` | Present and settling |
| Official calibration sample rows | `prediction_history.production_eligible=true` plus settled result and `recommended_pick=true` | Zero rows |

Performance can therefore show a real Current Era sample while `/api/model/calibration` remains at zero.

## Current Production Evidence

Read-only production evidence:

| Metric | Value |
| --- | ---: |
| Performance Current Era generated | 747 |
| Performance canonical predictions | 468 |
| Performance settled canonical rows | 423 |
| Calibration endpoint settled rows | 0 |
| Calibration endpoint recommended settled rows | 0 |
| Current Era queried prediction rows since active epoch | 733 |
| Settled queried rows | 674 |
| Legacy `production_eligible=true` rows | 0 |
| Legacy `recommended_pick=true` rows | 0 |
| Legacy production calibration eligible rows | 0 |
| Production-evaluable policy rows | 446 |
| Settled production-evaluable policy rows | 401 |

Primary exclusion counts from the read-only epoch query:

| Reason | Count |
| --- | ---: |
| `NON_PRODUCTION_OR_QUARANTINED` | 674 |
| `NO_SETTLEMENT` | 59 |

## Runtime Contract

`src/services/model-calibration.service.ts` reads `prediction_history` with:

- `production_eligible = true`
- non-pending status
- production gate checks
- settled result in `win`, `loss` or `push`

It then builds calibration buckets only from rows where `recommended_pick === true`.

`src/services/recommendation-eligibility-policy.service.ts` keeps automatic production approval disabled and requires:

- production gate success
- supported market
- fresh usable odds
- feature quality and sufficiency
- calibration status `acceptable` or `mature`
- confidence at least `65`
- model probability at least `52`
- edge at least `5`
- EV at least `5`

The policy has a probationary preview mode, but the current persisted MLB writers still store generated prediction rows as non-production evidence.

## Current Writers

The traced current MLB writers preserve review-only evidence:

- `src/services/sportsdataio-mlb-prospective-preview.service.ts` writes preview/quarantined rows with `production_eligible=false`.
- `src/services/line-versioned-reprediction-writer.service.ts` writes line-versioned re-prediction rows with `production_eligible=false` and `recommended_pick=false`.
- `src/services/the-odds-api-current-odds-acquisition.service.ts` can mark odds snapshots product-authoritative under Stage 3, but that does not make prediction rows production calibration eligible.

## Bootstrap Interpretation

The first production calibration row requires an explicit human-certified bootstrap/promotion phase, not a natural scheduler transition.

That phase must authorize future, pregame, cutoff-safe, current-model MLB predictions to enter the production calibration cohort. It must define how probationary calibration is allowed to seed the first `recommended_pick=true` sample without changing thresholds, importing replay rows, or manually promoting historical/quarantined predictions.

Required decision artifact:

`MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_AUTHORIZATION`

Minimum required contents:

- Scope: future Current Era MLB predictions only.
- Prohibited: historical replay promotion, retrospective prediction promotion, manual quarantine clearing.
- Required: production gate success, cutoff/start-state safety, feature lineage, exact market identity, supported markets, fresh product-authoritative odds.
- Required: no changes to probability formulas, model weights, thresholds, Official Pick policy, settlement or learning.
- Required: explicit treatment of probationary calibration for the first production sample.

## Reachability

Reachability is blocked by human certification, not by provider independence, settlement, scheduler, or SportsDataIO runtime behavior.

After explicit authorization and bounded implementation, the path is:

future prediction -> production writer sets `production_eligible=true` for eligible rows -> recommendation policy sets `recommended_pick=true` only when approved gates pass -> result settlement -> `/api/model/calibration` includes the row.

Current code does not perform the first two transitions automatically.

## Safety

- Provider calls from certification reads: 0.
- Database mutations from certification reads: 0.
- Calibration thresholds changed: no.
- Confidence threshold changed: no.
- Edge / EV thresholds changed: no.
- Official Pick policy changed: no.
- Replay added to Current Era Performance: no.
- Replay added to production calibration: no.
- Quarantine manually cleared: no.
- Production gate manually cleared: no.
- SportsDataIO independence reopened: no.

## Decision

Final verdict: `MLB_CALIBRATION_BOOTSTRAP_HUMAN_CERTIFICATION_REQUIRED`

MLB Final Freeze decision: `MLB_FINAL_FREEZE_NOT_READY_CALIBRATION_BOOTSTRAP_HUMAN_CERTIFICATION_REQUIRED`

Next recommended phase: `MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_AUTHORIZATION`

NBA-02 remains blocked by this final MLB freeze gate unless the human accepts calibration bootstrap as a separately monitored post-freeze item.
