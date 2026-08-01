# Experiment Registry

Status: RELEASE 10 CONTROLLED MODEL EXPERIMENTATION FRAMEWORK

Release 10 creates the canonical registry for future model experiments. No experiment in this registry changes production probabilities, Official Picks, settlement, scheduler behavior, provider contracts or learning weights.

## Registry Contract

Every experiment must include:

| Field | Requirement |
| --- | --- |
| Experiment ID | Stable identifier using `EXP-YYYY-NNN` |
| Description | Plain-language summary of the proposed model change |
| Objective | The metric or decision quality target being improved |
| Candidate | The optimization candidate under test |
| Date | Date the experiment is registered |
| Author | Human or release owner accountable for approval |
| Status | `WAITING_FOR_DATA`, `READY_TO_RUN`, `RUNNING`, `PASS`, `FAIL`, `INSUFFICIENT_DATA`, `APPROVED_FOR_RELEASE` |
| Dataset | Read-only settled prediction source or segment API snapshot |
| Sample Size | Scored rows available for the affected population |
| Baseline | Frozen Release 10 baseline metric set |
| Candidate Result | Offline result from the runner |
| Winner | `BASELINE`, `CANDIDATE`, or `NONE` |
| Regression Status | `NO_REGRESSION`, `REGRESSION`, or `NOT_PROVEN` |

## Current Experiments

| Experiment ID | Description | Objective | Candidate | Date | Author | Status | Dataset | Sample Size | Baseline | Candidate Result | Winner | Regression Status |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| EXP-2026-001 | Evaluate market-specific calibration once market evidence is stable. | Improve market-level Brier and calibration without reducing accuracy. | Market-specific calibration | 2026-08-01 | Release 10 | INSUFFICIENT_DATA | `/api/model/segments` and Release 08 candidates | 479 scored rows | Release 10 frozen baseline | Not run; totals show mixed signal and no safe rule exists. | NONE | NOT_PROVEN |
| EXP-2026-002 | Evaluate confidence normalization after high-confidence buckets grow. | Improve confidence reliability without degrading Official Picks. | Confidence normalization | 2026-08-01 | Release 10 | INSUFFICIENT_DATA | `/api/model/segments` and Release 08 candidates | 10 scored rows above Low confidence | Release 10 frozen baseline | Not run; bucket samples are too sparse. | NONE | NOT_PROVEN |
| EXP-2026-003 | Evaluate probability bucket calibration for 50%+ model probabilities. | Improve probability calibration in higher probability bands. | Probability bucket calibration | 2026-08-01 | Release 10 | FAIL | `/api/model/segments` and Release 08 candidates | 21 scored rows above 50% | Release 10 frozen baseline | Rejected before simulation; below minimum bucket sample. | BASELINE | NOT_PROVEN |
| EXP-2026-004 | Evaluate feature weighting only after feature coverage becomes measurable. | Improve feature contribution stability without black-box tuning. | Feature weighting candidate | 2026-08-01 | Release 10 | FAIL | Release 07 feature coverage and Release 08 candidates | 0 reliable contribution rows | Release 10 frozen baseline | Rejected before simulation; contribution cannot be estimated safely. | BASELINE | NOT_PROVEN |

## Rules

- Experiments are read-only until a later approved production release.
- The baseline wins by default unless a candidate improves protected metrics and produces no regression.
- `APPROVED_FOR_RELEASE` is not production approval. It only means a human may scope a later release.
- No experiment may generate retrospective predictions or labels.
- No experiment may use provider calls during certification.
