# MLB Final Provider Independence And Calibration Audit

Status: `MLB_FINAL_PROVIDER_INDEPENDENCE_CALIBRATION_REPAIR_READY_FOR_DEPLOYMENT`

Observation time: 2026-08-13 production audit, America/Puerto_Rico operating day.

Starting commit: `dca83ad9074aaca6b17f32d0ab5e54b8aa3a70e3`

Production commit observed: `dca83ad9074aaca6b17f32d0ab5e54b8aa3a70e3`

## Provider Independence

Production was correctly configured for The Odds API product odds authority and MLB Official primary data source, but provider-budget telemetry showed six SportsDataIO MLB calls on the same operating day.

Those six records were real HTTP calls, not certification reads:

- Three from initial `sportsdataio_mlb_prospective_preview_v1`: GamesByDate, GameOddsByDate and PlayerGameProjectionStatsByDate.
- Three later GameOddsByDate calls.

Exact caller: `src/services/operating-day.service.ts` invoked `runSportsDataIoMlbProspectivePreview()` for operating-day refresh work. That service still reached SportsDataIO even though the newer adaptive canonical acquisition path was already suppressed under Stage 3.

Repair: `src/services/sportsdataio-mlb-prospective-preview.service.ts` now enforces the authority stage at the service boundary. Under Stage 3 or Stage 4 it returns `SKIPPED_AUTHORITY_NOT_SPORTSDATAIO`, `providerCallsMade=0`, and `externalProviderCallsMade=0` before constructing SportsDataIO endpoint plans.

The repair preserves rollback: Stage 0 and Stage 1 remain SportsDataIO-authority stages.

Post-deployment requirement: observe at least one normal scheduler cycle and verify zero new routine SportsDataIO MLB calls after the repair commit.

## Provider Authority State

| Provider | Role |
| --- | --- |
| The Odds API | MLB product odds authority |
| MLB Official / MLB Stats API | Primary non-odds schedule, status, starters and results source |
| SportsDataIO | Rollback-only, not routine |

Hidden fallback result: no allowed hidden fallback remains in normal Stage 3 operation. Rollback requires explicit authority-stage change.

## Calibration Evidence

Runtime policy sources:

- `src/services/recommendation-eligibility-policy.service.ts`
- `src/services/model-calibration.service.ts`
- `src/services/production-data-gate.service.ts`
- `src/services/mlb-calibration-shadow-v1.service.ts`

Current production sample:

| Metric | Value |
| --- | ---: |
| Current Era predictions since 2026-08-01 | 795 |
| Current Era settled | 781 |
| Current Era production-calibration eligible | 0 |
| Current Era recommended settled | 0 |
| Certified historical replay predictions | 7,290 |
| Historical replay production-calibration eligible | 0 |
| Historical replay shadow/research eligible | 7,290 |

Current Era settled diagnostics:

- Accuracy: 48.24%.
- Brier: 0.2559.
- Calibration error: 10.92 percentage points.
- Market settled rows: moneyline 240, run line/spread 252, total 289.

`CALIBRATION_INSUFFICIENT` is currently deterministic: no Current Era row is production calibration eligible because rows remain quarantined/non-production, and historical replay remains shadow-only.

## Quarantine And Official Pick Readiness

Calibration insufficiency does not automatically cause quarantine. Quarantine is driven by `production_eligible !== true` and preview metadata. Official Pick eligibility also requires confidence, probability, edge, EV, freshness, supported market, model/feature lineage and production gate success.

The current best near-miss sampled by edge was MIL moneyline:

- Probability: 39.41.
- Confidence: 42.62.
- Edge: -3.69.
- EV: -8.57.
- Production eligible: false.
- Recommended pick: false.

If calibration became acceptable today, that candidate would still fail probability, confidence, edge, EV, production gate and quarantine requirements.

## Final Freeze Interpretation

Calibration being insufficient is not by itself an MLB architecture blocker if:

- the pipeline keeps accumulating settled evidence;
- status remains honest;
- Official Picks fail closed;
- no replay rows contaminate Current Era production calibration;
- no manual promotion is performed.

Provider independence does require post-deployment observation because a real routine SportsDataIO caller was repaired. Until that observation passes, the freeze decision is `MLB_FINAL_FREEZE_WAIT_PROVIDER_OBSERVATION`.

## Safety

- Provider calls from certification reads: 0.
- Production database mutations from certification reads: 0.
- Calibration thresholds changed: no.
- Official Pick thresholds changed: no.
- Replay added to Current Era Performance: no.
- Replay added to production calibration: no.
- Quarantine cleared: no.
- Production gate cleared: no.
- SportsDataIO cancelled: no.
- NBA-02 started: no.
