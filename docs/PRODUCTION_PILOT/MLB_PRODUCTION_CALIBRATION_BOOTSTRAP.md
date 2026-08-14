# MLB Production Calibration Bootstrap

Status: `MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_REPAIR_READY_FOR_DEPLOYMENT`

Observation time: 2026-08-14 production audit.

Starting commit: `caaffd00df3f12d314129938eb3ad266c4dd1eb2`

## Purpose

This phase implements the future-only bootstrap path that lets legitimate, cutoff-safe MLB Current Era predictions accumulate production calibration evidence without pretending they are Official Picks, Rent Plays, Moneyline recommendations or user-actionable bets.

## Legacy Flag Finding

`recommended_pick` is an overloaded legacy flag. Runtime readers use it for calibration buckets, official-pick style surfaces, performance/AI summaries and recommendation history. Because it can mean user recommendation or Official Pick in current product code, future bootstrap rows must not set `recommended_pick=true` merely to create calibration samples.

`production_eligible` is also overloaded. It is read by the production data gate, Current Board official eligibility, top-pick readers, lifecycle summaries and performance-oriented services. Because it can imply recommendation or official-review eligibility, future bootstrap rows must not set `production_eligible=true` for calibration-only probation.

## Implemented Contract

The repair adds an explicit `feature_snapshot.productionCalibrationBootstrap` metadata object for future rows written by the deployed runtime.

The probationary state is:

- mode: `mlb_production_calibration_bootstrap_v1`
- state: `PRODUCTION_CALIBRATION_PROBATION`
- future only: yes
- sport: `baseball_mlb`
- markets: moneyline, run line / spread, total
- `recommended_pick`: false
- `production_eligible`: false
- Official Pick promoted: false
- user recommendation: false
- historical replay eligible: false

The marker is emitted only when the row is supported MLB, pregame, before cutoff, backed by feature and odds snapshot lineage, supported by valid model/version metadata, non-trial, non-scrambled, and production-evaluable under the existing policy.

## Calibration Endpoint

`/api/model/calibration` keeps the legacy recommended cohort but now adds a separate explicit bootstrap cohort:

1. legacy rows: settled, production-gate-valid rows with `recommended_pick=true`
2. probationary rows: settled rows whose `feature_snapshot.productionCalibrationBootstrap` proves `eligible=true` and `calibrationCohortEligible=true`

The endpoint response separates:

- `legacyProductionGateRows`
- `recommendedSettledRows`
- `calibrationCohortRows`
- `legacyRecommendedCalibrationRows`
- `probationaryCalibrationRows`

This removes the circular dependency where calibration required acceptable calibration before new samples could exist.

## Future Sample Sequence

Future prediction -> runtime writes bootstrap marker -> row remains not recommended and not production-eligible legacy flag -> event completes -> canonical settlement writes result -> learning proceeds through existing policy -> calibration endpoint includes the row in the probationary calibration cohort -> sample count increases.

No historical rows are modified. No replay rows are promoted. No post-start predictions are created. No Official Pick is created automatically.

## HOU / Most Likely Audit

Production evidence at 2026-08-14T14:57Z showed:

- Most Likely rows: 42
- Current Board candidates: 42
- Dashboard grounded opportunity rows: 59
- Current Board reconciliation: 59 evaluated, 42 returned, 17 filtered as `SUPERSEDED`

HOU Moneyline was the top Most Likely outcome:

- event: SEA @ HOU
- prediction/source row: `e00bb4e6-a3d2-53b6-826c-1d4648f1acef`
- event identity: `baseball_mlb:mlb:sportsdataio:event:79122`
- provider evidence: The Odds API
- selection displayed by Most Likely: HOU
- source selection: SEA
- probability: 72.78%
- confidence: 35.91%
- odds: -122
- implied probability: 54.95%
- edge: +17.83 percentage points
- EV: +32.44%
- freshness: FRESH
- binding: COMPLEMENT
- regime: MODEL_ONLY / PREVIEW
- official eligibility: not officially eligible

The `sportsdataio` segment in the event ID is a legacy canonical/provider mapping identity. The HOU price evidence itself reports `providerId=the-odds-api`, and certification reads made zero SportsDataIO calls.

HOU is present in the Current Board reconciliation as an aligned canonical outcome, but it remains model-only preview evidence and fails MC-08B gates, including calibration, confidence and production/recommendation policy gates. It should not become Rent Play merely because it is highest probability.

## Safety

- Provider calls from certification reads: 0
- Database mutations from certification reads: 0
- DB migration required: no
- Existing rows modified: 0
- Historical replay modified: 0
- Official Pick thresholds changed: no
- Probability, confidence, edge and EV formulas changed: no
- SportsDataIO routine calls reopened: no
- NBA state changed: no

## Decision

Bootstrap verdict: `MLB_PRODUCTION_CALIBRATION_BOOTSTRAP_REPAIR_READY_FOR_DEPLOYMENT`

HOU verdict: `HOU_MODEL_ONLY_EXCLUDED_CORRECTLY`

MLB freeze decision: `MLB_FINAL_FREEZE_WAIT_BOOTSTRAP_DEPLOYMENT`

