# Historical Evidence Expansion V1

Date: 2026-07-29

Status: READ-ONLY ROADMAP COMPLETE

## Mission

Identify how Pick Analyzer can grow from 354 production-quality learning rows to more than 1,000 legitimate training-ready rows without importing historical data, training a model, replaying history, consuming provider credits, creating predictions, creating settlements or changing production data.

## Current Samples

- Total stored predictions scanned: 2,595
- Training-ready rows: 354
- Rejected or blocked rows: 2,241
- Learning queue rows: 386
- Accepted learning rows: 354
- Model weight history rows: 41
- First controlled candidate-training threshold: 1,000
- Remaining rows needed: 646

## Exact Inventory

| Category | Count |
| --- | ---: |
| Training-ready | 354 |
| Missing canonical result | 1,530 |
| Missing feature snapshot | 904 |
| Missing model version | 904 |
| Unsupported market | 0 |
| Invalid cutoff | 3 |
| Duplicate | 0 |
| Preview | 530 |
| Shadow | 1,106 |
| Audit | 0 |
| Fixture | 27 |
| Legacy | 0 |

Reasons can overlap. Recoverability uses mutually exclusive readiness partitions.

## Recoverability

| Partition | Count | Classification |
| --- | ---: | --- |
| Current training-ready | 354 | Already accepted |
| Blocked missing evidence | 596 | Recoverable if canonical result, feature and model-version proof can be linked |
| Research preview/shadow | 1,636 | Partially recoverable after legitimate settlement and production-contract review |
| Rejected invalid | 9 | Permanently rejected under current evidence |
| Unknown | 0 | No unclassified partition remains |

Maximum legitimate review pool from current stored evidence is 2,586 rows, but only 354 are currently training-ready.

## Provider Gap

- Supabase: current manifests contain prediction, result, feature and model-weight metadata.
- SportsDataIO: no live inspection; future gaps require approved historical result/odds availability review.
- The Odds API: no live inspection; historical odds availability remains entitlement-gated.
- Existing CSV: no new archive scan in this phase.
- Historical imports: not executed.
- Stored snapshots: accepted rows have feature evidence; blocked rows still need linkage proof.

## Safety

Provider calls: 0. Database mutations: 0. Production mutations: 0. Training runs: 0. Model weight mutations: 0. Epoch mutations: 0.

## Evidence

- `docs/DATA_COVERAGE_FORECAST.json`
- `docs/TRAINING_FORECAST.json`
- `scripts/historical-evidence-expansion-v1.mjs`
- `scripts/historical-evidence-expansion-v1-validate.mjs`
