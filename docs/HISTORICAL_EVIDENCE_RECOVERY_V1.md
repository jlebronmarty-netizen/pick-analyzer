# Historical Evidence Recovery V1

Date: 2026-07-29

Status: READ-ONLY RECOVERY COMPLETE

## Mission

Recover every legitimately recoverable training sample using only existing canonical platform data. This phase did not call providers, run historical imports, run Historical Replay, run historical feature backfill, train a model, create predictions, create settlements or mutate production data.

## Recovery Result

| Metric | Before | After |
| --- | ---: | ---: |
| Training-ready rows | 354 | 419 |
| Rejected or blocked rows | 2,241 | 2,176 |
| Recovered rows | 0 | 65 |

The 65 recovered rows are virtual learning-dataset recoveries. They are not `prediction_history` rewrites and are not settlement updates.

## Why The Rows Are Recoverable

All 65 recovered rows have:

- canonical `game_results` evidence;
- existing linked feature snapshot evidence;
- existing model version evidence;
- existing canonical event mapping;
- cutoff-safe timing;
- deterministic outcome label;
- no duplicate recovered ID;
- no orphan recovered row.

Recovery categories:

| Category | Count |
| --- | ---: |
| Result already exists | 65 |
| Feature snapshot already exists | 65 |
| Model version already exists | 65 |
| Canonical mapping already exists | 65 |
| Metadata incomplete | 0 |
| Lifecycle needs canonical reconciliation | 65 |

The lifecycle reconciliation is read-only: the manifest uses deterministic canonical outcome evidence without writing settlement status back to the prediction rows.

## Remaining Recovery State

- Remaining recoverable or reviewable rows: 438
- Permanently rejected under current evidence: 1,738
- Estimated future-approved preview/shadow review pool: 1,636
- No-import current evidence maximum after this phase: 419
- Future approved preview/shadow settlement review maximum: 2,055

## Quality Audit

| Check | Count |
| --- | ---: |
| Duplicate recovered IDs | 0 |
| Recovered rows missing feature linkage | 0 |
| Recovered rows missing result linkage | 0 |
| Recovered rows missing model linkage | 0 |
| Recovered rows with cutoff failure | 0 |
| Recovered rows with label failure | 0 |
| Orphan recovered rows | 0 |

## Safety

- Provider calls: 0
- Database mutations: 0
- Production mutations: 0
- Settlement writes: 0
- Prediction writes: 0
- Model training runs: 0
- Model weight mutations: 0
- Epoch mutations: 0

## Evidence

- `scripts/historical-evidence-recovery-v1.mjs`
- `scripts/historical-evidence-recovery-v1-validate.mjs`
- `docs/LEARNING_DATASET_GROWTH.json`
- `docs/RECOVERY_SUMMARY.json`
